import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal";

export default function Images() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPull, setShowPull] = useState(false);
  const [pullImage, setPullImage] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState([]);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [removing, setRemoving] = useState({});

  useEffect(() => {
    loadImages();
  }, []);

  async function loadImages() {
    try {
      const data = await api.getImages();
      setImages(data);
    } catch (err) {
      console.error("Failed to load images:", err);
    }
    setLoading(false);
  }

  async function handlePull(e) {
    e.preventDefault();
    if (!pullImage.trim()) return;
    setPulling(true);
    setPullProgress([]);

    try {
      const res = await api.pullImage(pullImage);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.complete) {
                setPullProgress((prev) => [...prev, "✅ Pull complete!"]);
                await loadImages();
              } else if (data.error) {
                setPullProgress((prev) => [...prev, `❌ Error: ${data.error}`]);
              } else if (data.status) {
                const msg = data.id
                  ? `${data.id}: ${data.status} ${data.progress || ""}`
                  : data.status;
                setPullProgress((prev) => {
                  const next = [...prev];
                  const idx = next.findIndex((l) =>
                    l.startsWith(data.id + ":"),
                  );
                  if (idx >= 0 && data.id) {
                    next[idx] = msg;
                  } else {
                    next.push(msg);
                  }
                  return next.slice(-20);
                });
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch (err) {
      setPullProgress((prev) => [...prev, `❌ Error: ${err.message}`]);
    }
    setPulling(false);
  }

  async function removeImage(id) {
    setRemoving((prev) => ({ ...prev, [id]: true }));
    try {
      await api.removeImage(id, true);
      setConfirmRemove(null);
      await loadImages();
    } catch (err) {
      console.error("Failed to remove image:", err);
    }
    setRemoving((prev) => ({ ...prev, [id]: false }));
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
            <h2>Images</h2>
            <p>Manage your Docker images</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowPull(true)}>
            ⬇️ Pull Image
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">💿</div>
            <h3>No images found</h3>
            <p>Pull an image to get started</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repository / Tag</th>
                  <th>ID</th>
                  <th>Size</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {images.map((img) => {
                  const tag = img.RepoTags?.[0] || "<none>:<none>";
                  const shortId = (img.Id || "")
                    .replace("sha256:", "")
                    .substring(0, 12);

                  return (
                    <tr key={img.Id}>
                      <td>
                        <span className="container-name">{tag}</span>
                      </td>
                      <td>
                        <span className="container-id">{shortId}</span>
                      </td>
                      <td className="text-sm text-muted">
                        {formatBytes(img.Size)}
                      </td>
                      <td className="text-xs text-muted">
                        {new Date(img.Created * 1000).toLocaleDateString()}
                      </td>
                      <td>
                        <div
                          className="action-btns"
                          style={{ justifyContent: "flex-end" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="btn btn-danger btn-icon btn-sm"
                            title="Remove"
                            disabled={removing[img.Id]}
                            onClick={() => setConfirmRemove(img)}
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

      {showPull && (
        <Modal
          title="Pull Image"
          onClose={() => {
            setShowPull(false);
            setPullProgress([]);
          }}
          footer={
            !pulling && (
              <>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowPull(false);
                    setPullProgress([]);
                  }}
                >
                  Close
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handlePull}
                  disabled={!pullImage.trim()}
                >
                  Pull
                </button>
              </>
            )
          }
        >
          <form onSubmit={handlePull}>
            <div className="form-group">
              <label className="form-label">Image Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. nginx:latest, ubuntu:22.04"
                value={pullImage}
                onChange={(e) => setPullImage(e.target.value)}
                disabled={pulling}
                autoFocus
              />
            </div>
          </form>
          {pullProgress.length > 0 && (
            <div className="pull-progress">
              {pullProgress.map((line, i) => (
                <div key={i} className="pull-progress-line">
                  {line}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {confirmRemove && (
        <Modal
          title="Remove Image"
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
                onClick={() => removeImage(confirmRemove.Id)}
                disabled={removing[confirmRemove.Id]}
              >
                {removing[confirmRemove.Id] ? "Removing..." : "Remove"}
              </button>
            </>
          }
        >
          <p>
            Are you sure you want to remove image{" "}
            <strong>{confirmRemove.RepoTags?.[0] || "unknown"}</strong>?
          </p>
          <p className="text-sm text-muted mt-4">
            This will force-remove the image.
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
