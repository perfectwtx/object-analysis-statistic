import { useT } from '../../lib/i18n.js';
export default function ErrorBanner({ message, onRetry }) {
  const { t } = useT();
  if (!message) return null;
  return (
    <div role="alert" className="error-banner">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn-link" onClick={onRetry}>{t('retry')}</button>
      )}
    </div>
  );
}
