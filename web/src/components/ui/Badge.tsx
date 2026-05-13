import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { severityVariants } from '../../utils/severity';
import type { Severity } from '../../types';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const SEVERITY_LABELS: Record<Severity, string> = {
  P0: 'Critical',
  P1: 'High',
  P2: 'Medium',
  P3: 'Low',
  P4: 'Info',
};

/**
 * Severity badge — driven by `severityVariants` from utils/severity.ts.
 * Uses HSL token vars so colors auto-adjust between dark / light themes.
 */
export function SeverityBadge({
  severity,
  size = 'sm',
  className,
  showLabel = false,
}: {
  severity: Severity;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <span className={cn(severityVariants({ sev: severity, size }), className)}>
      <span className="font-bold">{severity}</span>
      {showLabel && <span className="opacity-80">{SEVERITY_LABELS[severity]}</span>}
    </span>
  );
}
