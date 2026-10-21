import { useT } from '../../lib/i18n.js';
export default function LoadingBlock({ label }) {
  const { t } = useT();
  return (
    <div role="status" aria-live="polite" className="loading-block">
      <span className="spinner" />
      <span>{label ?? t('loading')}</span>
    </div>
  );
}
