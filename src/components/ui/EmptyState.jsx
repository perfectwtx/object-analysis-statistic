export default function EmptyState({ title = '暂无数据', description, action }) {
  return (
    <div className="empty-state-card">
      <div className="empty-state-title">{title}</div>
      {description && <p className="empty-state-desc">{description}</p>}
      {action}
    </div>
  );
}
