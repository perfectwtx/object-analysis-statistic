import { cn } from '../lib/cn.js';
import { usePlatform } from '../lib/store.js';
import { useT } from '../lib/i18n.js';

export function BackendStatus({ className }) {
  const { t } = useT();
  const backendOk = usePlatform((s) => s.backendOk);
  const source = usePlatform((s) => s.source);
  const loading = usePlatform((s) => s.loading);

  const label = loading
    ? t('connecting')
    : backendOk
      ? source === 'api'
        ? t('backendOnline')
        : t('backendOnlinePartial')
      : t('backendOffline');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
        backendOk ? 'bg-ok/15 text-ok' : 'bg-muted text-muted-foreground',
        className,
      )}
      title={backendOk ? t('backendReachable') : t('backendFailHint')}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          loading ? 'animate-pulse bg-warn' : backendOk ? 'bg-ok' : 'bg-muted-foreground',
        )}
      />
      {label}
    </span>
  );
}
