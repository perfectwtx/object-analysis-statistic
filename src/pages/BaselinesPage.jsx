import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { usePlatform } from '../lib/store.js';
import { cn, formatNumber } from '../lib/cn.js';

export default function BaselinesPage() {
  const baselines = usePlatform((s) => s.baselines);
  const source = usePlatform((s) => s.source);
  const loading = usePlatform((s) => s.loading);
  const refresh = usePlatform((s) => s.refresh);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <div>
      <PageHeader title="质量基线" subtitle={source === 'api' ? '后端基线快照。' : '演示基线 · 对接 /api/quality-baselines。'}
        actions={<><BackendStatus /><Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loading}><RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />刷新</Button></>} />
      <div className="grid gap-3 sm:grid-cols-2">
        {baselines.map((b) => (
          <Card key={b.id} className="flex items-center justify-between">
            <div><div className="text-sm font-medium">{b.name}</div><div className="mt-1 text-xs text-muted-foreground">{b.jobId || '—'}</div></div>
            <div className="text-2xl font-medium tabular-nums">{formatNumber(b.score, 1)}</div>
          </Card>
        ))}
        {!baselines.length ? <Card className="text-sm text-muted-foreground">暂无基线</Card> : null}
      </div>
    </div>
  );
}
