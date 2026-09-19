import { cn } from '../../lib/cn.js';

export function Bar({ value, className, tone = 'accent' }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-track', className)}>
      <div
        className={cn(
          'h-full rounded-full',
          tone === 'ok' && 'bg-ok',
          tone === 'warn' && 'bg-warn',
          tone === 'danger' && 'bg-danger',
          tone === 'accent' && 'bg-primary',
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function scoreTone(score) {
  if (score >= 90) return 'ok';
  if (score >= 80) return 'accent';
  if (score >= 70) return 'warn';
  return 'danger';
}
