import { formatNumber } from '../lib/cn.js';
import { scoreTone } from './ui/progress.jsx';

export function ScoreRing({ score, size = 148, label = '综合健康分' }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  const tone = scoreTone(score);
  const color =
    tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : tone === 'danger' ? 'var(--danger)' : 'var(--primary)';

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
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm">{score >= 90 ? '健康' : score >= 80 ? '可用，仍有债' : '需要处理'}</div>
      </div>
    </div>
  );
}
