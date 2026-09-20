import { useMemo, useState } from 'react';
import { parseJsonc } from '../utils.js';
import { cn } from '../lib/cn.js';
import VisualExpectations from './VisualExpectations.jsx';

/** Supported FieldRule attributes (aligned with backend / RULES_TEMPLATE). */
export const FIELD_ATTRS = [
  { key: 'required', label: '必填', type: 'bool', hint: '字段必须出现且非空' },
  { key: 'unique', label: '唯一', type: 'bool', hint: '取值在数据集中唯一' },
  { key: 'enumValues', label: '枚举', type: 'enum', hint: '只允许列出的取值' },
  { key: 'pattern', label: '正则', type: 'string', hint: '匹配正则表达式', placeholder: '\\S+@\\S+' },
  { key: 'minValue', label: '最小值', type: 'number', hint: '数值下界' },
  { key: 'maxValue', label: '最大值', type: 'number', hint: '数值上界' },
  { key: 'nullRateMax', label: '空值率上限', type: 'rate', hint: '缺失+null 比例上限 (0–1)' },
  { key: 'transformParse', label: '解析转换', type: 'parse', hint: '先按格式解开再统计' },
];

const PARSE_OPTS = [
  { value: '', label: '无' },
  { value: 'json', label: 'JSON' },
  { value: 'jwt', label: 'JWT' },
  { value: 'base64', label: 'Base64' },
  { value: 'url', label: 'URL' },
];

function emptyRule() {
  return {};
}

function ruleFromObj(obj) {
  if (!obj || typeof obj !== 'object') return emptyRule();
  const r = { ...obj };
  if (r.transform?.parse) {
    r.transformParse = r.transform.parse;
  }
  return r;
}

function objFromRule(form) {
  const out = {};
  if (form.required) out.required = true;
  if (form.unique) out.unique = true;
  if (Array.isArray(form.enumValues) && form.enumValues.length) {
    out.enumValues = form.enumValues.filter((x) => String(x).length);
  }
  if (form.pattern != null && String(form.pattern).trim()) {
    out.pattern = String(form.pattern);
  }
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
  if (form.transformParse) {
    out.transform = { parse: form.transformParse };
  }
  return out;
}

function parseFieldsFromText(text) {
  try {
    if (!text?.trim()) return {};
    const obj = parseJsonc(text);
    const fields = obj?.fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
    return fields;
  } catch {
    return null;
  }
}

function writeFieldsIntoText(text, fields) {
  let obj;
  try {
    obj = text?.trim() ? parseJsonc(text) : {};
  } catch {
    obj = { runtime: { flatten: true }, fields: {}, expectations: {} };
  }
  if (!obj || typeof obj !== 'object') obj = {};
  obj.fields = fields;
  return `${JSON.stringify(obj, null, 2)}\n`;
}

function summaryOf(rule) {
  const bits = [];
  if (rule.required) bits.push('必填');
  if (rule.unique) bits.push('唯一');
  if (Array.isArray(rule.enumValues) && rule.enumValues.length) bits.push(`枚举×${rule.enumValues.length}`);
  if (rule.pattern) bits.push('正则');
  if (rule.minValue != null) bits.push(`≥${rule.minValue}`);
  if (rule.maxValue != null) bits.push(`≤${rule.maxValue}`);
  if (rule.nullRateMax != null) bits.push(`空≤${rule.nullRateMax}`);
  if (rule.transform?.parse) bits.push(`解析:${rule.transform.parse}`);
  return bits.length ? bits.join(' · ') : '未配置属性';
}

export default function VisualFieldRules({ text, setText, busy }) {
  const parsed = useMemo(() => parseFieldsFromText(text), [text]);
  const parseError = parsed === null;
  const [expanded, setExpanded] = useState(null);
  const [newName, setNewName] = useState('');
  const [draftName, setDraftName] = useState('');

  const entries = useMemo(() => {
    if (!parsed) return [];
    return Object.entries(parsed).map(([name, rule]) => ({
      name,
      rule: ruleFromObj(rule),
      raw: rule,
    }));
  }, [parsed]);

  const commitFields = (nextMap) => {
    setText?.(writeFieldsIntoText(text, nextMap));
  };

  const updateField = (name, formRule) => {
    if (!parsed) return;
    const next = { ...parsed, [name]: objFromRule(formRule) };
    commitFields(next);
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
    if (!n || n === oldName || !parsed) return;
    if (parsed[n]) return;
    const next = {};
    for (const [k, v] of Object.entries(parsed)) {
      next[k === oldName ? n : k] = v;
    }
    commitFields(next);
    if (expanded === oldName) setExpanded(n);
  };

  const addField = () => {
    const n = newName.trim();
    if (!n) return;
    const base = parsed && typeof parsed === 'object' ? { ...parsed } : {};
    if (base[n]) return;
    base[n] = { required: true };
    commitFields(base);
    setNewName('');
    setExpanded(n);
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
        为每个字段勾选校验属性；修改会实时写回规则 JSON。可与「JSON」视图切换。
      </p>

      <div className="flex gap-2">
        <input
          className="h-10 flex-1 rounded-lg border border-border bg-muted/40 px-3 text-sm outline-none focus:border-primary/40"
          placeholder="新字段名，如 email 或 address.city"
          value={newName}
          disabled={busy}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addField();
            }
          }}
        />
        <button
          type="button"
          disabled={busy || !newName.trim()}
          onClick={addField}
          className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          添加字段
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          还没有字段规则。输入字段名后点击「添加字段」，或从样例模板载入。
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map(({ name, rule }) => {
            const open = expanded === name;
            return (
              <li
                key={name}
                className={cn(
                  'overflow-hidden rounded-xl border border-border bg-muted/20 transition-colors',
                  open && 'border-primary/30 bg-card',
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                  onClick={() => {
                    setExpanded(open ? null : name);
                    setDraftName(name);
                  }}
                  disabled={busy}
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-md text-[11px] transition-transform',
                      open ? 'bg-primary/15 text-primary rotate-90' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    ›
                  </span>
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
                        <input
                          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 font-mono text-sm outline-none focus:border-primary/40"
                          value={draftName}
                          disabled={busy}
                          onChange={(e) => setDraftName(e.target.value)}
                          onBlur={() => renameField(name, draftName)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              renameField(name, draftName);
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="h-9 rounded-lg px-3 text-xs text-danger hover:bg-danger/10"
                        disabled={busy}
                        onClick={() => removeField(name)}
                      >
                        删除字段
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {FIELD_ATTRS.filter((a) => a.type === 'bool').map((a) => (
                        <label
                          key={a.key}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                            rule[a.key]
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border bg-background hover:border-border/80',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 rounded border-border"
                            checked={!!rule[a.key]}
                            disabled={busy}
                            onChange={(e) =>
                              updateField(name, { ...rule, [a.key]: e.target.checked })
                            }
                          />
                          <span>
                            <span className="text-sm font-medium">{a.label}</span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">{a.hint}</span>
                          </span>
                        </label>
                      ))}

                      <div className="sm:col-span-2 rounded-lg border border-border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">枚举值</div>
                            <div className="text-[11px] text-muted-foreground">逗号或换行分隔；留空表示不限制</div>
                          </div>
                          <button
                            type="button"
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                              Array.isArray(rule.enumValues) && rule.enumValues.length
                                ? 'bg-primary/15 text-primary'
                                : 'bg-muted text-muted-foreground',
                            )}
                            disabled={busy}
                            onClick={() => {
                              if (Array.isArray(rule.enumValues) && rule.enumValues.length) {
                                updateField(name, { ...rule, enumValues: undefined });
                              } else {
                                updateField(name, { ...rule, enumValues: [''] });
                              }
                            }}
                          >
                            {Array.isArray(rule.enumValues) && rule.enumValues.length ? '已启用' : '启用'}
                          </button>
                        </div>
                        {Array.isArray(rule.enumValues) ? (
                          <textarea
                            className="min-h-[72px] w-full resize-y rounded-lg border border-border bg-muted/30 p-2 font-mono text-xs outline-none focus:border-primary/40"
                            placeholder="Male, Female, Unknown"
                            disabled={busy}
                            value={(rule.enumValues || []).join(', ')}
                            onChange={(e) => {
                              const parts = e.target.value
                                .split(/[,，\n]/)
                                .map((s) => s.trim())
                                .filter(Boolean);
                              updateField(name, { ...rule, enumValues: parts.length ? parts : [''] });
                            }}
                          />
                        ) : null}
                      </div>

                      <div className="rounded-lg border border-border bg-background p-3">
                        <div className="mb-1.5 text-sm font-medium">正则 pattern</div>
                        <input
                          className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2.5 font-mono text-xs outline-none focus:border-primary/40"
                          placeholder="\\S+@\\S+"
                          disabled={busy}
                          value={rule.pattern ?? ''}
                          onChange={(e) =>
                            updateField(name, {
                              ...rule,
                              pattern: e.target.value || undefined,
                            })
                          }
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-background p-3">
                        <label>
                          <span className="mb-1 block text-[11px] text-muted-foreground">最小值</span>
                          <input
                            type="number"
                            className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none focus:border-primary/40"
                            disabled={busy}
                            value={rule.minValue ?? ''}
                            onChange={(e) =>
                              updateField(name, {
                                ...rule,
                                minValue: e.target.value === '' ? undefined : e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] text-muted-foreground">最大值</span>
                          <input
                            type="number"
                            className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none focus:border-primary/40"
                            disabled={busy}
                            value={rule.maxValue ?? ''}
                            onChange={(e) =>
                              updateField(name, {
                                ...rule,
                                maxValue: e.target.value === '' ? undefined : e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>

                      <div className="rounded-lg border border-border bg-background p-3">
                        <div className="mb-1.5 text-sm font-medium">空值率上限</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.05}
                            className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none focus:border-primary/40"
                            placeholder="0.2"
                            disabled={busy}
                            value={rule.nullRateMax ?? ''}
                            onChange={(e) =>
                              updateField(name, {
                                ...rule,
                                nullRateMax: e.target.value === '' ? undefined : e.target.value,
                              })
                            }
                          />
                          <span className="shrink-0 text-[11px] text-muted-foreground">0–1</span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-background p-3">
                        <div className="mb-1.5 text-sm font-medium">解析转换</div>
                        <div className="flex flex-wrap gap-1.5">
                          {PARSE_OPTS.map((o) => (
                            <button
                              key={o.value || 'none'}
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                updateField(name, {
                                  ...rule,
                                  transformParse: o.value || undefined,
                                })
                              }
                              className={cn(
                                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                                (rule.transformParse || '') === o.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <VisualExpectations text={text} setText={setText} busy={busy} />
    </div>
  );
}
