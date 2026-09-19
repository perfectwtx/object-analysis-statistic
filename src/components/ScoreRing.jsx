import { formatNumber } from '../lib/cn.js';
import { scoreTone } from './ui/progress.jsx';
import { useT } from '../lib/i18n.js';

export function ScoreRing({ score, size = 148, label }) {
  const { t } = useT();
  const displayLabel = label ?? t('healthScore');
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  const tone = scoreTone(score);
  const color =
    tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : tone === 'danger' ? 'var(--danger)' : 'var(--primary)';
  const status =
    score >= 90 ? t('healthOk') : score >= 80 ? `${t('scoreUsable')} · ${t('healthWarn')}` : t('healthBad');

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 128 128" className="shrink-0">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--track)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 64 64)"
        />
        <text x="64" y="62" textAnchor="middle" fill="currentColor" style={{ fontSize: 28, fontWeight: 500 }}>
          {formatNumber(score, 1)}
        </text>
        <text x="64" y="80" textAnchor="middle" fill="var(--muted-foreground)" style={{ fontSize: 10 }}>
          / 100
        </text>
      </svg>
      <div>
        <div className="text-sm text-muted-foreground">{displayLabel}</div>
        <div className="mt-1 text-sm">{status}</div>
      </div>
    </div>
  );
}
