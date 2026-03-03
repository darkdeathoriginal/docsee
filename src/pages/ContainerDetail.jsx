import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import LogViewer from "../components/LogViewer";
import Modal from "../components/Modal";

export default function ContainerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [container, setContainer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [actionLoading, setActionLoading] = useState(null);
  const [stats, setStats] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    loadContainer();
  }, [id]);

  useEffect(() => {
    if (!container || container.State?.Status !== "running") return;

    let cancelled = false;
    async function streamStats() {
      try {
        const token = api.getToken();
        const res = await fetch(`/api/containers/${id}/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (!cancelled) setStats(data);
              } catch {
                /* ignore */
              }
            }
          }
        }
        reader.cancel();
      } catch {
        /* ignore */
      }
    }

    streamStats();
    return () => {
      cancelled = true;
    };
  }, [container?.State?.Status, id]);

  async function loadContainer() {
    try {
      const data = await api.inspectContainer(id);
      setContainer(data);
    } catch (err) {
      console.error("Failed to load container:", err);
    }
    setLoading(false);
  }

  async function doAction(action) {
    setActionLoading(action);
    try {
      if (action === "start") await api.startContainer(id);
      if (action === "stop") await api.stopContainer(id);
      if (action === "restart") await api.restartContainer(id);
      await loadContainer();
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
    }
    setActionLoading(null);
  }

  async function removeContainer() {
    setActionLoading("remove");
    try {
      await api.removeContainer(id, true);
      navigate("/containers");
    } catch (err) {
      console.error("Failed to remove:", err);
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (!container) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❌</div>
        <h3>Container not found</h3>
        <button
          className="btn btn-primary mt-4"
          onClick={() => navigate("/containers")}
        >
          ← Back to Containers
        </button>
      </div>
    );
  }

  const name = container.Name?.replace(/^\//, "") || id.substring(0, 12);
  const isRunning = container.State?.Status === "running";
  const config = container.Config || {};
  const hostConfig = container.HostConfig || {};
  const networkSettings = container.NetworkSettings || {};

  const ports = [];
  if (networkSettings.Ports) {
    Object.entries(networkSettings.Ports).forEach(
      ([containerPort, bindings]) => {
        if (bindings) {
          bindings.forEach((b) => {
            ports.push(`${b.HostPort} → ${containerPort}`);
          });
        } else {
          ports.push(`${containerPort} (not published)`);
        }
      },
    );
  }

  const mounts = container.Mounts || [];

  const networks = networkSettings.Networks
    ? Object.entries(networkSettings.Networks).map(([netName, netInfo]) => ({
        name: netName,
        ip: netInfo.IPAddress,
        gateway: netInfo.Gateway,
        mac: netInfo.MacAddress,
      }))
    : [];

  const tabs = [
    { key: "overview", label: "📋 Overview", icon: "📋" },
    { key: "logs", label: "📄 Logs", icon: "📄" },
    { key: "env", label: "🔑 Environment", icon: "🔑" },
    { key: "mounts", label: "💾 Mounts", icon: "💾" },
    { key: "network", label: "🌐 Network", icon: "🌐" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate("/containers")}
          >
            ← Back
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 style={{ margin: 0 }}>{name}</h2>
              <span className={`status-badge ${container.State?.Status}`}>
                <span className="status-dot" />
                {container.State?.Status}
              </span>
            </div>
            <p className="text-sm text-muted" style={{ marginTop: 4 }}>
              {config.Image} · {id.substring(0, 12)}
            </p>
          </div>
          <div className="flex gap-2">
            {isRunning ? (
              <>
                <button
                  className="btn btn-ghost btn-icon-mobile"
                  disabled={!!actionLoading}
                  onClick={() => doAction("stop")}
                  title="Stop"
                >
                  {actionLoading === "stop" ? "⏳" : "⏹"}{" "}
                  <span className="hide-on-mobile">Stop</span>
                </button>
                <button
                  className="btn btn-ghost btn-icon-mobile"
                  disabled={!!actionLoading}
                  onClick={() => doAction("restart")}
                  title="Restart"
                >
                  {actionLoading === "restart" ? "⏳" : "🔄"}{" "}
                  <span className="hide-on-mobile">Restart</span>
                </button>
              </>
            ) : (
              <button
                className="btn btn-success btn-icon-mobile"
                disabled={!!actionLoading}
                onClick={() => doAction("start")}
                title="Start"
              >
                {actionLoading === "start" ? "⏳" : "▶"}{" "}
                <span className="hide-on-mobile">Start</span>
              </button>
            )}
            <button
              className="btn btn-danger btn-icon-mobile"
              disabled={!!actionLoading}
              onClick={() => setConfirmRemove(true)}
              title="Remove"
            >
              🗑 <span className="hide-on-mobile">Remove</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar for running containers */}
      {isRunning && stats && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card blue">
            <div className="stat-card-header">
              <div className="stat-icon blue">⚡</div>
            </div>
            <div className="stat-value">{stats.cpu}%</div>
            <div className="stat-label">CPU Usage</div>
            <div className="stat-bar-container">
              <div
                className="stat-bar blue"
                style={{ width: `${Math.min(parseFloat(stats.cpu), 100)}%` }}
              />
            </div>
          </div>
          <div className="stat-card purple">
            <div className="stat-card-header">
              <div className="stat-icon purple">🧠</div>
            </div>
            <div className="stat-value">{stats.memoryPercent}%</div>
            <div className="stat-label">
              Memory · {formatBytes(stats.memory)} /{" "}
              {formatBytes(stats.memoryLimit)}
            </div>
            <div className="stat-bar-container">
              <div
                className="stat-bar blue"
                style={{
                  width: `${Math.min(parseFloat(stats.memoryPercent), 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="stat-card green">
            <div className="stat-card-header">
              <div className="stat-icon green">📡</div>
            </div>
            <div className="stat-value">{formatBytes(stats.netIn)}</div>
            <div className="stat-label">
              Network In · Out: {formatBytes(stats.netOut)}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="card">
        <div className="detail-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`detail-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="detail-content">
          {activeTab === "overview" && (
            <div className="detail-grid">
              <span className="detail-key">Container ID</span>
              <span
                className="detail-value"
                style={{ fontFamily: "monospace", fontSize: 12 }}
              >
                {container.Id}
              </span>

              <span className="detail-key">Image</span>
              <span className="detail-value">{config.Image}</span>

              <span className="detail-key">Image ID</span>
              <span
                className="detail-value"
                style={{ fontFamily: "monospace", fontSize: 12 }}
              >
                {container.Image}
              </span>

              <span className="detail-key">Command</span>
              <span
                className="detail-value"
                style={{ fontFamily: "monospace" }}
              >
                {config.Cmd?.join(" ") || config.Entrypoint?.join(" ") || "—"}
              </span>

              <span className="detail-key">Entrypoint</span>
              <span
                className="detail-value"
                style={{ fontFamily: "monospace" }}
              >
                {config.Entrypoint?.join(" ") || "—"}
              </span>

              <span className="detail-key">Working Dir</span>
              <span className="detail-value">{config.WorkingDir || "/"}</span>

              <span className="detail-key">Created</span>
              <span className="detail-value">
                {new Date(container.Created).toLocaleString()}
              </span>

              <span className="detail-key">Started</span>
              <span className="detail-value">
                {container.State?.StartedAt
                  ? new Date(container.State.StartedAt).toLocaleString()
                  : "—"}
              </span>

              {!isRunning && (
                <>
                  <span className="detail-key">Finished</span>
                  <span className="detail-value">
                    {container.State?.FinishedAt
                      ? new Date(container.State.FinishedAt).toLocaleString()
                      : "—"}
                  </span>
                  <span className="detail-key">Exit Code</span>
                  <span className="detail-value">
                    {container.State?.ExitCode}
                  </span>
                </>
              )}

              <span className="detail-key">Restart Policy</span>
              <span className="detail-value">
                {hostConfig.RestartPolicy?.Name || "no"}
                {hostConfig.RestartPolicy?.MaximumRetryCount
                  ? ` (max: ${hostConfig.RestartPolicy.MaximumRetryCount})`
                  : ""}
              </span>

              <span className="detail-key">Network Mode</span>
              <span className="detail-value">{hostConfig.NetworkMode}</span>

              <span className="detail-key">Ports</span>
              <span className="detail-value">
                {ports.length > 0
                  ? ports.map((p, i) => <div key={i}>{p}</div>)
                  : "—"}
              </span>

              <span className="detail-key">Labels</span>
              <span
                className="detail-value"
                style={{ fontSize: 12, fontFamily: "monospace" }}
              >
                {config.Labels && Object.keys(config.Labels).length > 0
                  ? Object.entries(config.Labels)
                      .slice(0, 10)
                      .map(([k, v], i) => (
                        <div key={i} style={{ marginBottom: 2 }}>
                          <span className="text-muted">{k}:</span> {v}
                        </div>
                      ))
                  : "—"}
                {config.Labels && Object.keys(config.Labels).length > 10 && (
                  <div className="text-muted">
                    ... and {Object.keys(config.Labels).length - 10} more
                  </div>
                )}
              </span>
            </div>
          )}

          {activeTab === "logs" && (
            <LogViewer containerId={id} containerName={name} />
          )}

          {activeTab === "env" && (
            <div>
              {config.Env && config.Env.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Variable</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.Env.map((env, i) => {
                      const eqIdx = env.indexOf("=");
                      const key = eqIdx >= 0 ? env.substring(0, eqIdx) : env;
                      const val = eqIdx >= 0 ? env.substring(eqIdx + 1) : "";
                      return (
                        <tr key={i}>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          >
                            {key}
                          </td>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontSize: 12,
                              wordBreak: "break-all",
                            }}
                          >
                            {val}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <p className="text-muted">No environment variables set</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "mounts" && (
            <div>
              {mounts.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Source</th>
                      <th>Destination</th>
                      <th>Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mounts.map((m, i) => (
                      <tr key={i}>
                        <td>
                          <span
                            className={`status-badge ${m.Type === "bind" ? "created" : "running"}`}
                          >
                            {m.Type}
                          </span>
                        </td>
                        <td
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                            wordBreak: "break-all",
                          }}
                        >
                          {m.Source || m.Name || "—"}
                        </td>
                        <td
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                            wordBreak: "break-all",
                          }}
                        >
                          {m.Destination}
                        </td>
                        <td className="text-sm text-muted">
                          {m.RW ? "read-write" : "read-only"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <p className="text-muted">No volumes or bind mounts</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "network" && (
            <div>
              {networks.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Network</th>
                      <th>IP Address</th>
                      <th>Gateway</th>
                      <th>MAC Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {networks.map((n, i) => (
                      <tr key={i}>
                        <td className="container-name">{n.name}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                          {n.ip || "—"}
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                          {n.gateway || "—"}
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                          {n.mac || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <p className="text-muted">No network connections</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Remove Confirmation */}
      {confirmRemove && (
        <Modal
          title="Remove Container"
          onClose={() => setConfirmRemove(false)}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmRemove(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={removeContainer}
                disabled={actionLoading === "remove"}
              >
                {actionLoading === "remove" ? "Removing..." : "Remove"}
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to remove <strong>{name}</strong>?
          </p>
          <p className="text-sm text-muted mt-4">
            This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const n = Number(bytes);
  if (isNaN(n)) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return (n / Math.pow(1024, i)).toFixed(1) + " " + sizes[i];
}
