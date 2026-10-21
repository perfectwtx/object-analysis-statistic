export const ROUTE_CAPABILITIES = {
  '/analyze': 'analyze', '/quality': 'qualityDashboard', '/quality/trend': 'qualityTrend',
  '/quality/fields': 'fieldQuality', '/issues': 'issues', '/baselines': 'baselines',
  '/alerts': 'alertRules', '/regression': 'regression', '/relations': 'relationships',
  '/relationships': 'objectRelationships', '/schema-impact': 'schemaImpact',
  '/lineage': 'lineage', '/impact': 'impact', '/recommendations': 'recommendations',
};
// 未声明的能力是未知，不能误判为禁用；旧后端没有此接口时继续兼容探测。
export function routeEnabled(path, capabilities = {}) {
  return capabilities[ROUTE_CAPABILITIES[path]] !== false;
}
export function normalizeCapabilities(payload) {
  const data = payload?.capabilities ?? payload;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid capabilities response');
  return Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'boolean'));
}
