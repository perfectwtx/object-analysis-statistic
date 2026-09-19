export const PRIMARY_NAV = [
  { id: 'home', label: '总览', to: '/', match: (p) => p === '/' },
  { id: 'analyze', label: '分析', to: '/analyze', match: (p) => p.startsWith('/analyze') },
  {
    id: 'quality',
    label: '质量',
    to: '/quality',
    match: (p) =>
      p.startsWith('/quality') ||
      ['/issues', '/baselines', '/alerts', '/regression'].some((x) => p.startsWith(x)),
    children: [
      { to: '/quality', label: '健康', exact: true },
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
    match: (p) =>
      ['/relations', '/relationships', '/schema-impact', '/lineage', '/impact', '/recommendations'].some(
        (x) => p.startsWith(x),
      ),
    children: [
      { to: '/relations', label: '关系' },
      { to: '/relationships', label: '对象' },
      { to: '/schema-impact', label: 'Schema' },
      { to: '/lineage', label: '血缘' },
      { to: '/impact', label: '影响' },
      { to: '/recommendations', label: '建议' },
    ],
  },
];

export const SEARCH_TARGETS = [
  { to: '/', label: '总览', hint: '健康分与待处理问题' },
  { to: '/analyze', label: '分析工作台', hint: '上传或粘贴数据' },
  { to: '/quality', label: '质量健康', hint: '五维评分' },
  { to: '/quality/trend', label: '质量趋势', hint: '分数随时间变化' },
  { to: '/quality/fields', label: '字段质量', hint: '列级覆盖与类型' },
  { to: '/issues', label: '问题中心', hint: 'Incident 列表' },
  { to: '/baselines', label: '质量基线', hint: '快照对照' },
  { to: '/alerts', label: '告警规则', hint: '阈值与开关' },
  { to: '/regression', label: '回归对比', hint: '两次分析差值' },
  { to: '/relations', label: '关系分析', hint: '字段相关' },
  { to: '/relationships', label: '对象关联', hint: '实体关系' },
  { to: '/schema-impact', label: 'Schema 影响', hint: '结构变更' },
  { to: '/lineage', label: '数据血缘', hint: '上下游' },
  { to: '/impact', label: '影响分析', hint: '爆炸半径' },
  { to: '/recommendations', label: '建议', hint: '优先修复项' },
];

export function activeSection(pathname) {
  return PRIMARY_NAV.find((s) => s.match(pathname)) ?? PRIMARY_NAV[0];
}
