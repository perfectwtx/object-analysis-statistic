import { useT } from '../../lib/i18n.js';
export default function EmptyState({ title, description, action }) {
  const { t } = useT();
  return (
    <div role="status" className="empty-state-card">
      <div className="empty-state-title">{title ?? t('noData')}</div>
      {description && <p className="empty-state-desc">{description}</p>}
      {action}
    </div>
  );
}
