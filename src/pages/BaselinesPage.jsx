import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { usePlatform } from '../lib/store.js';
import { cn, formatNumber } from '../lib/cn.js';
import { useT } from '../lib/i18n.js';

export default function BaselinesPage() {
  const { t } = useT();
  const baselines = usePlatform((s) => s.baselines);
  const source = usePlatform((s) => s.source);
  const loading = usePlatform((s) => s.loading);
  const refresh = usePlatform((s) => s.refresh);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <div>
      <PageHeader
        title={t('baselinesTitle')}
        subtitle={source === 'api' ? t('baselinesSubtitleApi') : t('baselinesSubtitleDemo')}
        actions={
          <>
            <BackendStatus />
            <Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              {t('refresh')}
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {baselines.map((b) => (
          <Card key={b.id} className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{b.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{b.jobId || '—'}</div>
            </div>
            <div className="text-2xl font-medium tabular-nums">{formatNumber(b.score, 1)}</div>
          </Card>
        ))}
        {!baselines.length ? <Card className="text-sm text-muted-foreground">{t('noBaselines')}</Card> : null}
      </div>
    </div>
  );
}
