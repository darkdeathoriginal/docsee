import { useEffect, useState } from "react";
import { api } from "../api";
import LogViewer from "../components/LogViewer";
import Modal from "../components/Modal";

export default function Containers() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [detailTab, setDetailTab] = useState("logs");
  const [inspectData, setInspectData] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadContainers();
    const interval = setInterval(loadContainers, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadContainers() {
    try {
      const data = await api.getContainers();
      setContainers(data);
    } catch (err) {
      console.error("Failed to load containers:", err);
    }
    setLoading(false);
  }

  async function doAction(id, action) {
    setActionLoading((prev) => ({ ...prev, [id]: action }));
    try {
      if (action === "start") await api.startContainer(id);
      if (action === "stop") await api.stopContainer(id);
      if (action === "restart") await api.restartContainer(id);
      await loadContainers();
    } catch (err) {
      console.error(`Failed to ${action} container:`, err);
    }
    setActionLoading((prev) => ({ ...prev, [id]: null }));
  }

  async function removeContainer(id) {
    setActionLoading((prev) => ({ ...prev, [id]: "remove" }));
    try {
      await api.removeContainer(id, true);
      setConfirmRemove(null);
      await loadContainers();
    } catch (err) {
      console.error("Failed to remove container:", err);
    }
    setActionLoading((prev) => ({ ...prev, [id]: null }));
  }

  async function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null);
      setInspectData(null);
      return;
    }
    setExpandedId(id);
    setDetailTab("logs");
    try {
      const data = await api.inspectContainer(id);
      setInspectData(data);
    } catch {
      /* ignore */
    }
  }

  const filtered = containers.filter((c) => {
    if (filter === "running") return c.State === "running";
    if (filter === "stopped") return c.State === "exited";
    return true;
  });

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Containers</h2>
            <p>Manage your Docker containers</p>
          </div>
          <div className="flex gap-2">
            {["all", "running", "stopped"].map((f) => (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === "all"
                  ? ` (${containers.length})`
                  : f === "running"
                    ? ` (${containers.filter((c) => c.State === "running").length})`
                    : ` (${containers.filter((c) => c.State === "exited").length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3>No containers found</h3>
            <p>No {filter !== "all" ? filter : ""} containers on this host</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Image</th>
                  <th>Status</th>
                  <th>Ports</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const name = (c.Names?.[0] || "").replace(/^\//, "");
                  const isRunning = c.State === "running";
                  const shortId = c.Id.substring(0, 12);

                  return (
                    <>
                      <tr
                        key={c.Id}
                        style={{ cursor: "pointer" }}
                        onClick={() => toggleExpand(c.Id)}
                      >
                        <td>
                          <div className="container-name">
                            {name || shortId}
                          </div>
                          <div className="container-id">{shortId}</div>
                        </td>
                        <td>
                          <span className="truncate" title={c.Image}>
                            {c.Image}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${c.State}`}>
                            <span className="status-dot" />
                            {c.State}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-muted">
                            {formatPorts(c.Ports)}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-muted">
                            {timeAgo(c.Created)}
                          </span>
                        </td>
                        <td>
                          <div
                            className="action-btns"
                            style={{ justifyContent: "flex-end" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isRunning ? (
                              <>
                                <button
                                  className="btn btn-ghost btn-icon btn-sm"
                                  title="Stop"
                                  disabled={!!actionLoading[c.Id]}
                                  onClick={() => doAction(c.Id, "stop")}
                                >
                                  ⏹
                                </button>
                                <button
                                  className="btn btn-ghost btn-icon btn-sm"
                                  title="Restart"
                                  disabled={!!actionLoading[c.Id]}
                                  onClick={() => doAction(c.Id, "restart")}
                                >
                                  🔄
                                </button>
                              </>
                            ) : (
                              <button
                                className="btn btn-success btn-icon btn-sm"
                                title="Start"
                                disabled={!!actionLoading[c.Id]}
                                onClick={() => doAction(c.Id, "start")}
                              >
                                ▶
                              </button>
                            )}
                            <button
                              className="btn btn-danger btn-icon btn-sm"
                              title="Remove"
                              disabled={!!actionLoading[c.Id]}
                              onClick={() => setConfirmRemove(c)}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === c.Id && (
                        <tr key={`${c.Id}-detail`}>
                          <td colSpan="6" style={{ padding: 0 }}>
                            <div className="detail-panel">
                              <div className="detail-tabs">
                                <button
                                  className={`detail-tab ${detailTab === "logs" ? "active" : ""}`}
                                  onClick={() => setDetailTab("logs")}
                                >
                                  📋 Logs
                                </button>
                                <button
                                  className={`detail-tab ${detailTab === "inspect" ? "active" : ""}`}
                                  onClick={() => setDetailTab("inspect")}
                                >
                                  🔍 Inspect
                                </button>
                              </div>
                              <div className="detail-content">
                                {detailTab === "logs" && (
                                  <LogViewer
                                    containerId={c.Id}
                                    containerName={name}
                                  />
                                )}
                                {detailTab === "inspect" && inspectData && (
                                  <div className="detail-grid">
                                    <span className="detail-key">ID</span>
                                    <span className="detail-value">
                                      {inspectData.Id}
                                    </span>

                                    <span className="detail-key">Image</span>
                                    <span className="detail-value">
                                      {inspectData.Config?.Image}
                                    </span>

                                    <span className="detail-key">Command</span>
                                    <span
                                      className="detail-value"
                                      style={{ fontFamily: "monospace" }}
                                    >
                                      {inspectData.Config?.Cmd?.join(" ") ||
                                        inspectData.Config?.Entrypoint?.join(
                                          " ",
                                        )}
                                    </span>

                                    <span className="detail-key">
                                      Working Dir
                                    </span>
                                    <span className="detail-value">
                                      {inspectData.Config?.WorkingDir || "/"}
                                    </span>

                                    <span className="detail-key">
                                      Network Mode
                                    </span>
                                    <span className="detail-value">
                                      {inspectData.HostConfig?.NetworkMode}
                                    </span>

                                    <span className="detail-key">
                                      Restart Policy
                                    </span>
                                    <span className="detail-value">
                                      {
                                        inspectData.HostConfig?.RestartPolicy
                                          ?.Name
                                      }
                                    </span>

                                    <span className="detail-key">Created</span>
                                    <span className="detail-value">
                                      {new Date(
                                        inspectData.Created,
                                      ).toLocaleString()}
                                    </span>

                                    {inspectData.Config?.Env && (
                                      <>
                                        <span className="detail-key">
                                          Env Vars
                                        </span>
                                        <span
                                          className="detail-value"
                                          style={{
                                            fontSize: "12px",
                                            fontFamily: "monospace",
                                          }}
                                        >
                                          {inspectData.Config.Env.slice(
                                            0,
                                            10,
                                          ).map((env, i) => (
                                            <div key={i}>{env}</div>
                                          ))}
                                          {inspectData.Config.Env.length >
                                            10 && (
                                            <div className="text-muted">
                                              ... and{" "}
                                              {inspectData.Config.Env.length -
                                                10}{" "}
                                              more
                                            </div>
                                          )}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmRemove && (
        <Modal
          title="Remove Container"
          onClose={() => setConfirmRemove(null)}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmRemove(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => removeContainer(confirmRemove.Id)}
                disabled={!!actionLoading[confirmRemove.Id]}
              >
                {actionLoading[confirmRemove.Id] === "remove"
                  ? "Removing..."
                  : "Remove"}
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to remove container{" "}
            <strong>
              {(confirmRemove.Names?.[0] || "").replace(/^\//, "")}
            </strong>
            ?
          </p>
          <p className="text-sm text-muted mt-4">
            This action cannot be undone. The container will be force-removed.
          </p>
        </Modal>
      )}
    </div>
  );
}

function formatPorts(ports) {
  if (!ports || ports.length === 0) return "—";
  return (
    ports
      .filter((p) => p.PublicPort)
      .map((p) => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`)
      .join(", ") || "—"
  );
}

function timeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
