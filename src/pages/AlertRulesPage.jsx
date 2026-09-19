import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { usePlatform } from '../lib/store.js';
import { cn } from '../lib/cn.js';

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
      <div className="overflow-hidden rounded-xl bg-card shadow-[var(--elev)]">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">规则</th><th className="px-4 py-3 font-medium">条件</th>
            <th className="px-4 py-3 font-medium">状态</th><th className="px-4 py-3 font-medium">操作</th>
          </tr></thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id} className="border-b border-border/70 last:border-0">
                <td className="px-4 py-3">{a.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.condition}</td>
                <td className="px-4 py-3"><Badge tone={a.enabled ? 'ok' : 'neutral'}>{a.enabled ? '开启' : '关闭'}</Badge></td>
                <td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => toggleAlert(a.id)}>{a.enabled ? '关闭' : '开启'}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
