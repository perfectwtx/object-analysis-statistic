import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { DimBars } from '../components/DimBars.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button, buttonVariants } from '../components/ui/button.jsx';
import { Card, CardHint, CardTitle } from '../components/ui/card.jsx';
import { usePlatform } from '../lib/store.js';
import { cn, formatNumber } from '../lib/cn.js';
import { t } from '../lib/i18n.js';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';

export default function QualityDashboard() {
  const jobs = usePlatform((s) => s.jobs);
  const dims = usePlatform((s) => s.dims);
  const score = usePlatform((s) => s.score);
  const source = usePlatform((s) => s.source);
  const loading = usePlatform((s) => s.loading);
  const refresh = usePlatform((s) => s.refresh);
  const locale = usePlatform((s) => s.locale);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div>
      <PageHeader
        title={t(locale, 'qualityTitle')}
        subtitle={source === 'api' ? t(locale, 'qualitySubtitleApi') : t(locale, 'qualitySubtitleDemo')}
        actions={
          <>
            <BackendStatus />
            <Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              {t(locale, 'refresh')}
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6"><ScoreRing score={score ?? 0} label={t(locale, 'qualityTitle')} /></Card>
        <Card>
          <CardTitle>{t(locale, 'dimDetail')}</CardTitle>
          <CardHint>{t(locale, 'dimDetailHint')}</CardHint>
          <div className="mt-5"><DimBars dims={dims} /></div>
        </Card>
      </div>
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">{t(locale, 'recentJobs')}</h2>
          <Link to="/analyze" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}>{t(locale, 'newAnalyze')}</Link>
        </div>
        <TableShell>
          <Table dense>
            <THead sticky>
              <tr>
                <TH>{t(locale, 'source')}</TH>
                <TH>{t(locale, 'status')}</TH>
                <TH align="right">{t(locale, 'rows')}</TH>
                <TH align="right">{t(locale, 'score')}</TH>
                <TH align="right">{t(locale, 'issueCount')}</TH>
              </tr>
            </THead>
            <TBody>
              {jobs.map((j) => (
                <TR key={j.id}>
                  <TD mono className="max-w-[14rem] truncate" title={j.sourceName}>{j.sourceName}</TD>
                  <TD muted className="capitalize whitespace-nowrap">{j.status}</TD>
                  <TD align="right">{j.rows ?? '—'}</TD>
                  <TD align="right">{j.score != null ? formatNumber(j.score, 1) : '—'}</TD>
                  <TD align="right">{j.issueCount ?? '—'}</TD>
                </TR>
              ))}
              {!jobs.length ? <EmptyRow colSpan={5}>{t(locale, 'noData')}</EmptyRow> : null}
            </TBody>
          </Table>
        </TableShell>
      </div>
    </div>
  );
}
