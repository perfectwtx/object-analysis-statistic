const ICONS = {
  objects: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" />
    </svg>
  ),
  unique: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8L12 2z" />
    </svg>
  ),
  duplicate: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  fields: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  ),
  coverage: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12A10 10 0 1112 2v10z" /><path d="M12 2a10 10 0 0110 10h-10z" />
    </svg>
  ),
};

export default function OverviewCards({ result }) {
  // v2 响应带 overview 分节，直接用（异步路径由 adapter 从 result 推导，字段一致）
  const ov = result.overview ?? {};
  const fields = result.fieldStatistics ?? [];
  const totalObjects = ov.totalObjects ?? result.totalObjects ?? 0;

  // 覆盖率拆分汇总：把每个字段的 null 累加起来（后端 W8 起逐字段给出 nullCount）
  const nullTotal = fields.reduce((s, f) => s + (f.nullCount ?? 0), 0);

  // 有效值覆盖率 = 所有字段的有效值数 / 所有字段的记录数（即「字段-记录格」的有效占比）
  const cells = fields.length * totalObjects;
  const presentTotal = fields.reduce((s, f) => s + (f.presentCount ?? Math.max(0, f.count - (f.nullCount ?? 0))), 0);

  const cards = [
    { label: '对象总数', value: totalObjects, icon: ICONS.objects },
    { label: '唯一对象', value: ov.totalUniqueObjects ?? result.totalUniqueObjects, icon: ICONS.unique },
    { label: '重复对象组', value: ov.totalDuplicateGroups ?? result.totalDuplicateGroups, icon: ICONS.duplicate },
    { label: '字段数', value: ov.fieldCount ?? fields.length, icon: ICONS.fields },
    {
      label: '有效值覆盖率',
      icon: ICONS.coverage,
      value: cells > 0 ? ((presentTotal / cells) * 100).toFixed(1) + '%' : '-',
      sub: `null ${nullTotal}`,
    },
  ];
  return (
    <div className="cards">
      {cards.map((c) => (
        <div className="card" key={c.label}>
          <div className="card-icon">{c.icon}</div>
          <div className="card-value">{c.value}</div>
          <div className="card-label">
            {c.label}
            {c.sub && <span className="card-sub">{c.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
