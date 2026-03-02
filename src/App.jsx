import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api";
import Sidebar from "./components/Sidebar";
import Containers from "./pages/Containers";
import Dashboard from "./pages/Dashboard";
import Images from "./pages/Images";
import Login from "./pages/Login";
import Networks from "./pages/Networks";
import Volumes from "./pages/Volumes";

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    if (!api.isAuthenticated()) {
      setChecking(false);
      return;
    }
    try {
      await api.verify();
      setAuthenticated(true);
    } catch {
      localStorage.removeItem("docsee_token");
    }
    setChecking(false);
  }

  if (checking) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--bg-primary)",
        }}
      >
        <div className="spinner" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <BrowserRouter>
        <Login onLogin={() => setAuthenticated(true)} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/containers" element={<Containers />} />
            <Route path="/images" element={<Images />} />
            <Route path="/volumes" element={<Volumes />} />
            <Route path="/networks" element={<Networks />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
