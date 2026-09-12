import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CRYPTO_TRANSFORM_TYPES, EXPECTATIONS_FIELDS, PARSE_TYPES, PII_MASK_OPTIONS, RUNTIME_GROUPS,
  REDACT_OPTIONS, SYM_CRYPTO_TRANSFORM_TYPES, TRANSFORM_TYPES, draftToValueParser, getFieldsMap,
  initGlobal, mergeDraftsIntoRulesText, mergeFieldList, parseRulesText, ruleToDraft,
  serializeGlobal, suggestDefaults, valueParserToDraft,
} from '../rulesModel.js';

const VP_KEY = '__valueParsers__';
const GLOBAL_KEY = '__global__';

/**
 * 字段级规则可视化配置弹窗。
 *
 * 流程：打开时解析现有 rulesText，为每个字段派生一个"草稿"（原始规则 + 未改标记）。
 * 用户在表单里改某个字段 → 标记 touched。确认时只把 touched/removed 的字段合并回规则文本，
 * 写回输入框并触发后端校验（onApply 返回是否通过）。
 *
 * 另外，当输入来源是 Excel / CSV 时，左侧列表顶部会出现一个全局「值解析 ValueParsers」入口，
 * 用于配置单元格内嵌 JSON 的值级解析（对应后端顶层 valueParsers）。
 *
 * 左侧字段列表 = 数据字段 ∪ 规则文本里已配置的字段（见 mergeFieldList）：
 * 规则框里手写但数据里不存在的字段也会列出（标「仅规则」），保证"规则框里有的配置，弹窗里一定看得到"。
 *
 * @param {boolean} open
 * @param {'preflight'|'analysis'} source 数据来源（仅影响副标题文案）
 * @param {string} inputFormat 输入格式（如 'excel' / 'csv' / 'json'）。excel/csv 时显示 ValueParsers
 * @param {Array<{name: string, stat?: object}>} fields 字段列表（preflight 仅含 name；analysis 带 stat 可智能预填）
 * @param {string} rulesText 现有规则文本
 * @param {(text: string) => Promise<boolean>} onApply 写回文本并校验，返回是否通过
 * @param {() => void} onClose
 */
export default function FieldRulesModal({ open, source, inputFormat, fields, rulesText, onApply, onClose }) {
  const [drafts, setDrafts] = useState({});
  // 左侧列表实际展示的字段：数据字段 + 规则里独有的字段（打开时合并一次）
  const [fieldList, setFieldList] = useState([]);
  const [touched, setTouched] = useState(() => new Set());
  const [removed, setRemoved] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const baseRef = useRef({ fields: {} });

  // ValueParsers（顶层全局配置）草稿与脏标记
  const [vpDrafts, setVpDrafts] = useState([]);
  const [vpDirty, setVpDirty] = useState(false);

  // 全局配置（runtime + expectations）草稿与脏标记
  const [runtimeDraft, setRuntimeDraft] = useState({});
  const [expectationsDraft, setExpectationsDraft] = useState({ minRowCount: '', maxDuplicateRate: '' });
  const [globalDirty, setGlobalDirty] = useState(false);

  // Excel / CSV 输入（或其规则已含 valueParsers）才显示 ValueParsers 入口
  const isExcelCsv = !!inputFormat && (inputFormat === 'csv' || inputFormat.startsWith('excel'));

  // 打开时解析现有规则，为每个字段派生初始草稿，并载入已有 valueParsers / runtime / expectations
  useEffect(() => {
    if (!open) return;
    let rulesObj = {};
    try {
      rulesObj = parseRulesText(rulesText);
    } catch {
      rulesObj = {};
    }
    const baseFields = getFieldsMap(rulesObj);
    baseRef.current = { fields: baseFields };
    // 数据字段 ∪ 规则里已配置的字段 —— 后者哪怕数据里没有也要能编辑/清除
    const merged = mergeFieldList(fields, baseFields);
    setFieldList(merged);
    const init = {};
    for (const f of merged) init[f.name] = ruleToDraft(baseFields[f.name]);
    setDrafts(init);
    setTouched(new Set());
    setRemoved(new Set());
    const vp = Array.isArray(rulesObj.valueParsers)
      ? rulesObj.valueParsers.map(valueParserToDraft)
      : [];
    setVpDrafts(vp);
    setVpDirty(false);
    const g = initGlobal(rulesObj);
    setRuntimeDraft(g.runtimeDraft);
    setExpectationsDraft(g.expectationsDraft);
    setGlobalDirty(false);
    setSearch('');
    setConfirmError('');
    setSelected(merged[0]?.name ?? (isExcelCsv || vp.length ? VP_KEY : GLOBAL_KEY));
  }, [open, rulesText, fields, isExcelCsv]);

  // 是否展示 ValueParsers：excel/csv 输入，或规则里已经有 valueParsers
  const showValueParsers = isExcelCsv || vpDrafts.length > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fieldList;
    return fieldList.filter((f) => f.name.toLowerCase().includes(q));
  }, [fieldList, search]);

  // 副标题用：数据字段数 / 仅存在于规则里的字段数
  const dataCount = useMemo(() => fieldList.filter((f) => !f.fromRules).length, [fieldList]);
  const rulesOnlyCount = fieldList.length - dataCount;

  if (!open) return null;

  const patchDraft = (name, patch) => {
    setDrafts((d) => ({ ...d, [name]: { ...d[name], ...patch } }));
    setTouched((t) => new Set(t).add(name));
  };

  const removeCurrent = () => {
    if (!selected) return;
    setRemoved((r) => new Set(r).add(selected));
    setTouched((t) => new Set(t).add(selected));
  };

  // ValueParsers 草稿编辑
  const updateVp = (i, patch) => {
    setVpDrafts((arr) => arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
    setVpDirty(true);
  };
  const addVp = () => {
    setVpDrafts((arr) => [...arr, { source: '', parseType: 'auto', flatten: '', header: '' }]);
    setVpDirty(true);
  };
  const removeVp = (i) => {
    setVpDrafts((arr) => arr.filter((_, idx) => idx !== i));
    setVpDirty(true);
  };

  // 全局配置：runtime 子组 / expectations 编辑
  const updateRuntime = (section, k, val) => {
    setRuntimeDraft((d) => {
      if (section === 'top') return { ...d, [k]: val };
      const sub = (d[section] && typeof d[section] === 'object') ? { ...d[section] } : {};
      sub[k] = val;
      return { ...d, [section]: sub };
    });
    setGlobalDirty(true);
  };
  const updateExpectation = (k, val) => {
    setExpectationsDraft((d) => ({ ...d, [k]: val }));
    setGlobalDirty(true);
  };
  const getRuntimeVal = (section, k) =>
    section === 'top' ? runtimeDraft[k] : (runtimeDraft[section]?.[k]);

  const onConfirm = async () => {
    setConfirmError('');
    // source 为 ValueParsers 的必填项：空 source 后端会静默跳过该解析器，
    // 所以确认前显式拦截并提示，避免"配置悄悄消失"
    if (vpDirty && vpDrafts.some((d) => !d.source || !d.source.trim())) {
      setConfirmError('ValueParsers 的 source（来源字段/列）为必填，请填写或删除空行后再确认。');
      return;
    }
    try {
      const entries = [];
      for (const name of touched) {
        entries.push([name, removed.has(name) ? { remove: true } : { draft: drafts[name] }]);
      }
      let vpOverride;
      if (vpDirty) {
        const list = vpDrafts
          .filter((d) => d.source && d.source.trim())
          .map(draftToValueParser);
        vpOverride = { valueParsers: list };
      }
      let globalOverride;
      if (globalDirty) {
        globalOverride = serializeGlobal(runtimeDraft, expectationsDraft);
      }
      if (entries.length === 0 && !vpDirty && !globalDirty) {
        onClose();
        return;
      }
      const newText = mergeDraftsIntoRulesText(rulesText, entries, vpOverride, globalOverride);
      const ok = await onApply(newText);
      if (ok) onClose();
      else setConfirmError('规则校验未通过，请检查后重试（详见规则框下方的错误提示）');
    } catch (e) {
      setConfirmError(`生成规则失败：${e.message}`);
    }
  };

  const sel = selected;
  const draft = sel ? drafts[sel] : null;
  const selEntry = fieldList.find((f) => f.name === sel);
  const selStat = selEntry?.stat;
  const suggest = selStat ? suggestDefaults(selStat) : null;
  const isRemoved = sel ? removed.has(sel) : false;

  // 小控件：必须以普通函数调用（{textField({…})}）而不是 JSX（<textField /> / <TextField />）。
  // 它们定义在组件内部，每次渲染都是新的函数身份；一旦写成 JSX，React 会视为「组件类型变了」，
  // 每次按键重渲染都把输入框卸载重建，表现为输入一个字符就丢焦点。
  const textField = ({ label, k, placeholder, title }) => (
    <label className="fr-field">
      <span className="fr-label">{label}</span>
      <input
        className="fr-input"
        value={draft[k] ?? ''}
        placeholder={placeholder ?? (suggest?.[k] != null ? `建议：${suggest[k]}` : '')}
        title={title}
        onChange={(e) => patchDraft(sel, { [k]: e.target.value })}
      />
    </label>
  );
  const numberField = ({ label, k, step, min, max, title }) => (
    <label className="fr-field">
      <span className="fr-label">{label}</span>
      <input
        className="fr-input"
        type="number"
        step={step}
        min={min}
        max={max}
        value={draft[k] ?? ''}
        placeholder={suggest?.[k] != null ? `建议：${suggest[k]}` : ''}
        title={title}
        onChange={(e) => patchDraft(sel, { [k]: e.target.value })}
      />
    </label>
  );
  const boolField = ({ label, k, title }) => (
    <label className="fr-check">
      <input
        type="checkbox"
        checked={!!draft[k]}
        title={title}
        onChange={(e) => patchDraft(sel, { [k]: e.target.checked })}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="fieldrules-backdrop" role="dialog" aria-modal="true" aria-labelledby="fr-title">
      <div className="fieldrules-modal">
        <header className="fieldrules-head">
          <div>
            <h3 id="fr-title">规则配置</h3>
            <p className="fieldrules-sub">
              {dataCount > 0
                ? (source === 'preflight' ? `基于预检样本字段（${dataCount}）` : `基于分析结果字段（${dataCount}）`)
                : '当前无数据字段（未分析）'}
              {rulesOnlyCount > 0 && ` · ${rulesOnlyCount} 个字段仅存在于规则中`}
              {' · '}全局配置 / 值解析 / 逐字段类型·转换·质量检查·PII，确认后写回规则输入框
            </p>
          </div>
          <button className="btn link" onClick={onClose}>关闭</button>
        </header>

        <div className="fieldrules-body">
          {/* 左：字段列表 */}
          <aside className="fieldrules-list">
            <input
              className="fr-search"
              placeholder="搜索字段…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="fr-list">
              <button
                key={GLOBAL_KEY}
                className={`fr-item vp-item ${sel === GLOBAL_KEY ? 'active' : ''}`}
                onClick={() => setSelected(GLOBAL_KEY)}
                title="解析行为 / 字段选择 / 采样 / 门禁 / 深度分析 / 数据集期望等全局配置"
              >
                <span className="fr-name">⚙️ 全局配置<small className="vp-sub">（runtime / expectations）</small></span>
              </button>
              {showValueParsers && (
                <button
                  key={VP_KEY}
                  className={`fr-item vp-item ${sel === VP_KEY ? 'active' : ''}`}
                  onClick={() => setSelected(VP_KEY)}
                  title="全局值解析配置（仅 Excel / CSV 输入生效）"
                >
                  <span className="fr-name">🌐 ValueParsers<small className="vp-sub">（全局）</small></span>
                  <span className="fr-badge">{vpDrafts.length || 0}</span>
                </button>
              )}
              {filtered.length === 0 && (
                <div className="fr-empty">
                  {fieldList.length === 0
                    ? '暂无字段。先分析数据，或在规则框里配置字段后再打开。'
                    : '无匹配字段'}
                </div>
              )}
              {filtered.map((f) => {
                const badge = f.fromRules
                  ? '仅规则'
                  : (f.stat?.primaryType && f.stat.primaryType !== 'Unknown'
                    ? f.stat.primaryType
                    : (f.stat?.semanticType ?? '—'));
                const edited = touched.has(f.name);
                return (
                  <button
                    key={f.name}
                    className={`fr-item ${sel === f.name ? 'active' : ''}`}
                    onClick={() => setSelected(f.name)}
                    title={f.fromRules
                      ? `${f.name}（规则里已配置，但当前数据中不存在该字段）`
                      : (f.inRules ? `${f.name}（规则里已有配置）` : f.name)}
                  >
                    {f.inRules && <span className="fr-cfg" title="规则里已有配置">✓</span>}
                    <span className="fr-name">{f.name}</span>
                    <span className={`fr-badge${f.fromRules ? ' rules-only' : ''}`}>{badge}</span>
                    {edited && <span className="fr-dot" title="已修改">●</span>}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* 右：选中字段的表单 */}
          <section className="fieldrules-form">
            {!sel && <div className="fr-empty">从左侧选择一个字段</div>}
            {sel === VP_KEY && showValueParsers && (
              <div className="fr-form-inner">
                <div className="fr-form-title">
                  <code>值解析 ValueParsers</code>
                  <span className="fr-meta">仅 Excel / CSV 文件上传模式生效</span>
                </div>
                <div className="fr-vp">
                  <p className="fr-vp-hint">
                    针对 Excel / CSV 单元格内嵌的 JSON 做值级解析。每个解析器指定来源字段/列
                    （如 <code>payload</code> 或 <code>A</code>）与解析方式：
                  </p>
                  {vpDrafts.length === 0 && (
                    <div className="fr-vp-empty">尚未配置任何值解析器。点击下方「+ 添加解析器」开始。</div>
                  )}
                  {vpDrafts.map((vp, i) => {
                    const sourceEmpty = !vp.source || !vp.source.trim();
                    return (
                    <div className="fr-vp-row" key={i}>
                      <div className="fr-vp-cell">
                        <input
                          className={`fr-input${sourceEmpty ? ' invalid' : ''}`}
                          placeholder="来源字段/列（必填，如 payload / A）"
                          value={vp.source}
                          aria-required="true"
                          onChange={(e) => updateVp(i, { source: e.target.value })}
                        />
                        {sourceEmpty && <span className="fr-vp-req">source 为必填</span>}
                      </div>
                      <select
                        className="fr-input"
                        value={vp.parseType}
                        onChange={(e) => updateVp(i, { parseType: e.target.value })}
                      >
                        <option value="auto">auto（默认）</option>
                        <option value="json">json</option>
                        <option value="json-string">json-string</option>
                        <option value="none">none</option>
                      </select>
                      <select
                        className="fr-input"
                        value={vp.flatten}
                        onChange={(e) => updateVp(i, { flatten: e.target.value })}
                      >
                        <option value="">沿用全局 flatten</option>
                        <option value="true">flatten=true</option>
                        <option value="false">flatten=false</option>
                      </select>
                      <select
                        className="fr-input"
                        value={String(vp.header)}
                        onChange={(e) => updateVp(i, { header: e.target.value === '' ? '' : Number(e.target.value) })}
                      >
                        <option value="">（默认）</option>
                        <option value={1}>有表头（首行为列名）</option>
                        <option value={0}>无表头（列以 A/B/C 命名）</option>
                      </select>
                      <button type="button" className="fr-vp-remove" onClick={() => removeVp(i)}>删除</button>
                    </div>
                  );
                  })}
                  <button type="button" className="btn outline fr-vp-add" onClick={addVp}>+ 添加解析器</button>
                </div>
              </div>
            )}
            {sel === GLOBAL_KEY && (
              <div className="fr-form-inner">
                <div className="fr-form-title">
                  <code>全局配置 runtime / expectations</code>
                  <span className="fr-meta">解析行为 · 字段选择 · 采样 · 门禁 · 深度分析 · 数据集期望</span>
                </div>
                <p className="fr-vp-hint">
                  这里覆盖原先只能手写进 JSON 文本框的全部规则配置。未改动的项目保持原样，确认后整体写回规则输入框。
                </p>

                {/* 数据集期望 */}
                <div className="fr-group">
                  <div className="fr-group-title">数据集期望 Expectations</div>
                  <div className="fr-grid">
                    {EXPECTATIONS_FIELDS.map((f) => (
                      <label className="fr-field" key={f.k}>
                        <span className="fr-label">{f.label}</span>
                        <input
                          className="fr-input"
                          type="number"
                          value={expectationsDraft[f.k] ?? ''}
                          onChange={(e) => updateExpectation(f.k, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* runtime 各子组 */}
                {RUNTIME_GROUPS.map((grp) => {
                  const body = grp.fields.map((f) => {
                    const raw = grp.section === 'top' ? runtimeDraft[f.k] : runtimeDraft[grp.section]?.[f.k];
                    if (f.type === 'tribool') {
                      const str = raw === true ? 'true' : raw === false ? 'false' : '';
                      return (
                        <label className="fr-field" key={f.k} title={f.help}>
                          <span className="fr-label">{f.label}</span>
                          <select
                            className="fr-input"
                            value={str}
                            onChange={(e) => updateRuntime(grp.section, f.k, e.target.value === '' ? '' : e.target.value === 'true')}
                          >
                            <option value="">（未设置）</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        </label>
                      );
                    }
                    return (
                      <label className="fr-field" key={f.k} title={f.help}>
                        <span className="fr-label">{f.label}</span>
                        <input
                          className="fr-input"
                          type={f.type === 'number' ? 'number' : 'text'}
                          value={raw ?? ''}
                          placeholder={f.help ? f.help.replace(/（.*?）/g, '').slice(0, 40) : ''}
                          onChange={(e) => updateRuntime(grp.section, f.k, e.target.value)}
                        />
                      </label>
                    );
                  });
                  const cls = `fr-group${grp.cliOnly ? ' fr-group-cli' : ''}`;
                  const titleNode = (
                    <div className="fr-group-title">
                      {grp.title}
                      {grp.cliOnly && <span className="fr-cli-tag">仅命令行</span>}
                    </div>
                  );
                  if (grp.cliOnly) {
                    return (
                      <details className="fr-group-details" key={grp.section}>
                        <summary>{titleNode}</summary>
                        <div className="fr-grid">{body}</div>
                      </details>
                    );
                  }
                  return (
                    <div className={cls} key={grp.section}>
                      {titleNode}
                      <div className="fr-grid">{body}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {sel && !isRemoved && draft && (
              <div className="fr-form-inner">
                <div className="fr-form-title">
                  <code>{sel}</code>
                  {selEntry?.fromRules && (
                    <span className="fr-badge rules-only">仅规则</span>
                  )}
                  {selStat && (
                    <span className="fr-meta">
                      {selStat.coverage != null && ` · 覆盖率 ${(selStat.coverage * 100).toFixed(0)}%`}
                      {selStat.distinctCount != null && ` · 唯一值 ${selStat.distinctCount}`}
                    </span>
                  )}
                </div>
                {selEntry?.fromRules && (
                  <p className="fr-vp-hint">
                    该字段的规则来自规则输入框，但当前数据中<strong>不存在</strong>同名字段
                    —— 可能是字段名写错或规则文件用错。可在此修改，或用底部「清除该字段规则」删掉。
                  </p>
                )}

                {/* 基础 */}
                <div className="fr-group">
                  <div className="fr-group-title">基础</div>
                  <div className="fr-grid">
                    {textField({ label: '主导类型 primaryType', k: 'primaryType', title: '覆盖后端自动推断的类型，如 String / Number / Boolean' })}
                    {textField({ label: '默认值 defaultValue', k: 'defaultValue', title: '为缺失/空值指定默认值' })}
                  </div>
                </div>

                {/* 转换 transform */}
                <div className="fr-group">
                  <div className="fr-group-title">值转换 transform</div>
                  <div className="fr-grid">
                    <label className="fr-field">
                      <span className="fr-label">类型 type</span>
                      <select
                        className="fr-input"
                        value={draft.transformType}
                        onChange={(e) => {
                          const t = e.target.value;
                          // 切换家族时清掉另一族的参数：mode 在两族里语义不同
                          // （对称 = cbc/ecb，sm2 = decrypt/verify），混写会被后端判不支持
                          const patch = { transformType: t, transformMode: '' };
                          if (t === 'sm2') {
                            patch.transformKey = '';
                            patch.transformIv = '';
                            patch.transformPadding = '';
                          } else {
                            patch.transformPrivateKey = '';
                            patch.transformPublicKey = '';
                            patch.transformSignature = '';
                          }
                          patchDraft(sel, patch);
                        }}
                      >
                        <option value="none">（无）</option>
                        {TRANSFORM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label className="fr-field">
                      <span className="fr-label">解析后展开 parse</span>
                      <select
                        className="fr-input"
                        value={draft.transformParse}
                        onChange={(e) => patchDraft(sel, { transformParse: e.target.value })}
                      >
                        <option value="none">（无）</option>
                        {PARSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                  </div>
                  {draft.transformType && draft.transformType !== 'none' && (
                    <div className="fr-grid">
                      {draft.transformType === 'jwt' && (
                        textField({ label: 'claim（提取的字段）', k: 'transformClaim', placeholder: '如 sub / user_id；留空取整个 payload' })
                      )}
                      {SYM_CRYPTO_TRANSFORM_TYPES.includes(draft.transformType) && (
                        <>
                          {textField({ label: 'key', k: 'transformKey', title: '密钥（编码由 format 决定）' })}
                          {textField({ label: 'iv', k: 'transformIv', title: '初始化向量（ECB 模式可留空）' })}
                          <label className="fr-field">
                            <span className="fr-label">mode</span>
                            <select className="fr-input" value={draft.transformMode} onChange={(e) => patchDraft(sel, { transformMode: e.target.value })}>
                              <option value="">（默认 cbc）</option>
                              <option value="cbc">cbc</option>
                              <option value="ecb">ecb</option>
                            </select>
                          </label>
                          <label className="fr-field">
                            <span className="fr-label">padding</span>
                            <select className="fr-input" value={draft.transformPadding} onChange={(e) => patchDraft(sel, { transformPadding: e.target.value })}>
                              <option value="">（默认 pkcs7）</option>
                              <option value="pkcs7">pkcs7</option>
                              <option value="none">none</option>
                            </select>
                          </label>
                        </>
                      )}
                      {draft.transformType === 'sm2' && (
                        <>
                          <label className="fr-field">
                            <span className="fr-label">mode</span>
                            <select className="fr-input" value={draft.transformMode} onChange={(e) => patchDraft(sel, { transformMode: e.target.value })}>
                              <option value="decrypt">decrypt（私钥解密）</option>
                              <option value="verify">verify（公钥验签）</option>
                            </select>
                          </label>
                          {textField({ label: '私钥 privateKey', k: 'transformPrivateKey', title: 'decrypt 模式必填：Base64 PKCS#8 或 hex 编码的 32 字节私钥' })}
                          {textField({ label: '公钥 publicKey', k: 'transformPublicKey', title: 'verify 模式必填：Base64 X.509 或 hex 未压缩点' })}
                          {textField({ label: '签名 signature', k: 'transformSignature', title: 'verify 模式必填：与 format 编码一致的待验签名' })}
                        </>
                      )}
                      {CRYPTO_TRANSFORM_TYPES.includes(draft.transformType) && (
                        <label className="fr-field">
                          <span className="fr-label">format</span>
                          <select className="fr-input" value={draft.transformFormat} onChange={(e) => patchDraft(sel, { transformFormat: e.target.value })}>
                            <option value="">（默认 base64）</option>
                            <option value="base64">base64</option>
                            <option value="hex">hex</option>
                          </select>
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {/* 质量检查 */}
                <div className="fr-group">
                  <div className="fr-group-title">质量检查</div>
                  <div className="fr-checks">
                    {boolField({ label: '必填 required', k: 'required', title: '字段缺失或为 null 均计为违规' })}
                    {boolField({ label: '唯一 unique', k: 'unique', title: '非空值重复时报告重复次数' })}
                  </div>
                  <label className="fr-field fr-block">
                    <span className="fr-label">枚举白名单 enumValues（每行 / 逗号分隔）</span>
                    <textarea
                      className="fr-input mono"
                      rows={2}
                      value={draft.enumText}
                      placeholder="Male&#10;Female&#10;Unknown"
                      onChange={(e) => patchDraft(sel, { enumText: e.target.value })}
                    />
                  </label>
                  <div className="fr-grid">
                    {textField({ label: '正则 pattern', k: 'pattern', title: '非空值的字符串形态需整体匹配' })}
                    {numberField({ label: '数值下界 minValue', k: 'minValue', step: 'any' })}
                    {numberField({ label: '数值上界 maxValue', k: 'maxValue', step: 'any' })}
                    {numberField({ label: 'Null 率上限 nullRateMax', k: 'nullRateMax', step: '0.01', min: 0, max: 1 })}
                    {numberField({ label: '异常值占比上限 maxOutlierRatio', k: 'maxOutlierRatio', step: '0.01', min: 0, max: 1 })}
                  </div>
                </div>

                {/* PII */}
                <div className="fr-group">
                  <div className="fr-group-title">PII / 敏感字段</div>
                  <div className="fr-grid">
                    <label className="fr-field">
                      <span className="fr-label">打码 redact</span>
                      <select
                        className="fr-input"
                        value={draft.redact}
                        onChange={(e) => patchDraft(sel, { redact: e.target.value })}
                      >
                        {REDACT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    {textField({ label: 'pii 标签 label', k: 'piiLabel', title: '合规报告展示用的敏感分类名' })}
                    <label className="fr-field">
                      <span className="fr-label">高敏感 highSeverity</span>
                      <select
                        className="fr-input"
                        value={draft.piiHigh}
                        onChange={(e) => patchDraft(sel, { piiHigh: e.target.value })}
                        title="影响合规报告排序与 A/B/C 合规等级判定；缺省为高敏感"
                      >
                        <option value="">（默认 高敏感）</option>
                        <option value="true">true（高敏感）</option>
                        <option value="false">false（普通敏感）</option>
                      </select>
                    </label>
                    <label className="fr-field">
                      <span className="fr-label">pii 打码方式 mask</span>
                      <select
                        className="fr-input"
                        value={draft.piiMask}
                        onChange={(e) => patchDraft(sel, { piiMask: e.target.value })}
                      >
                        {PII_MASK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    {draft.piiMask === 'custom' && (
                      <>
                        {numberField({ label: '保留前缀 keepPrefix', k: 'piiKeepPrefix', min: 0, title: '保留前 N 位明文；0 = 不保留' })}
                        {numberField({ label: '保留后缀 keepSuffix', k: 'piiKeepSuffix', min: 0, title: '保留后 N 位明文；0 = 不保留' })}
                        {textField({ label: '打码字符 maskChar', k: 'piiMaskChar', placeholder: '默认 *', title: '填充用字符' })}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            {sel && isRemoved && (
              <div className="fr-removed">
                <code>{sel}</code> 的规则将在确认后被清除。
                <button className="btn link" onClick={() => { setRemoved((r) => { const n = new Set(r); n.delete(sel); return n; }); setTouched((t) => new Set(t).add(sel)); }}>撤销清除</button>
              </div>
            )}
          </section>
        </div>

        <footer className="fieldrules-foot">
          {confirmError && <span className="fieldrules-err">{confirmError}</span>}
          <span className="spacer" />
          <button className="btn outline" onClick={removeCurrent} disabled={!sel || isRemoved || sel === VP_KEY || sel === GLOBAL_KEY}>清除该字段规则</button>
          <button className="btn primary" onClick={onConfirm}>确认并应用到规则框</button>
        </footer>
      </div>
    </div>
  );
}
