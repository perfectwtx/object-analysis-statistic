import { Bar, scoreTone } from './ui/progress.jsx';
import { DIM_LABEL } from '../lib/mock-data.js';
import { formatNumber } from '../lib/cn.js';

export function DimBars({ dims }) {
  return (
    <ul className="grid gap-3">
      {Object.keys(DIM_LABEL).map((k) => (
        <li key={k} className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-3">
          <span className="text-sm text-muted-foreground">{DIM_LABEL[k]}</span>
          <Bar value={dims[k]} tone={scoreTone(dims[k])} />
          <span className="text-right font-mono text-xs tabular-nums">{formatNumber(dims[k], 0)}</span>
        </li>
      ))}
    </ul>
  );
}
