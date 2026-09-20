import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getFieldQualityByJob, listJobs } from '../api/index.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button } from '../components/ui/button.jsx';
import { Bar } from '../components/ui/progress.jsx';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';
import { SEED_FIELDS } from '../lib/mock-data.js';
import { asList, normalizeField, normalizeJob } from '../lib/normalize.js';
import { extractFieldsFromResponse } from '../lib/normalize-extract.js';
import { cn, formatPct } from '../lib/cn.js';
import { useT } from '../lib/i18n.js';

export default function FieldQuality() {
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState('');
  const [fields, setFields] = useState(SEED_FIELDS);
  const [source, setSource] = useState('demo');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await listJobs({ limit: 30 });
        if (!r.unavailable) {
          const list = asList(r.data).map(normalizeJob).filter(Boolean);
          setJobs(list);
          if (list[0]) setJobId(list[0].id);
        }
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      setLoading(true); setError('');
      try {
        const r = await getFieldQualityByJob(jobId);
        if (r.unavailable) { setSource('demo'); setFields(SEED_FIELDS); }
        else {
          setSource('api');
          const list = extractFieldsFromResponse(r.data);
          setFields(list.length ? list : []);
        }
      } catch (e) { setError(e.message); setSource('demo'); setFields(SEED_FIELDS); }
      finally { setLoading(false); }
    })();
  }, [jobId]);

  return (
    <div>
      <PageHeader
        title={t('fieldQuality')}
        subtitle={source === 'api' ? t('fieldQualitySubtitleApi') : t('fieldQualitySubtitleDemo')}
        actions={
          <>
            <BackendStatus />
            <select
              className="h-9 max-w-[220px] rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)] outline-none"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            >
              <option value="">{t('selectJob')}</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.sourceName}</option>)}
            </select>
            <Button variant="secondary" size="sm" disabled={loading}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              {loading ? t('loading') : t('synced')}
            </Button>
          </>
        }
      />
      {error ? (
        <div className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{error}</div>
      ) : null}
      <TableShell>
        <Table dense>
          <THead sticky>
            <tr>
              <TH sticky>{t('field')}</TH>
              <TH>{t('type')}</TH>
              <TH className="min-w-[9rem]">{t('coverage')}</TH>
              <TH align="right">{t('uniqueness')}</TH>
              <TH align="right">{t('validity')}</TH>
              <TH align="right">{t('outlierCount')}</TH>
            </tr>
          </THead>
          <TBody>
            {fields.map((f) => {
              const cov = f.coverage != null ? (f.coverage <= 1 ? f.coverage * 100 : f.coverage) : null;
              const uni = f.uniqueness != null ? (f.uniqueness <= 1 ? f.uniqueness * 100 : f.uniqueness) : null;
              const val = f.validity != null ? (f.validity <= 1 ? f.validity * 100 : f.validity) : null;
              return (
                <TR key={f.name}>
                  <TD sticky mono className="max-w-[12rem] truncate" title={f.name}>{f.name}</TD>
                  <TD muted className="whitespace-nowrap">{f.primaryType || '—'}</TD>
                  <TD>
                    {cov != null ? (
                      <div className="flex items-center gap-2">
                        <Bar value={cov} className="max-w-[100px]" />
                        <span className="w-12 text-right tabular-nums text-xs">{formatPct(cov / 100)}</span>
                      </div>
                    ) : '—'}
                  </TD>
                  <TD align="right" className="text-xs">{uni != null ? formatPct(uni / 100) : '—'}</TD>
                  <TD align="right" className="text-xs">{val != null ? formatPct(val / 100) : '—'}</TD>
                  <TD align="right">{f.outlierCount ?? '—'}</TD>
                </TR>
              );
            })}
            {!fields.length ? <EmptyRow colSpan={6}>{loading ? t('loading') : t('noFields')}</EmptyRow> : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
