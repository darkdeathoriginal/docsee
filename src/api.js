const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("docsee_token");
}

function headers() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...options.headers },
  });

  if (res.status === 401) {
    localStorage.removeItem("docsee_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  verify: () => request("/auth/verify"),

  // Containers
  getContainers: () => request("/containers"),
  startContainer: (id) =>
    request(`/containers/${id}/start`, { method: "POST" }),
  stopContainer: (id) => request(`/containers/${id}/stop`, { method: "POST" }),
  restartContainer: (id) =>
    request(`/containers/${id}/restart`, { method: "POST" }),
  removeContainer: (id, force = false) =>
    request(`/containers/${id}?force=${force}`, { method: "DELETE" }),
  inspectContainer: (id) => request(`/containers/${id}/inspect`),

  // Images
  getImages: () => request("/images"),
  removeImage: (id, force = false) =>
    request(`/images/${id}?force=${force}`, { method: "DELETE" }),

  // Volumes
  getVolumes: () => request("/volumes"),
  createVolume: (name, driver) =>
    request("/volumes", {
      method: "POST",
      body: JSON.stringify({ name, driver }),
    }),
  removeVolume: (name, force = false) =>
    request(`/volumes/${name}?force=${force}`, { method: "DELETE" }),

  // Networks
  getNetworks: () => request("/networks"),
  createNetwork: (name, driver) =>
    request("/networks", {
      method: "POST",
      body: JSON.stringify({ name, driver }),
    }),
  removeNetwork: (id) => request(`/networks/${id}`, { method: "DELETE" }),

  // System
  getSystemInfo: () => request("/system/info"),
  getVersion: () => request("/system/version"),
  getDiskUsage: () => request("/system/df"),

  // SSE helpers
  streamLogs: (id) => {
    const token = getToken();
    return new EventSource(`${API_BASE}/containers/${id}/logs?token=${token}`);
  },

  streamStats: (id) => {
    const token = getToken();
    return new EventSource(`${API_BASE}/containers/${id}/stats?token=${token}`);
  },

  streamSystemStats: () => {
    const token = getToken();
    return new EventSource(`${API_BASE}/system/stats?token=${token}`);
  },

  // PM2
  getPm2Processes: () => request("/pm2"),
  pm2Describe: (id) => request(`/pm2/${id}/describe`),
  pm2Start: (id) => request(`/pm2/${id}/start`, { method: "POST" }),
  pm2Stop: (id) => request(`/pm2/${id}/stop`, { method: "POST" }),
  pm2Restart: (id) => request(`/pm2/${id}/restart`, { method: "POST" }),
  pm2Reload: (id) => request(`/pm2/${id}/reload`, { method: "POST" }),
  pm2Delete: (id) => request(`/pm2/${id}`, { method: "DELETE" }),
  pm2Logs: (id, lines = 100) => request(`/pm2/${id}/logs?lines=${lines}`),
  pm2Flush: (id) => request(`/pm2/${id}/flush`, { method: "POST" }),
  streamPm2Stats: () => {
    const token = getToken();
    return new EventSource(`${API_BASE}/pm2/stream/stats?token=${token}`);
  },

  // Pull with SSE (returns EventSource-like interface)
  pullImage: (image) => {
    const token = getToken();
    return fetch(`${API_BASE}/images/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ image }),
    });
  },

  getToken,

  isAuthenticated: () => {
    return !!getToken();
  },

  logout: () => {
    localStorage.removeItem("docsee_token");
    window.location.href = "/login";
  },
};
