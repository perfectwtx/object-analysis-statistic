/**
 * 产品导航：一级分区 + 二级入口（顶栏胶囊，非侧栏菜单）
 */
export const PRIMARY_NAV = [
  {
    id: 'analyze',
    label: '分析',
    to: '/',
    match: (path) => path === '/' || path === '',
  },
  {
    id: 'quality',
    label: '质量',
    to: '/quality',
    match: (path) =>
      path.startsWith('/quality') ||
      ['/issues', '/baselines', '/alerts', '/regression'].some((p) => path.startsWith(p)),
    children: [
      { to: '/quality', label: '总览' },
      { to: '/quality/trend', label: '趋势' },
      { to: '/quality/fields', label: '字段' },
      { to: '/issues', label: '问题' },
      { to: '/baselines', label: '基线' },
      { to: '/alerts', label: '告警' },
      { to: '/regression', label: '回归' },
    ],
  },
  {
    id: 'insights',
    label: '洞察',
    to: '/relations',
    match: (path) =>
      ['/relations', '/relationships', '/schema-impact', '/lineage', '/impact', '/recommendations'].some(
        (p) => path.startsWith(p),
      ),
    children: [
      { to: '/relations', label: '关系' },
      { to: '/relationships', label: '对象关联' },
      { to: '/schema-impact', label: 'Schema' },
      { to: '/lineage', label: '血缘' },
      { to: '/impact', label: '影响' },
      { to: '/recommendations', label: '建议' },
    ],
  },
];

/** 兼容旧引用 */
export const NAV_GROUPS = PRIMARY_NAV.map((s) => ({
  id: s.id,
  label: s.label,
  items: s.children || [{ to: s.to, label: s.label }],
}));

export function activeSection(pathname) {
  return PRIMARY_NAV.find((s) => s.match(pathname)) || PRIMARY_NAV[0];
}
