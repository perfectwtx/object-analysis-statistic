import { cva } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '../../lib/cn.js';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[opacity,transform] duration-150 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        secondary: 'bg-card text-foreground shadow-[var(--elev)] hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export const Button = forwardRef(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = 'Button';
