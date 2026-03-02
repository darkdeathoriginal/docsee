import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal";

export default function Networks() {
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDriver, setNewDriver] = useState("bridge");
  const [creating, setCreating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [removing, setRemoving] = useState({});

  useEffect(() => {
    loadNetworks();
  }, []);

  async function loadNetworks() {
    try {
      const data = await api.getNetworks();
      setNetworks(data);
    } catch (err) {
      console.error("Failed to load networks:", err);
    }
    setLoading(false);
  }

  async function createNetwork(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createNetwork(newName, newDriver);
      setShowCreate(false);
      setNewName("");
      await loadNetworks();
    } catch (err) {
      console.error("Failed to create network:", err);
    }
    setCreating(false);
  }

  async function removeNetwork(id) {
    setRemoving((prev) => ({ ...prev, [id]: true }));
    try {
      await api.removeNetwork(id);
      setConfirmRemove(null);
      await loadNetworks();
    } catch (err) {
      console.error("Failed to remove network:", err);
    }
    setRemoving((prev) => ({ ...prev, [id]: false }));
  }

  // Filter out default networks that shouldn't be removed
  const defaultNetworks = ["bridge", "host", "none"];

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
            <h2>Networks</h2>
            <p>Manage Docker networks</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            ➕ Create Network
          </button>
        </div>
      </div>

      {networks.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🌐</div>
            <h3>No networks found</h3>
            <p>Create a network for container communication</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Driver</th>
                  <th>Scope</th>
                  <th>Subnet</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((n) => {
                  const subnet = n.IPAM?.Config?.[0]?.Subnet || "—";
                  const isDefault = defaultNetworks.includes(n.Name);

                  return (
                    <tr key={n.Id}>
                      <td>
                        <span className="container-name">{n.Name}</span>
                        {isDefault && (
                          <span
                            className="text-xs text-muted"
                            style={{ marginLeft: 8 }}
                          >
                            (default)
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="container-id">
                          {n.Id?.substring(0, 12)}
                        </span>
                      </td>
                      <td className="text-sm text-muted">{n.Driver}</td>
                      <td className="text-sm text-muted">{n.Scope}</td>
                      <td className="text-sm text-muted">{subnet}</td>
                      <td>
                        <div
                          className="action-btns"
                          style={{ justifyContent: "flex-end" }}
                        >
                          {!isDefault && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setConfirmRemove(n)}
                              disabled={removing[n.Id]}
                            >
                              🗑 Remove
                            </button>
                          )}
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

      {showCreate && (
        <Modal
          title="Create Network"
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
                onClick={createNetwork}
                disabled={creating || !newName.trim()}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </>
          }
        >
          <form onSubmit={createNetwork}>
            <div className="form-group">
              <label className="form-label">Network Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="my-network"
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
          title="Remove Network"
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
                onClick={() => removeNetwork(confirmRemove.Id)}
                disabled={removing[confirmRemove.Id]}
              >
                {removing[confirmRemove.Id] ? "Removing..." : "Remove"}
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to remove network{" "}
            <strong>{confirmRemove.Name}</strong>?
          </p>
          <p className="text-sm text-muted mt-4">
            Containers attached to this network will lose connectivity.
          </p>
        </Modal>
      )}
    </div>
  );
}
