import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { usePlatform } from '../lib/store.js';
import { cn } from '../lib/cn.js';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';

export default function AlertRulesPage() {
  const alerts = usePlatform((s) => s.alerts);
  const toggleAlert = usePlatform((s) => s.toggleAlert);
  const source = usePlatform((s) => s.source);
  const loading = usePlatform((s) => s.loading);
  const refresh = usePlatform((s) => s.refresh);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <div>
      <PageHeader title="告警规则" subtitle={source === 'api' ? '后端告警规则。' : '演示规则 · 对接 /api/alert-rules。'}
        actions={<><BackendStatus /><Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loading}><RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />刷新</Button></>} />
      <TableShell>
        <Table dense>
          <THead sticky>
            <tr>
              <TH>规则</TH>
              <TH>条件</TH>
              <TH className="w-[5rem]">状态</TH>
              <TH className="w-[5rem]">操作</TH>
            </tr>
          </THead>
          <TBody>
            {alerts.map((a) => (
              <TR key={a.id}>
                <TD className="font-medium">{a.name}</TD>
                <TD mono muted className="max-w-sm truncate" title={a.condition}>{a.condition || '—'}</TD>
                <TD>
                  <Badge tone={a.enabled ? 'ok' : 'neutral'}>{a.enabled ? '开启' : '关闭'}</Badge>
                </TD>
                <TD>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => toggleAlert(a.id)}
                  >
                    {a.enabled ? '关闭' : '开启'}
                  </button>
                </TD>
              </TR>
            ))}
            {!alerts.length ? <EmptyRow colSpan={4}>暂无告警规则</EmptyRow> : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
