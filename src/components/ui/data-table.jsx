import { cn } from '../../lib/cn.js';

/** 统一表格外壳：圆角 + 边框 + 横向滚动 */
export function TableShell({ className, children, maxHeight }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-[var(--elev)]',
        className,
      )}
    >
      <div
        className={cn('overflow-x-auto', maxHeight && 'overflow-y-auto')}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/** table 根元素 */
export function Table({ className, dense, children, ...props }) {
  return (
    <table
      className={cn(
        'w-full border-collapse text-left',
        dense ? 'text-[13px] leading-snug' : 'text-sm leading-normal',
        className,
      )}
      {...props}
    >
      {children}
    </table>
  );
}

export function THead({ className, sticky, children, ...props }) {
  return (
    <thead
      className={cn(
        sticky && 'sticky top-0 z-10',
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TH({ className, align = 'left', sticky, children, ...props }) {
  return (
    <th
      className={cn(
        'border-b border-border bg-muted/50 px-3 py-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase whitespace-nowrap',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        sticky && 'sticky left-0 z-[11] bg-muted/90 backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TBody({ className, children, ...props }) {
  return (
    <tbody className={cn('[&>tr:last-child]:border-0', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TR({ className, children, ...props }) {
  return (
    <tr
      className={cn(
        'group border-b border-border/60 transition-colors hover:bg-muted/30',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TD({
  className,
  align = 'left',
  mono,
  muted,
  sticky,
  truncate,
  title,
  children,
  ...props
}) {
  return (
    <td
      title={title}
      className={cn(
        'px-3 py-2.5 align-middle',
        align === 'right' && 'text-right tabular-nums',
        align === 'center' && 'text-center',
        mono && 'font-mono text-[12px]',
        muted && 'text-muted-foreground',
        truncate && 'max-w-[14rem] truncate',
        sticky && 'sticky left-0 z-[1] bg-card group-hover:bg-muted/30',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, children = '暂无数据' }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
