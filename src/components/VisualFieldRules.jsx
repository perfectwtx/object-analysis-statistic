import { useMemo, useState } from 'react';
import { cn } from '../lib/cn.js';
import VisualExpectations from './VisualExpectations.jsx';
import VisualValueParsers from './VisualValueParsers.jsx';
import PiiMaskEditor from './PiiMaskEditor.jsx';
import { parseFieldsFromText, writeFieldsIntoText, mergeFieldNamesIntoRulesText } from '../lib/fieldRules.js';
export { mergeFieldNamesIntoRulesText };

const TRANSFORM_TYPES = [
  { value: '', label: '无' },
  { value: 'jwt', label: 'JWT' },
  { value: 'aes', label: 'AES 解密' },
  { value: 'sm4', label: 'SM4 解密' },
  { value: 'sm2', label: 'SM2' },
  { value: 'base64', label: 'Base64' },
  { value: 'url', label: 'URL 解码' },
];
const PARSE_AFTER = [
  { value: '', label: '不展开' },
  { value: 'json', label: '再解析 JSON' },
];
const PRIMARY_TYPES = ['', 'String', 'Number', 'Boolean', 'DateTime', 'Object', 'Array', 'Null'];
const AES_MODES = ['', 'cbc', 'ecb'];
const AES_PADDING = ['', 'pkcs7', 'none'];
const KEY_FORMATS = ['', 'base64', 'hex'];

const PATTERN_PRESETS = [
  { label: '邮箱', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
  { label: '中国手机号', pattern: '^1[3-9]\\d{9}$' },
  { label: '固定电话', pattern: '^0\\d{2,3}-?\\d{7,8}$' },
  { label: '身份证', pattern: '^[1-9]\\d{5}(18|19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]$' },
  { label: 'URL', pattern: '^https?:\\/\\/[^\\s]+$' },
  { label: 'UUID', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' },
  { label: '日期 YYYY-MM-DD', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  { label: 'IPv4', pattern: '^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$' },
  { label: '正整数', pattern: '^[1-9]\\d*$' },
  { label: '非空', pattern: '\\S+' },
];

function ruleFromObj(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const r = { ...obj };
  r._tf = r.transform && typeof r.transform === 'object' ? { ...r.transform } : {};
  if (r.pii && typeof r.pii === 'object') {
    r._pii = {
      enabled: true,
      label: r.pii.label ?? '',
      highSeverity: r.pii.highSeverity !== false,
      mask: {
        keepPrefix: r.pii.mask?.keepPrefix ?? 0,
        keepSuffix: r.pii.mask?.keepSuffix ?? 0,
        maskChar: r.pii.mask?.maskChar ?? '*',
        maskAll: !!r.pii.mask?.maskAll,
      },
    };
  } else {
    r._pii = { enabled: false, label: '', highSeverity: true, mask: { keepPrefix: 3, keepSuffix: 4, maskChar: '*', maskAll: false } };
  }
  return r;
}

function objFromRule(form) {
  const out = {};
  if (form.required) out.required = true;
  if (form.unique) out.unique = true;
  if (form.redact === true) out.redact = true;
  if (form.redact === false) out.redact = false;
  if (Array.isArray(form.enumValues) && form.enumValues.length) {
    out.enumValues = form.enumValues.filter((x) => String(x).length);
  }
  if (form.pattern != null && String(form.pattern).trim()) out.pattern = String(form.pattern);
  if (form.minValue != null && form.minValue !== '') {
    const n = Number(form.minValue);
    if (!Number.isNaN(n)) out.minValue = n;
  }
  if (form.maxValue != null && form.maxValue !== '') {
    const n = Number(form.maxValue);
    if (!Number.isNaN(n)) out.maxValue = n;
  }
  if (form.nullRateMax != null && form.nullRateMax !== '') {
    const n = Number(form.nullRateMax);
    if (!Number.isNaN(n)) out.nullRateMax = n;
  }
  if (form.maxOutlierRatio != null && form.maxOutlierRatio !== '') {
    const n = Number(form.maxOutlierRatio);
    if (!Number.isNaN(n)) out.maxOutlierRatio = n;
  }
  if (form.defaultValue != null && String(form.defaultValue).length) out.defaultValue = form.defaultValue;
  if (form.primaryType) out.primaryType = form.primaryType;
  const tf = form._tf || {};
  const transform = {};
  if (tf.type) transform.type = tf.type;
  if (tf.claim) transform.claim = tf.claim;
  if (tf.key) transform.key = tf.key;
  if (tf.iv) transform.iv = tf.iv;
  if (tf.mode) transform.mode = tf.mode;
  if (tf.padding) transform.padding = tf.padding;
  if (tf.format) transform.format = tf.format;
  if (tf.privateKey) transform.privateKey = tf.privateKey;
  if (tf.publicKey) transform.publicKey = tf.publicKey;
  if (tf.signature) transform.signature = tf.signature;
  if (tf.parse) transform.parse = tf.parse;
  if (Object.keys(transform).length) out.transform = transform;
  const pii = form._pii;
  if (pii?.enabled) {
    const p = {};
    if (pii.label) p.label = pii.label;
    p.highSeverity = pii.highSeverity !== false;
    const m = pii.mask || {};
    if (m.maskAll) {
      p.mask = { maskAll: true };
      if (m.maskChar && m.maskChar !== '*') p.mask.maskChar = m.maskChar;
    } else {
      p.mask = {
        maskAll: false,
        keepPrefix: Number(m.keepPrefix) || 0,
        keepSuffix: Number(m.keepSuffix) || 0,
        maskChar: (m.maskChar && String(m.maskChar)) || '*',
      };
    }
    out.pii = p;
  }
  return out;
}

function summaryOf(rule) {
  const bits = [];
  if (rule.required) bits.push('必填');
  if (rule.unique) bits.push('唯一');
  if (rule.redact === true) bits.push('强制打码');
  if (rule.redact === false) bits.push('不打码');
  if (rule.pii) bits.push('PII');
  if (rule.transform?.type) bits.push(`转换:${rule.transform.type}`);
  else if (rule.transform?.parse) bits.push(`parse:${rule.transform.parse}`);
  if (Array.isArray(rule.enumValues) && rule.enumValues.length) bits.push(`枚举×${rule.enumValues.length}`);
  if (rule.pattern) bits.push('正则');
  if (rule.minValue != null) bits.push(`≥${rule.minValue}`);
  if (rule.maxValue != null) bits.push(`≤${rule.maxValue}`);
  if (rule.nullRateMax != null) bits.push(`空≤${rule.nullRateMax}`);
  if (rule.maxOutlierRatio != null) bits.push(`异常≤${rule.maxOutlierRatio}`);
  if (rule.primaryType) bits.push(rule.primaryType);
  return bits.length ? bits.join(' · ') : '未配置属性';
}

function ChipGroup({ options, value, onChange, busy }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? (o || '默认') : o.label;
        return (
          <button key={v || 'none'} type="button" disabled={busy} onClick={() => onChange(v)} className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition-colors', (value || '') === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function VisualFieldRules({ text, setText, busy, sampleFields }) {
  const parsed = useMemo(() => parseFieldsFromText(text), [text]);
  const parseError = parsed === null;
  const [expanded, setExpanded] = useState(null);
  const [newName, setNewName] = useState('');
  const [draftName, setDraftName] = useState('');

  const entries = useMemo(() => {
    if (!parsed) return [];
    return Object.entries(parsed).map(([name, rule]) => ({ name, rule: ruleFromObj(rule) }));
  }, [parsed]);

  const missingSample = useMemo(() => {
    if (!sampleFields?.length || !parsed) return [];
    return sampleFields.filter((f) => !(f in parsed));
  }, [sampleFields, parsed]);

  const commitFields = (nextMap) => setText?.(writeFieldsIntoText(text, nextMap));
  const updateField = (name, formRule) => {
    if (!parsed) return;
    commitFields({ ...parsed, [name]: objFromRule(formRule) });
  };
  const removeField = (name) => {
    if (!parsed) return;
    const next = { ...parsed };
    delete next[name];
    commitFields(next);
    if (expanded === name) setExpanded(null);
  };
  const renameField = (oldName, nextName) => {
    const n = nextName.trim();
    if (!n || n === oldName || !parsed || parsed[n]) return;
    const next = {};
    for (const [k, v] of Object.entries(parsed)) next[k === oldName ? n : k] = v;
    commitFields(next);
    if (expanded === oldName) setExpanded(n);
  };
  const addField = (name) => {
    const n = (name ?? newName).trim();
    if (!n) return;
    const base = parsed && typeof parsed === 'object' ? { ...parsed } : {};
    if (base[n]) return;
    base[n] = {};
    commitFields(base);
    setNewName('');
    setExpanded(n);
  };
  const importSampleFields = () => {
    if (!sampleFields?.length) return;
    setText?.(mergeFieldNamesIntoRulesText(text, sampleFields));
  };

  if (parseError) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-6 text-center text-sm text-danger">
        当前规则 JSON 无法解析，请先切到「JSON」修复后再用可视化编辑。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        对齐后端 FieldRule：质量校验、transform、PII、valueParsers、expectations。修改实时写回 JSON。
      </p>

      {sampleFields?.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            预处理/分析发现 <strong className="text-foreground">{sampleFields.length}</strong> 个字段
            {missingSample.length ? `（其中 ${missingSample.length} 个尚未写入规则）` : '（均已在规则中）'}
          </span>
          <button type="button" disabled={busy || missingSample.length === 0} onClick={importSampleFields} className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40">
            填入规则
          </button>
        </div>
      ) : null}

      <div className="flex gap-2">
        <input className="h-10 flex-1 rounded-lg border border-border bg-muted/40 px-3 text-sm outline-none focus:border-primary/40" placeholder="新字段名，如 email 或 address.city" value={newName} disabled={busy} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }} />
        <button type="button" disabled={busy || !newName.trim()} onClick={() => addField()} className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40">添加字段</button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">还没有字段规则。可从预处理结果「填入规则」，或手动添加字段名。</div>
      ) : (
        <ul className="space-y-2">
          {entries.map(({ name, rule }) => {
            const open = expanded === name;
            const tf = rule._tf || {};
            const pii = rule._pii || {};
            return (
              <li key={name} className={cn('overflow-hidden rounded-xl border border-border bg-muted/20 transition-colors', open && 'border-primary/30 bg-card')}>
                <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left" onClick={() => { setExpanded(open ? null : name); setDraftName(name); }} disabled={busy}>
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-md text-[11px] transition-transform', open ? 'bg-primary/15 text-primary rotate-90' : 'bg-muted text-muted-foreground')}>›</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm font-medium">{name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{summaryOf(rule)}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{open ? '收起' : '配置'}</span>
                </button>
                {open ? (
                  <div className="space-y-4 border-t border-border px-3 py-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-[160px] flex-1">
                        <span className="mb-1 block text-[11px] text-muted-foreground">字段名</span>
                        <input className="h-9 w-full rounded-lg border border-border bg-background px-2.5 font-mono text-sm outline-none focus:border-primary/40" value={draftName} disabled={busy} onChange={(e) => setDraftName(e.target.value)} onBlur={() => renameField(name, draftName)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); renameField(name, draftName); } }} />
                      </label>
                      <button type="button" className="h-9 rounded-lg px-3 text-xs text-danger hover:bg-danger/10" disabled={busy} onClick={() => removeField(name)}>删除字段</button>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">质量校验</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[{ key: 'required', label: '必填', hint: '缺失或 null 违规' }, { key: 'unique', label: '唯一', hint: '非空值不可重复' }].map((a) => (
                          <label key={a.key} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5', rule[a.key] ? 'border-primary/40 bg-primary/5' : 'border-border bg-background')}>
                            <input type="checkbox" className="mt-0.5 size-4 rounded border-border" checked={!!rule[a.key]} disabled={busy} onChange={(e) => updateField(name, { ...rule, [a.key]: e.target.checked })} />
                            <span><span className="text-sm font-medium">{a.label}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{a.hint}</span></span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="block rounded-lg border border-border bg-background p-3"><span className="mb-1 block text-[11px] text-muted-foreground">最小值</span><input type="number" className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none" disabled={busy} value={rule.minValue ?? ''} onChange={(e) => updateField(name, { ...rule, minValue: e.target.value === '' ? undefined : e.target.value })} /></label>
                        <label className="block rounded-lg border border-border bg-background p-3"><span className="mb-1 block text-[11px] text-muted-foreground">最大值</span><input type="number" className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none" disabled={busy} value={rule.maxValue ?? ''} onChange={(e) => updateField(name, { ...rule, maxValue: e.target.value === '' ? undefined : e.target.value })} /></label>
                        <label className="block rounded-lg border border-border bg-background p-3"><span className="mb-1 block text-[11px] text-muted-foreground">空值率上限</span><input type="number" min={0} max={1} step={0.05} className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none" placeholder="0.2" disabled={busy} value={rule.nullRateMax ?? ''} onChange={(e) => updateField(name, { ...rule, nullRateMax: e.target.value === '' ? undefined : e.target.value })} /></label>
                        <label className="block rounded-lg border border-border bg-background p-3"><span className="mb-1 block text-[11px] text-muted-foreground">异常值比例上限</span><input type="number" min={0} max={1} step={0.05} className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none" placeholder="0.1" disabled={busy} value={rule.maxOutlierRatio ?? ''} onChange={(e) => updateField(name, { ...rule, maxOutlierRatio: e.target.value === '' ? undefined : e.target.value })} /></label>
                        <div className="rounded-lg border border-border bg-background p-3 sm:col-span-2">
                          <span className="mb-1.5 block text-[11px] text-muted-foreground">正则 pattern</span>
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {PATTERN_PRESETS.map((preset) => (
                              <button key={preset.label} type="button" disabled={busy} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40" onClick={() => updateField(name, { ...rule, pattern: preset.pattern })}>{preset.label}</button>
                            ))}
                            {rule.pattern ? (
                              <button type="button" disabled={busy} className="rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-medium text-danger hover:bg-danger/15 disabled:opacity-40" onClick={() => updateField(name, { ...rule, pattern: undefined })}>清除</button>
                            ) : null}
                          </div>
                          <input className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2.5 font-mono text-xs outline-none focus:border-primary/40" placeholder="点击上方预设，或手写正则" disabled={busy} value={rule.pattern ?? ''} onChange={(e) => updateField(name, { ...rule, pattern: e.target.value || undefined })} />
                        </div>
                      </div>
                      <div className="mt-2 rounded-lg border border-border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">枚举 enumValues</span>
                          <button type="button" disabled={busy} className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', Array.isArray(rule.enumValues) ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')} onClick={() => updateField(name, { ...rule, enumValues: Array.isArray(rule.enumValues) ? undefined : [''] })}>{Array.isArray(rule.enumValues) ? '已启用' : '启用'}</button>
                        </div>
                        {Array.isArray(rule.enumValues) ? (
                          <textarea className="min-h-[64px] w-full resize-y rounded-lg border border-border bg-muted/30 p-2 font-mono text-xs outline-none" placeholder="Male, Female" disabled={busy} value={(rule.enumValues || []).join(', ')} onChange={(e) => { const parts = e.target.value.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean); updateField(name, { ...rule, enumValues: parts.length ? parts : [''] }); }} />
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">类型覆盖</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-border bg-background p-3">
                          <div className="mb-1.5 text-[11px] text-muted-foreground">主导类型 primaryType</div>
                          <ChipGroup options={PRIMARY_TYPES.map((t) => ({ value: t, label: t || '自动' }))} value={rule.primaryType || ''} busy={busy} onChange={(v) => updateField(name, { ...rule, primaryType: v || undefined })} />
                        </div>
                        <label className="block rounded-lg border border-border bg-background p-3">
                          <span className="mb-1 block text-[11px] text-muted-foreground">默认值 defaultValue</span>
                          <input className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none" disabled={busy} value={rule.defaultValue ?? ''} onChange={(e) => updateField(name, { ...rule, defaultValue: e.target.value || undefined })} />
                        </label>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">转换 / 加解密 transform</div>
                      <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                        <div><div className="mb-1.5 text-[11px] text-muted-foreground">类型 type</div><ChipGroup options={TRANSFORM_TYPES} value={tf.type || ''} busy={busy} onChange={(v) => updateField(name, { ...rule, _tf: { ...tf, type: v || undefined } })} /></div>
                        <div><div className="mb-1.5 text-[11px] text-muted-foreground">转换后再展开 parse</div><ChipGroup options={PARSE_AFTER} value={tf.parse || ''} busy={busy} onChange={(v) => updateField(name, { ...rule, _tf: { ...tf, parse: v || undefined } })} /></div>
                        {tf.type === 'jwt' ? (<label className="block"><span className="mb-1 block text-[11px] text-muted-foreground">JWT claim</span><input className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 font-mono text-sm outline-none" placeholder="sub" disabled={busy} value={tf.claim || ''} onChange={(e) => updateField(name, { ...rule, _tf: { ...tf, claim: e.target.value || undefined } })} /></label>) : null}
                        {(tf.type === 'aes' || tf.type === 'sm4') ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="block sm:col-span-2"><span className="mb-1 block text-[11px] text-muted-foreground">密钥 key</span><input className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 font-mono text-xs outline-none" disabled={busy} value={tf.key || ''} onChange={(e) => updateField(name, { ...rule, _tf: { ...tf, key: e.target.value || undefined } })} /></label>
                            <label className="block sm:col-span-2"><span className="mb-1 block text-[11px] text-muted-foreground">IV</span><input className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 font-mono text-xs outline-none" disabled={busy} value={tf.iv || ''} onChange={(e) => updateField(name, { ...rule, _tf: { ...tf, iv: e.target.value || undefined } })} /></label>
                            <div><div className="mb-1 text-[11px] text-muted-foreground">mode</div><ChipGroup options={AES_MODES.map((m) => ({ value: m, label: m || '默认' }))} value={tf.mode || ''} busy={busy} onChange={(v) => updateField(name, { ...rule, _tf: { ...tf, mode: v || undefined } })} /></div>
                            <div><div className="mb-1 text-[11px] text-muted-foreground">padding</div><ChipGroup options={AES_PADDING.map((m) => ({ value: m, label: m || '默认' }))} value={tf.padding || ''} busy={busy} onChange={(v) => updateField(name, { ...rule, _tf: { ...tf, padding: v || undefined } })} /></div>
                            <div className="sm:col-span-2"><div className="mb-1 text-[11px] text-muted-foreground">format</div><ChipGroup options={KEY_FORMATS.map((m) => ({ value: m, label: m || '默认 base64' }))} value={tf.format || ''} busy={busy} onChange={(v) => updateField(name, { ...rule, _tf: { ...tf, format: v || undefined } })} /></div>
                          </div>
                        ) : null}
                        {tf.type === 'sm2' ? (
                          <div className="grid gap-2">
                            <label className="block"><span className="mb-1 block text-[11px] text-muted-foreground">私钥 privateKey</span><textarea className="min-h-[56px] w-full rounded-lg border border-border bg-muted/30 p-2 font-mono text-xs outline-none" disabled={busy} value={tf.privateKey || ''} onChange={(e) => updateField(name, { ...rule, _tf: { ...tf, privateKey: e.target.value || undefined } })} /></label>
                            <label className="block"><span className="mb-1 block text-[11px] text-muted-foreground">公钥 publicKey</span><textarea className="min-h-[56px] w-full rounded-lg border border-border bg-muted/30 p-2 font-mono text-xs outline-none" disabled={busy} value={tf.publicKey || ''} onChange={(e) => updateField(name, { ...rule, _tf: { ...tf, publicKey: e.target.value || undefined } })} /></label>
                            <label className="block"><span className="mb-1 block text-[11px] text-muted-foreground">签名 signature</span><input className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 font-mono text-xs outline-none" disabled={busy} value={tf.signature || ''} onChange={(e) => updateField(name, { ...rule, _tf: { ...tf, signature: e.target.value || undefined } })} /></label>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">PII / 打码</div>
                      <PiiMaskEditor pii={pii} busy={busy} redact={rule.redact} onChange={(nextPii) => updateField(name, { ...rule, _pii: nextPii })} onRedactChange={(v) => updateField(name, { ...rule, redact: v })} />
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <VisualValueParsers text={text} setText={setText} busy={busy} />
      <VisualExpectations text={text} setText={setText} busy={busy} />
    </div>
  );
}
