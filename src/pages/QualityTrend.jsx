import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getQualityTrend, listQualitySnapshots } from '../api/index.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import LoadingBlock from '../components/ui/LoadingBlock.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import ApiUnavailable from '../components/ui/ApiUnavailable.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function QualityTrend() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [points, setPoints] = useState([]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      let res = await getQualityTrend({ limit: 50 });
      if (res.unavailable) res = await listQualitySnapshots({ limit: 50 });
      if (res.unavailable) { setUnavailable(true); setPoints([]); }
      else {
        setUnavailable(false);
        const raw = Array.isArray(res.data) ? res.data : res.data?.points || res.data?.items || [];
        setPoints(raw.map((p, i) => ({
          label: (p.capturedAtUtc || p.date || `#${i + 1}`).toString().slice(0, 16),
          overall: p.overallScore ?? p.qualityScore ?? null,
          completeness: p.completeness ?? null,
          validity: p.validity ?? null,
          uniqueness: p.uniqueness ?? null,
          consistency: p.consistency ?? null,
          anomaly: p.anomalyControl ?? null,
        })));
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const hasData = useMemo(() => points.some((p) => p.overall != null), [points]);
  if (loading) return <LoadingBlock label="加载质量趋势…" />;

  return (
    <div className="page">
      <PageHeader title="质量趋势" subtitle="综合分与五维质量" actions={<button type="button" className="btn" onClick={load}>刷新</button>} />
      <ErrorBanner message={error} onRetry={load} />
      {unavailable && <ApiUnavailable feature="质量趋势" endpoint="GET /api/quality/trend" />}
      {!unavailable && !hasData && <EmptyState title="暂无趋势数据" />}
      {!unavailable && hasData && (
        <div className="panel chart-panel">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip /><Legend />
              <Line type="monotone" dataKey="overall" name="综合分" stroke="#4c8bf5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completeness" name="完整性" stroke="#22c55e" dot={false} />
              <Line type="monotone" dataKey="validity" name="有效性" stroke="#a855f7" dot={false} />
              <Line type="monotone" dataKey="uniqueness" name="唯一性" stroke="#f59e0b" dot={false} />
              <Line type="monotone" dataKey="consistency" name="一致性" stroke="#06b6d4" dot={false} />
              <Line type="monotone" dataKey="anomaly" name="异常控制" stroke="#ef4444" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
