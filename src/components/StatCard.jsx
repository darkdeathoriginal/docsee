export default function StatCard({ icon, value, label, color = "blue" }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-card-header">
        <div className={`stat-icon ${color}`}>{icon}</div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
