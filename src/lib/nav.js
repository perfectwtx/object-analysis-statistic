/** labelKey → i18n key in lib/i18n.js */
export const PRIMARY_NAV = [
  { id: 'home', labelKey: 'overview', to: '/', match: (p) => p === '/' },
  { id: 'analyze', labelKey: 'analyze', to: '/analyze', match: (p) => p.startsWith('/analyze') },
  {
    id: 'quality',
    labelKey: 'quality',
    to: '/quality',
    match: (p) =>
      p.startsWith('/quality') ||
      ['/issues', '/baselines', '/alerts', '/regression'].some((x) => p.startsWith(x)),
    children: [
      { to: '/quality', labelKey: 'health', exact: true },
      { to: '/quality/trend', labelKey: 'trend' },
      { to: '/quality/fields', labelKey: 'fields' },
      { to: '/issues', labelKey: 'issues' },
      { to: '/baselines', labelKey: 'baselines' },
      { to: '/alerts', labelKey: 'alerts' },
      { to: '/regression', labelKey: 'regression' },
    ],
  },
  {
    id: 'insights',
    labelKey: 'insights',
    to: '/relations',
    match: (p) =>
      ['/relations', '/relationships', '/schema-impact', '/lineage', '/impact', '/recommendations'].some(
        (x) => p.startsWith(x),
      ),
    children: [
      { to: '/relations', labelKey: 'relations' },
      { to: '/relationships', labelKey: 'objects' },
      { to: '/schema-impact', labelKey: 'schema' },
      { to: '/lineage', labelKey: 'lineage' },
      { to: '/impact', labelKey: 'impact' },
      { to: '/recommendations', labelKey: 'recommendations' },
    ],
  },
];

export const SEARCH_TARGETS = [
  { to: '/', labelKey: 'overview', hintKey: 'homeSubtitleApi' },
  { to: '/analyze', labelKey: 'analyze', hintKey: 'analyzeHint' },
  { to: '/quality', labelKey: 'qualityTitle', hintKey: 'dimQuality' },
  { to: '/quality/trend', labelKey: 'trend', hintKey: 'dimQuality' },
  { to: '/quality/fields', labelKey: 'fieldQuality', hintKey: 'fields' },
  { to: '/issues', labelKey: 'issueCenter', hintKey: 'issues' },
  { to: '/baselines', labelKey: 'baselines', hintKey: 'baselines' },
  { to: '/alerts', labelKey: 'alertRules', hintKey: 'alerts' },
  { to: '/regression', labelKey: 'regression', hintKey: 'regression' },
  { to: '/relations', labelKey: 'relations', hintKey: 'relations' },
  { to: '/relationships', labelKey: 'objects', hintKey: 'objects' },
  { to: '/schema-impact', labelKey: 'schema', hintKey: 'schema' },
  { to: '/lineage', labelKey: 'lineage', hintKey: 'lineage' },
  { to: '/impact', labelKey: 'impact', hintKey: 'impact' },
  { to: '/recommendations', labelKey: 'recommendations', hintKey: 'recommendations' },
];

export function activeSection(pathname) {
  return PRIMARY_NAV.find((s) => s.match(pathname)) ?? PRIMARY_NAV[0];
}
