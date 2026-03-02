import { NavLink, useLocation } from "react-router-dom";
import { api } from "../api";

export default function Sidebar() {
  const location = useLocation();

  const navItems = [
    { path: "/", icon: "📊", label: "Dashboard" },
    { path: "/containers", icon: "📦", label: "Containers" },
    { path: "/images", icon: "💿", label: "Images" },
    { path: "/volumes", icon: "💾", label: "Volumes" },
    { path: "/networks", icon: "🌐", label: "Networks" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">🐳</div>
        <div className="sidebar-brand">
          <h1>DocSee</h1>
          <p>Docker Manager</p>
        </div>
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
  );
}
