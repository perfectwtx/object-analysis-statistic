import { cn } from '../../lib/cn.js';

export function Badge({ className, tone = 'neutral', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
        tone === 'ok' && 'bg-ok/15 text-ok',
        tone === 'warn' && 'bg-warn/15 text-warn',
        tone === 'danger' && 'bg-danger/15 text-danger',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function severityTone(s) {
  if (s === 'critical' || s === 'high') return 'danger';
  if (s === 'medium') return 'warn';
  return 'neutral';
}
