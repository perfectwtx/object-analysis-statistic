import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { getRecommendations } from '../api/index.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button, buttonVariants } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';
import { extractRecommendations } from '../lib/normalize-extract.js';
import { cn } from '../lib/cn.js';
import { useT } from '../lib/i18n.js';

export default function RecommendationsPage() {
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('demo');
  const [items, setItems] = useState([]);
  const [job, setJob] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getRecommendations();
      if (r.unavailable) {
        setSource('demo');
        setItems([]);
        setError('接口暂不可用：GET /api/quality/recommendations');
      } else {
        setSource('api');
        const pack = extractRecommendations(r.data);
        setItems(pack.items);
        setJob(pack.job);
      }
    } catch (e) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const priorityTone = (p) => (p >= 3 ? 'danger' : p === 2 ? 'warn' : 'neutral');

  return (
    <div>
      <PageHeader
        title={t('recommendationsTitle') || '修复建议'}
        subtitle={
          source === 'api'
            ? (job ? `基于作业 ${job.sourceName || job.id}` : '来自最近一次成功分析')
            : '连接后端后显示建议'
        }
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
      <TableShell>
        <Table dense>
          <THead sticky>
            <tr>
              <TH>字段</TH>
              <TH>检查</TH>
              <TH className="w-[5rem]">次数</TH>
              <TH>建议动作</TH>
              <TH>规则提示</TH>
              <TH className="w-[5rem]">优先级</TH>
            </tr>
          </THead>
          <TBody>
            {items.map((it, i) => (
              <TR key={i}>
                <TD mono className="font-medium">{it.field}</TD>
                <TD muted>{it.check}</TD>
                <TD>{it.count}</TD>
                <TD className="max-w-xs">{it.action || it.message}</TD>
                <TD mono muted className="max-w-[10rem] truncate" title={it.rule}>{it.rule || '—'}</TD>
                <TD>
                  <Badge tone={priorityTone(it.priority)}>
                    {it.priorityText || it.priority}
                  </Badge>
                </TD>
              </TR>
            ))}
            {!items.length ? <EmptyRow colSpan={6}>{loading ? '加载中…' : '暂无建议'}</EmptyRow> : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
