import { cn } from '../../lib/cn.js';

export function Card({ className, children }) {
  return (
    <div className={cn('rounded-xl bg-card p-5 text-card-foreground shadow-[var(--elev)]', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children }) {
  return <h2 className="text-sm font-medium tracking-tight">{children}</h2>;
}

export function CardHint({ children }) {
  return <p className="mt-1 text-sm text-muted-foreground">{children}</p>;
}
