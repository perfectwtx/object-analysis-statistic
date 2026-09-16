export const NAV_GROUPS = [
  {
    id: 'workbench',
    label: '工作台',
    items: [{ to: '/', label: '分析任务', icon: 'analyze' }],
  },
  {
    id: 'quality',
    label: '质量',
    items: [
      { to: '/quality', label: '质量 Dashboard', icon: 'quality' },
      { to: '/quality/trend', label: '质量趋势', icon: 'trend' },
      { to: '/quality/fields', label: '字段质量', icon: 'fields' },
      { to: '/issues', label: 'Issue Center', icon: 'issues' },
      { to: '/baselines', label: 'Baselines', icon: 'baseline' },
      { to: '/alerts', label: 'Alert Rules', icon: 'alert' },
      { to: '/regression', label: 'Regression', icon: 'regression' },
    ],
  },
  {
    id: 'insights',
    label: '洞察',
    items: [
      { to: '/relations', label: '关系分析', icon: 'relations' },
      { to: '/relationships', label: 'Object Relationships', icon: 'objects' },
      { to: '/schema-impact', label: 'Schema Impact', icon: 'schema' },
      { to: '/lineage', label: 'Data Lineage', icon: 'lineage' },
      { to: '/impact', label: 'Impact Analysis', icon: 'impact' },
      { to: '/recommendations', label: 'Recommendations', icon: 'reco' },
    ],
  },
];
