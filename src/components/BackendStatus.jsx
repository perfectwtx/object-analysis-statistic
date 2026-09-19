import { cn } from '../lib/cn.js';
import { usePlatform } from '../lib/store.js';

export function BackendStatus({ className }) {
  const backendOk = usePlatform((s) => s.backendOk);
  const source = usePlatform((s) => s.source);
  const loading = usePlatform((s) => s.loading);

  const label = loading
    ? '连接中…'
    : backendOk
      ? source === 'api'
        ? '后端已连接'
        : '后端在线 · 部分接口演示'
      : '演示模式';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
        backendOk ? 'bg-ok/15 text-ok' : 'bg-muted text-muted-foreground',
        className,
      )}
      title={backendOk ? 'ObjectAnalyzer.Api 可达' : '无法连接后端，页面使用演示数据'}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          loading ? 'animate-pulse bg-warn' : backendOk ? 'bg-ok' : 'bg-muted-foreground',
        )}
      />
      {label}
    </span>
  );
}
