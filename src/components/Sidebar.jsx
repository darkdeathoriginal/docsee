import { NavLink, useLocation } from "react-router-dom";
import { api } from "../api";

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();

  const navItems = [
    { path: "/", icon: "📊", label: "Dashboard" },
    { path: "/containers", icon: "📦", label: "Containers" },
    { path: "/images", icon: "💿", label: "Images" },
    { path: "/volumes", icon: "💾", label: "Volumes" },
    { path: "/networks", icon: "🌐", label: "Networks" },
    { path: "/pm2", icon: "⚙️", label: "PM2" },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">🐳</div>
          <div className="sidebar-brand">
            <h1>DocSee</h1>
            <p>Docker Manager</p>
          </div>
          <button className="sidebar-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive && (item.path === "/" ? location.pathname === "/" : true) ? "active" : ""}`
              }
              end={item.path === "/"}
              onClick={onClose}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={() => api.logout()}>
            <span className="nav-icon">🚪</span>
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
