import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal";
import StatCard from "../components/StatCard";

export default function PM2() {
  const [processes, setProcesses] = useState([]);
  const [liveStats, setLiveStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [filter, setFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [logsModal, setLogsModal] = useState(null);
  const [logsContent, setLogsContent] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  async function loadProcesses() {
    try {
      setError(null);
      const data = await api.getPm2Processes();
      setProcesses(data);
    } catch (err) {
      setError(err.message);
      console.error("Failed to load PM2 processes:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    // Initial data load (async, setState happens in callback)
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await api.getPm2Processes();
        if (!cancelled) setProcesses(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          console.error("Failed to load PM2 processes:", err);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    // Connect to PM2 stats SSE
    const es = api.streamPm2Stats();
    eventSourceRef.current = es;
    es.onmessage = (e) => {
      try {
        setLiveStats(JSON.parse(e.data));
      } catch {
        /* ignore parse errors */
      }
    };
    es.onerror = () => {};

    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  async function doAction(id, action) {
    setActionLoading((prev) => ({ ...prev, [id]: action }));
    try {
      if (action === "start") await api.pm2Start(id);
      if (action === "stop") await api.pm2Stop(id);
      if (action === "restart") await api.pm2Restart(id);
      if (action === "reload") await api.pm2Reload(id);
      await loadProcesses();
    } catch (err) {
      console.error(`Failed to ${action} process:`, err);
    }
    setActionLoading((prev) => ({ ...prev, [id]: null }));
  }

  async function deleteProcess(id) {
    setActionLoading((prev) => ({ ...prev, [id]: "delete" }));
    try {
      await api.pm2Delete(id);
      setConfirmDelete(null);
      await loadProcesses();
    } catch (err) {
      console.error("Failed to delete process:", err);
    }
    setActionLoading((prev) => ({ ...prev, [id]: null }));
  }

  async function openLogs(proc) {
    setLogsModal(proc);
    setLogsLoading(true);
    setLogsContent("");
    try {
      const data = await api.pm2Logs(proc.pm_id, 200);
      setLogsContent(data.logs || "No logs available");
    } catch (err) {
      setLogsContent("Failed to load logs: " + err.message);
    }
    setLogsLoading(false);
  }

  async function flushLogs(id) {
    try {
      await api.pm2Flush(id);
      setLogsContent("Logs flushed successfully.");
    } catch (err) {
      console.error("Failed to flush logs:", err);
    }
  }

  async function openDetail(proc) {
    setDetailModal(proc);
    setDetailData(null);
    try {
      const data = await api.pm2Describe(proc.pm_id);
      setDetailData(data);
    } catch (err) {
      console.error("Failed to describe process:", err);
    }
  }

  // Merge static process list with live stats
  const mergedProcesses = processes.map((p) => {
    const live = liveStats?.processes?.find((s) => s.pm_id === p.pm_id);
    return {
      ...p,
      cpu: live?.cpu ?? p.cpu,
      memory: live?.memory ?? p.memory,
      status: live?.status ?? p.status,
    };
  });

  const summary = liveStats?.summary || {
    total: processes.length,
    online: processes.filter((p) => p.status === "online").length,
    stopped: processes.filter(
      (p) => p.status === "stopped" || p.status === "errored",
    ).length,
    totalCpu: "0.0",
    totalMemory: 0,
  };

  const filtered = mergedProcesses.filter((p) => {
    if (filter === "online") return p.status === "online";
    if (filter === "stopped")
      return p.status === "stopped" || p.status === "errored";
    return true;
  });

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h2>PM2 Processes</h2>
          <p>Process manager analytics</p>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <h3>PM2 Not Available</h3>
            <p>{error}</p>
            <button
              className="btn btn-primary"
              style={{ marginTop: "16px" }}
              onClick={() => {
                setLoading(true);
                loadProcesses();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>PM2 Processes</h2>
            <p>Monitor and manage your PM2 processes</p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setLoading(true);
              loadProcesses();
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <StatCard
          icon="⚙️"
          value={summary.total}
          label="Total Processes"
          color="blue"
        />
        <StatCard
          icon="✅"
          value={summary.online}
          label="Online"
          color="green"
        />
        <StatCard
          icon="⛔"
          value={summary.stopped}
          label="Stopped / Errored"
          color="red"
        />
        <StatCard
          icon="⚡"
          value={`${summary.totalCpu}%`}
          label="Total CPU"
          color="orange"
        />
        <StatCard
          icon="🧠"
          value={formatBytes(summary.totalMemory)}
          label="Total Memory"
          color="purple"
        />
      </div>

      {/* Filter */}
      <div style={{ marginBottom: "16px" }}>
        <div className="flex gap-2">
          {["all", "online", "stopped"].map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">⚙️</div>
            <h3>No processes found</h3>
            <p>No {filter !== "all" ? filter : ""} PM2 processes running</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>CPU</th>
                  <th>Memory</th>
                  <th>Restarts</th>
                  <th>Uptime</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isOnline = p.status === "online";
                  return (
                    <tr key={p.pm_id}>
                      <td>
                        <span className="pm2-id">{p.pm_id}</span>
                      </td>
                      <td>
                        <div
                          className="container-name"
                          style={{ cursor: "pointer" }}
                          onClick={() => openDetail(p)}
                        >
                          {p.name}
                        </div>
                        <div className="container-id">PID: {p.pid || "—"}</div>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${isOnline ? "running" : "exited"}`}
                        >
                          <span className="status-dot" />
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <div className="pm2-metric">
                          <span className="pm2-metric-value">{p.cpu}%</span>
                          <div className="pm2-metric-bar">
                            <div
                              className="pm2-metric-fill cpu"
                              style={{
                                width: `${Math.min(p.cpu, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-sm">{formatBytes(p.memory)}</span>
                      </td>
                      <td>
                        <span
                          className={`pm2-restarts ${p.restarts > 10 ? "warn" : ""}`}
                        >
                          {p.restarts}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-muted">
                          {p.uptime ? formatUptime(p.uptime) : "—"}
                        </span>
                      </td>
                      <td>
                        <div
                          className="action-btns"
                          style={{ justifyContent: "flex-end" }}
                        >
                          {isOnline ? (
                            <>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                title="Stop"
                                disabled={!!actionLoading[p.pm_id]}
                                onClick={() => doAction(p.pm_id, "stop")}
                              >
                                ⏹
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                title="Restart"
                                disabled={!!actionLoading[p.pm_id]}
                                onClick={() => doAction(p.pm_id, "restart")}
                              >
                                🔄
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                title="Reload"
                                disabled={!!actionLoading[p.pm_id]}
                                onClick={() => doAction(p.pm_id, "reload")}
                              >
                                ♻️
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-success btn-icon btn-sm"
                              title="Start"
                              disabled={!!actionLoading[p.pm_id]}
                              onClick={() => doAction(p.pm_id, "start")}
                            >
                              ▶
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            title="Logs"
                            onClick={() => openLogs(p)}
                          >
                            📋
                          </button>
                          <button
                            className="btn btn-danger btn-icon btn-sm"
                            title="Delete"
                            disabled={!!actionLoading[p.pm_id]}
                            onClick={() => setConfirmDelete(p)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Process Detail Modal */}
      {detailModal && (
        <Modal
          title={`Process: ${detailModal.name}`}
          onClose={() => setDetailModal(null)}
          footer={
            <button
              className="btn btn-ghost"
              onClick={() => setDetailModal(null)}
            >
              Close
            </button>
          }
        >
          {detailData ? (
            <div className="detail-grid">
              <span className="detail-key">PM2 ID</span>
              <span className="detail-value">{detailData.pm_id}</span>

              <span className="detail-key">Name</span>
              <span className="detail-value">{detailData.name}</span>

              <span className="detail-key">PID</span>
              <span className="detail-value">{detailData.pid || "—"}</span>

              <span className="detail-key">Status</span>
              <span className="detail-value">
                {detailData.pm2_env?.status || "unknown"}
              </span>

              <span className="detail-key">Script</span>
              <span className="detail-value" style={{ wordBreak: "break-all" }}>
                {detailData.pm2_env?.pm_exec_path || "—"}
              </span>

              <span className="detail-key">CWD</span>
              <span className="detail-value" style={{ wordBreak: "break-all" }}>
                {detailData.pm2_env?.pm_cwd || "—"}
              </span>

              <span className="detail-key">Exec Mode</span>
              <span className="detail-value">
                {detailData.pm2_env?.exec_mode || "—"}
              </span>

              <span className="detail-key">Interpreter</span>
              <span className="detail-value">
                {detailData.pm2_env?.exec_interpreter || "—"}
              </span>

              <span className="detail-key">Node Version</span>
              <span className="detail-value">
                {detailData.pm2_env?.node_version || "—"}
              </span>

              <span className="detail-key">Instances</span>
              <span className="detail-value">
                {detailData.pm2_env?.instances || 1}
              </span>

              <span className="detail-key">Restarts</span>
              <span className="detail-value">
                {detailData.pm2_env?.restart_time || 0}
              </span>

              <span className="detail-key">Unstable Restarts</span>
              <span className="detail-value">
                {detailData.pm2_env?.unstable_restarts || 0}
              </span>

              <span className="detail-key">Uptime</span>
              <span className="detail-value">
                {detailData.pm2_env?.pm_uptime
                  ? formatUptime(detailData.pm2_env.pm_uptime)
                  : "—"}
              </span>

              <span className="detail-key">Created At</span>
              <span className="detail-value">
                {detailData.pm2_env?.created_at
                  ? new Date(detailData.pm2_env.created_at).toLocaleString()
                  : "—"}
              </span>

              <span className="detail-key">CPU</span>
              <span className="detail-value">
                {detailData.monit?.cpu ?? 0}%
              </span>

              <span className="detail-key">Memory</span>
              <span className="detail-value">
                {formatBytes(detailData.monit?.memory || 0)}
              </span>

              <span className="detail-key">Auto Restart</span>
              <span className="detail-value">
                {detailData.pm2_env?.autorestart ? "Yes" : "No"}
              </span>

              <span className="detail-key">Watch Mode</span>
              <span className="detail-value">
                {detailData.pm2_env?.watch ? "Enabled" : "Disabled"}
              </span>

              <span className="detail-key">Version</span>
              <span className="detail-value">
                {detailData.pm2_env?.version || "—"}
              </span>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <div className="spinner" />
            </div>
          )}
        </Modal>
      )}

      {/* Logs Modal */}
      {logsModal && (
        <Modal
          title={`Logs: ${logsModal.name}`}
          onClose={() => setLogsModal(null)}
          footer={
            <div className="flex gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => flushLogs(logsModal.pm_id)}
              >
                🗑 Flush Logs
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => openLogs(logsModal)}
              >
                🔄 Refresh
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setLogsModal(null)}
              >
                Close
              </button>
            </div>
          }
        >
          {logsLoading ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <div className="spinner" />
            </div>
          ) : (
            <pre className="pm2-logs-content">{logsContent}</pre>
          )}
        </Modal>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <Modal
          title="Delete PM2 Process"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => deleteProcess(confirmDelete.pm_id)}
                disabled={!!actionLoading[confirmDelete.pm_id]}
              >
                {actionLoading[confirmDelete.pm_id] === "delete"
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to delete PM2 process{" "}
            <strong>{confirmDelete.name}</strong>?
          </p>
          <p className="text-sm text-muted mt-4">
            This will remove the process from PM2. You can re-add it later.
          </p>
        </Modal>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i];
}

function formatUptime(uptimeMs) {
  const now = Date.now();
  const diff = now - uptimeMs;
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
