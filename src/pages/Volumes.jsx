import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal";

export default function Volumes() {
  const [volumes, setVolumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDriver, setNewDriver] = useState("local");
  const [creating, setCreating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [removing, setRemoving] = useState({});

  useEffect(() => {
    loadVolumes();
  }, []);

  async function loadVolumes() {
    try {
      const data = await api.getVolumes();
      setVolumes(data);
    } catch (err) {
      console.error("Failed to load volumes:", err);
    }
    setLoading(false);
  }

  async function createVolume(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createVolume(newName, newDriver);
      setShowCreate(false);
      setNewName("");
      await loadVolumes();
    } catch (err) {
      console.error("Failed to create volume:", err);
    }
    setCreating(false);
  }

  async function removeVolume(name) {
    setRemoving((prev) => ({ ...prev, [name]: true }));
    try {
      await api.removeVolume(name, true);
      setConfirmRemove(null);
      await loadVolumes();
    } catch (err) {
      console.error("Failed to remove volume:", err);
    }
    setRemoving((prev) => ({ ...prev, [name]: false }));
  }

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
            <h2>Volumes</h2>
            <p>Manage Docker volumes</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            ➕ Create Volume
          </button>
        </div>
      </div>

      {volumes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">💾</div>
            <h3>No volumes found</h3>
            <p>Create a volume to persist data</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Driver</th>
                  <th>Mount Point</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {volumes.map((v) => (
                  <tr key={v.Name}>
                    <td>
                      <span className="container-name">{v.Name}</span>
                    </td>
                    <td className="text-sm text-muted">{v.Driver}</td>
                    <td>
                      <span
                        className="text-xs text-muted truncate"
                        title={v.Mountpoint}
                      >
                        {v.Mountpoint}
                      </span>
                    </td>
                    <td className="text-xs text-muted">
                      {v.CreatedAt
                        ? new Date(v.CreatedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      <div
                        className="action-btns"
                        style={{ justifyContent: "flex-end" }}
                      >
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setConfirmRemove(v)}
                          disabled={removing[v.Name]}
                        >
                          🗑 Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <Modal
          title="Create Volume"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={createVolume}
                disabled={creating || !newName.trim()}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </>
          }
        >
          <form onSubmit={createVolume}>
            <div className="form-group">
              <label className="form-label">Volume Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="my-volume"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Driver</label>
              <input
                type="text"
                className="form-input"
                value={newDriver}
                onChange={(e) => setNewDriver(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}

      {confirmRemove && (
        <Modal
          title="Remove Volume"
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
                onClick={() => removeVolume(confirmRemove.Name)}
                disabled={removing[confirmRemove.Name]}
              >
                {removing[confirmRemove.Name] ? "Removing..." : "Remove"}
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to remove volume{" "}
            <strong>{confirmRemove.Name}</strong>?
          </p>
          <p className="text-sm text-muted mt-4">
            Any data stored in this volume will be lost.
          </p>
        </Modal>
      )}
    </div>
  );
}
