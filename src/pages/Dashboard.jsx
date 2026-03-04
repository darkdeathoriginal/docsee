import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import StatCard from "../components/StatCard";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [resourceStats, setResourceStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);

    // Connect to system stats SSE
    const es = api.streamSystemStats();
    eventSourceRef.current = es;
    es.onmessage = (e) => {
      try {
        setResourceStats(JSON.parse(e.data));
      } catch {}
    };
    es.onerror = () => {
      // will auto-reconnect
    };

    return () => {
      clearInterval(interval);
      es.close();
    };
  }, []);

  async function loadData() {
    try {
      const [containers, images, volumes, networks, info] = await Promise.all([
        api.getContainers(),
        api.getImages(),
        api.getVolumes(),
        api.getNetworks(),
        api.getSystemInfo(),
      ]);

      const running = containers.filter((c) => c.State === "running").length;
      const stopped = containers.filter((c) => c.State === "exited").length;

      setStats({
        totalContainers: containers.length,
        running,
        stopped,
        images: images.length,
        volumes: volumes.length,
        networks: networks.length,
      });

      setSystemInfo(info);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    }
    setLoading(false);
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
        <h2>Dashboard</h2>
        <p>Overview of your Docker environment</p>
      </div>

      <div className="stats-grid">
        <StatCard
          icon="📦"
          value={stats?.totalContainers || 0}
          label="Total Containers"
          color="blue"
        />
        <StatCard
          icon="▶️"
          value={stats?.running || 0}
          label="Running"
          color="green"
        />
        <StatCard
          icon="⏹️"
          value={stats?.stopped || 0}
          label="Stopped"
          color="red"
        />
        <StatCard
          icon="💿"
          value={stats?.images || 0}
          label="Images"
          color="purple"
        />
        <StatCard
          icon="💾"
          value={stats?.volumes || 0}
          label="Volumes"
          color="cyan"
        />
        <StatCard
          icon="🌐"
          value={stats?.networks || 0}
          label="Networks"
          color="orange"
        />
      </div>

      {/* Resource Usage Section */}
      <div className="card" style={{ marginBottom: "28px" }}>
        <div className="card-header">
          <h3>📊 Resource Usage</h3>
          {resourceStats && (
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {resourceStats.containerCount || 0} running container
              {resourceStats.containerCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="card-body" style={{ padding: "var(--radius-lg)" }}>
          {resourceStats ? (
            <div className="resource-grid">
              <div className="resource-card">
                <div className="resource-header">
                  <span className="resource-icon cpu">⚡</span>
                  <span className="resource-title">CPU Usage</span>
                </div>
                <div className="resource-value">{resourceStats.cpu}%</div>
                <div className="resource-bar-track">
                  <div
                    className="resource-bar-fill cpu"
                    style={{
                      width: `${Math.min(parseFloat(resourceStats.cpu), 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="resource-card">
                <div className="resource-header">
                  <span className="resource-icon memory">🧠</span>
                  <span className="resource-title">Memory Usage</span>
                </div>
                <div className="resource-value">
                  {formatBytes(resourceStats.memory)}
                  <span className="resource-subvalue">
                    {" "}
                    / {formatBytes(resourceStats.memoryLimit)}
                  </span>
                </div>
                <div className="resource-bar-track">
                  <div
                    className="resource-bar-fill memory"
                    style={{
                      width: `${Math.min(parseFloat(resourceStats.memoryPercent), 100)}%`,
                    }}
                  />
                </div>
                <div className="resource-percent">
                  {resourceStats.memoryPercent}%
                </div>
              </div>

              <div className="resource-card">
                <div className="resource-header">
                  <span className="resource-icon network">🌐</span>
                  <span className="resource-title">Network I/O</span>
                </div>
                <div className="resource-net">
                  <div className="resource-net-item">
                    <span className="resource-net-label">▼ IN</span>
                    <span className="resource-net-value">
                      {formatBytes(resourceStats.netIn)}
                    </span>
                  </div>
                  <div className="resource-net-item">
                    <span className="resource-net-label">▲ OUT</span>
                    <span className="resource-net-value">
                      {formatBytes(resourceStats.netOut)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                color: "var(--text-muted)",
                padding: "20px",
              }}
            >
              Loading resource stats...
            </div>
          )}
        </div>
      </div>

      {systemInfo && (
        <div className="card">
          <div className="card-header">
            <h3>🖥️ System Information</h3>
          </div>
          <div className="card-body" style={{ padding: "var(--radius-lg)" }}>
            <div className="detail-grid">
              <span className="detail-key">Docker Version</span>
              <span className="detail-value">{systemInfo.ServerVersion}</span>

              <span className="detail-key">OS</span>
              <span className="detail-value">{systemInfo.OperatingSystem}</span>

              <span className="detail-key">Architecture</span>
              <span className="detail-value">{systemInfo.Architecture}</span>

              <span className="detail-key">Kernel</span>
              <span className="detail-value">{systemInfo.KernelVersion}</span>

              <span className="detail-key">CPUs</span>
              <span className="detail-value">{systemInfo.NCPU}</span>

              <span className="detail-key">Memory</span>
              <span className="detail-value">
                {formatBytes(systemInfo.MemTotal)}
              </span>

              <span className="detail-key">Storage Driver</span>
              <span className="detail-value">{systemInfo.Driver}</span>

              <span className="detail-key">Name</span>
              <span className="detail-value">{systemInfo.Name}</span>
            </div>
          </div>
        </div>
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
