import * as React from 'react';
import { cn } from '../../utils/cn';

/**
 * Tiny mono-uppercase label used as a section header pattern across the app.
 * Replaces the 30+ inline repetitions of
 *   "text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest"
 */
export const SectionLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
SectionLabel.displayName = 'SectionLabel';
