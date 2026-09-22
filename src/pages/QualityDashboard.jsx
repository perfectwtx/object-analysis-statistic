import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Trash2 } from 'lucide-react';
import { DimBars } from '../components/DimBars.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button, buttonVariants } from '../components/ui/button.jsx';
import { Card, CardHint, CardTitle } from '../components/ui/card.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { usePlatform } from '../lib/store.js';
import { cn, formatNumber } from '../lib/cn.js';
import { t } from '../lib/i18n.js';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';
import { deleteJob, loadLastJobId, clearLastJobId } from '../api/index.js';

export default function QualityDashboard() {
  const jobs = usePlatform((s) => s.jobs);
  const dims = usePlatform((s) => s.dims);
  const score = usePlatform((s) => s.score);
  const source = usePlatform((s) => s.source);
  const loading = usePlatform((s) => s.loading);
  const refresh = usePlatform((s) => s.refresh);
  const removeJobLocal = usePlatform((s) => s.removeJobLocal);
  const locale = usePlatform((s) => s.locale);
  const [deletingId, setDeletingId] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');
  const [pendingJob, setPendingJob] = useState(null);

  useEffect(() => { refresh(); }, [refresh]);

  async function performDelete(job) {
    const id = job?.id;
    if (!id) return;
    setDeletingId(id);
    setDeleteMsg('');
    try {
      const r = await deleteJob(id);
      if (r.unavailable) {
        setDeleteMsg(t(locale, 'deleteJobUnavailable'));
        return;
      }
      removeJobLocal(id);
      if (loadLastJobId() === String(id)) clearLastJobId();
      setDeleteMsg(t(locale, 'deleteJobOk'));
      try { await refresh(); } catch { /* ignore */ }
    } catch (e) {
      const msg = e.status === 405
        ? t(locale, 'deleteJobUnavailable')
        : `${t(locale, 'deleteJobFail')}: ${e.message || e}`;
      setDeleteMsg(msg);
    } finally {
      setDeletingId('');
      setPendingJob(null);
    }
  }

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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">{t(locale, 'recentJobs')}</h2>
          <Link to="/analyze" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}>{t(locale, 'newAnalyze')}</Link>
        </div>
        {deleteMsg ? (
          <p className="mb-2 text-xs text-muted-foreground">{deleteMsg}</p>
        ) : null}
        <TableShell>
          <Table dense>
            <THead sticky>
              <tr>
                <TH>{t(locale, 'source')}</TH>
                <TH>{t(locale, 'status')}</TH>
                <TH align="right">{t(locale, 'rows')}</TH>
                <TH align="right">{t(locale, 'score')}</TH>
                <TH align="right">{t(locale, 'issueCount')}</TH>
                <TH align="right">{t(locale, 'actions')}</TH>
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
                  <TD align="right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-red-500"
                      disabled={deletingId === j.id || loading}
                      title={t(locale, 'deleteJob')}
                      onClick={() => setPendingJob(j)}
                    >
                      <Trash2 className={cn('size-3.5', deletingId === j.id && 'animate-pulse')} />
                      <span className="sr-only sm:not-sr-only sm:ml-1">{t(locale, 'deleteJob')}</span>
                    </Button>
                  </TD>
                </TR>
              ))}
              {!jobs.length ? <EmptyRow colSpan={6}>{t(locale, 'noData')}</EmptyRow> : null}
            </TBody>
          </Table>
        </TableShell>
      </div>

      <ConfirmDialog
        open={!!pendingJob}
        onClose={() => !deletingId && setPendingJob(null)}
        onConfirm={() => performDelete(pendingJob)}
        title={t(locale, 'deleteJob')}
        description={
          pendingJob
            ? `${t(locale, 'deleteJobConfirm')}${pendingJob.sourceName ? `\n「${pendingJob.sourceName}」` : ''}`
            : t(locale, 'deleteJobConfirm')
        }
        confirmLabel={t(locale, 'confirmDelete')}
        cancelLabel={t(locale, 'confirmCancel')}
        variant="danger"
        loading={!!deletingId}
      />
    </div>
  );
}
