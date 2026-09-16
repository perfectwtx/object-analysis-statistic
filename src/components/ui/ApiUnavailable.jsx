export default function ApiUnavailable({
  feature = '该功能',
  endpoint,
  hint = '请在后端 ObjectAnalyzer.Api 中补充对应 HTTP 端点后刷新。',
}) {
  return (
    <div className="api-unavailable">
      <div className="api-unavailable-title">{feature} · 接口尚未开放</div>
      {endpoint && <code className="api-unavailable-endpoint mono">{endpoint}</code>}
      <p className="api-unavailable-hint">{hint}</p>
    </div>
  );
}
