import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { getQualityRegression } from '../api/index.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button, buttonVariants } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';
import { asList } from '../lib/normalize.js';
import { cn } from '../lib/cn.js';
import { useT } from '../lib/i18n.js';

export default function RegressionPage() {
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getQualityRegression();
      if (r.unavailable) {
        setError('接口暂不可用：GET /api/quality/regression');
        setData(null);
      } else {
        setData(r.data);
      }
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const regressions = asList(
    data?.regressions || data?.Regressions || data?.items || data?.fieldRegressions || (Array.isArray(data) ? data : []),
  );
  const summary = data?.summary || data?.Summary || data?.message || null;
  const scoreDelta = data?.scoreDelta ?? data?.ScoreDelta ?? data?.overallDelta;

  return (
    <div>
      <PageHeader
        title={t('regressionTitle') || '质量回归'}
        subtitle={t('regressionSubtitle') || '比较最近两次成功分析'}
        actions={
          <>
            <BackendStatus />
            <Link to="/analyze" className={cn(buttonVariants({ size: 'sm' }), 'no-underline')}>
              {t('goAnalyze') || '去分析'}
            </Link>
            <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              {t('refresh') || '刷新'}
            </Button>
          </>
        }
      />
      {error ? <Card className="mb-4 p-3 text-sm text-danger">{error}</Card> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">综合分变化</div>
          <div className={cn('text-2xl font-medium', scoreDelta < 0 ? 'text-danger' : scoreDelta > 0 ? 'text-ok' : '')}>
            {scoreDelta == null ? '—' : `${scoreDelta > 0 ? '+' : ''}${scoreDelta}`}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">摘要</div>
          <div className="mt-1 text-sm">{summary || (loading ? '加载中…' : data ? '见下方明细' : '需至少两次成功分析')}</div>
        </Card>
      </div>

      <TableShell>
        <Table dense>
          <THead sticky>
            <tr>
              <TH>字段 / 维度</TH>
              <TH>变更</TH>
              <TH>上次</TH>
              <TH>本次</TH>
            </tr>
          </THead>
          <TBody>
            {regressions.map((r, i) => (
              <TR key={i}>
                <TD mono className="font-medium">{r.field || r.Field || r.name || r.dimension || '—'}</TD>
                <TD muted>{r.change || r.Change || r.type || r.Type || '—'}</TD>
                <TD>{r.previous ?? r.Previous ?? r.before ?? '—'}</TD>
                <TD>{r.current ?? r.Current ?? r.after ?? '—'}</TD>
              </TR>
            ))}
            {!regressions.length ? (
              <EmptyRow colSpan={4}>
                {loading ? '加载中…' : data ? (
                  <pre className="max-h-48 overflow-auto text-left font-mono text-[11px]">{JSON.stringify(data, null, 2).slice(0, 3000)}</pre>
                ) : '暂无回归数据'}
              </EmptyRow>
            ) : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
