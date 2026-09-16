import { useEffect, useState } from 'react';
import { listAlertRules, listWebhookDeliveries } from '../api/index.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import LoadingBlock from '../components/ui/LoadingBlock.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import ApiUnavailable from '../components/ui/ApiUnavailable.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function AlertRulesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [rules, setRules] = useState([]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const r = await listAlertRules();
      if (r.unavailable) { setUnavailable(true); setRules([]); }
      else { setUnavailable(false); setRules(Array.isArray(r.data) ? r.data : r.data?.items || []); }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="page">
      <PageHeader title="Alert Rules" subtitle="质量告警规则" />
      <ErrorBanner message={error} onRetry={load} />
      {loading && <LoadingBlock />}
      {!loading && unavailable && <ApiUnavailable feature="告警规则" endpoint="GET /api/alert-rules" />}
      {!loading && !unavailable && !rules.length && <EmptyState title="暂无告警规则" />}
      {!loading && rules.length > 0 && (
        <div className="panel">
          <table className="data-table">
            <thead><tr><th>名称</th><th>启用</th><th>指标</th><th>阈值</th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id || r.Id}>
                  <td>{r.name || r.Name}</td>
                  <td>{(r.enabled ?? r.Enabled) ? '是' : '否'}</td>
                  <td>{r.metric || r.Metric || '—'}</td>
                  <td>{r.threshold ?? r.Threshold ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
