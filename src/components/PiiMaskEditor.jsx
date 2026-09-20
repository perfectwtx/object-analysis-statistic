import { cn } from '../lib/cn.js';

function ChipGroup({ options, value, onChange, busy }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? (o || '默认') : o.label;
        return (
          <button
            key={v || 'none'}
            type="button"
            disabled={busy}
            onClick={() => onChange(v)}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              (value || '') === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function previewPartial(keepPrefix, keepSuffix, maskChar) {
  const sample = '13812345678';
  const pre = Number(keepPrefix) || 0;
  const suf = Number(keepSuffix) || 0;
  const ch = (maskChar || '*')[0] || '*';
  if (pre + suf >= sample.length) return sample;
  return sample.slice(0, pre) + ch.repeat(Math.max(0, sample.length - pre - suf)) + sample.slice(sample.length - suf);
}

/**
 * PII mask config editor — aligns with backend PiiMaskConfig:
 * maskAll | keepPrefix + keepSuffix + maskChar
 */
export default function PiiMaskEditor({ pii, onChange, redact, onRedactChange, busy }) {
  const mask = pii?.mask || { maskAll: false, keepPrefix: 3, keepSuffix: 4, maskChar: '*' };
  const enabled = !!pii?.enabled;

  const setMask = (patch) => {
    onChange({
      ...pii,
      mask: { ...mask, ...patch },
    });
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5', enabled ? 'border-primary/40 bg-primary/5' : 'border-border')}>
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-border"
          checked={enabled}
          disabled={busy}
          onChange={(e) => onChange({ ...pii, enabled: e.target.checked })}
        />
        <span>
          <span className="text-sm font-medium">声明为敏感字段 pii</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">报告输出前按下方格式打码（自定义业务字段）</span>
        </span>
      </label>

      {enabled ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">标签 label</span>
              <input
                className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none focus:border-primary/40"
                placeholder="内部标识"
                disabled={busy}
                value={pii.label || ''}
                onChange={(e) => onChange({ ...pii, label: e.target.value })}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={pii.highSeverity !== false}
                disabled={busy}
                onChange={(e) => onChange({ ...pii, highSeverity: e.target.checked })}
              />
              <span className="text-sm">高敏感 highSeverity</span>
            </label>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] text-muted-foreground">打码方式（后端 PiiMaskConfig）</div>
            <ChipGroup
              options={[
                { value: 'all', label: '整值打码' },
                { value: 'partial', label: '保留前后缀' },
              ]}
              value={mask.maskAll ? 'all' : 'partial'}
              busy={busy}
              onChange={(v) => {
                if (v === 'all') {
                  setMask({ maskAll: true, keepPrefix: 0, keepSuffix: 0, maskChar: mask.maskChar || '*' });
                } else {
                  setMask({
                    maskAll: false,
                    keepPrefix: mask.keepPrefix || 3,
                    keepSuffix: mask.keepSuffix || 4,
                    maskChar: mask.maskChar || '*',
                  });
                }
              }}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              {mask.maskAll
                ? '整段替换为打码字符，例如 ********'
                : '保留前缀/后缀，中间填充打码字符，例如 138****5678'}
            </p>
          </div>

          {!mask.maskAll ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '手机风格 3+4', pre: 3, suf: 4 },
                  { label: '身份证风格 4+4', pre: 4, suf: 4 },
                  { label: '银行卡风格 4+4', pre: 4, suf: 4 },
                  { label: '姓名风格 1+0', pre: 1, suf: 0 },
                  { label: '仅留尾号 0+4', pre: 0, suf: 4 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={busy}
                    className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setMask({
                        maskAll: false,
                        keepPrefix: preset.pre,
                        keepSuffix: preset.suf,
                        maskChar: mask.maskChar || '*',
                      })
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-muted-foreground">保留前缀 keepPrefix</span>
                  <input
                    type="number"
                    min={0}
                    className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none focus:border-primary/40"
                    disabled={busy}
                    value={mask.keepPrefix ?? 0}
                    onChange={(e) => setMask({ maskAll: false, keepPrefix: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-muted-foreground">保留后缀 keepSuffix</span>
                  <input
                    type="number"
                    min={0}
                    className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none focus:border-primary/40"
                    disabled={busy}
                    value={mask.keepSuffix ?? 0}
                    onChange={(e) => setMask({ maskAll: false, keepSuffix: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-muted-foreground">打码字符 maskChar</span>
                  <input
                    className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none focus:border-primary/40"
                    disabled={busy}
                    value={mask.maskChar ?? '*'}
                    onChange={(e) => setMask({ maskChar: e.target.value || '*' })}
                  />
                </label>
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                预览：{previewPartial(mask.keepPrefix, mask.keepSuffix, mask.maskChar)}
              </div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-muted-foreground">打码字符 maskChar</span>
                <input
                  className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none focus:border-primary/40"
                  disabled={busy}
                  value={mask.maskChar ?? '*'}
                  onChange={(e) => setMask({ maskAll: true, maskChar: e.target.value || '*' })}
                />
              </label>
              <div className="flex items-end rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                预览：{((mask.maskChar || '*')[0] || '*').repeat(8)}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="pt-1">
        <div className="mb-1.5 text-[11px] text-muted-foreground">redact（与内置检测冲突时）</div>
        <ChipGroup
          options={[
            { value: '', label: '自动' },
            { value: 'true', label: '强制打码' },
            { value: 'false', label: '永不打码' },
          ]}
          value={redact === true ? 'true' : redact === false ? 'false' : ''}
          busy={busy}
          onChange={(v) => onRedactChange?.(v === 'true' ? true : v === 'false' ? false : undefined)}
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          后端还会自动识别手机号 / 身份证 / 银行卡 / 姓名 / 邮箱 / SSN / IBAN / 护照；这里的 pii 用于自定义业务字段。
        </p>
      </div>
    </div>
  );
}
