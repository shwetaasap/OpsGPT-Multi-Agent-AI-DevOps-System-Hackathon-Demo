import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, AlertTriangle, Info, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { BackendSeverity, RunSeverity, Severity } from '../types';

/**
 * Single source of truth for severity color/icon/label.
 *
 * Colors are driven by `--sev-p*` HSL tokens declared in index.css so they
 * automatically respect dark/light themes. Variants emit Tailwind utilities
 * built on top of those tokens — never bake hex/slate-* colors here.
 */
export const severityVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border font-medium tabular-nums',
  {
    variants: {
      sev: {
        P0: 'bg-[hsl(var(--sev-p0)/0.1)] text-[hsl(var(--sev-p0))] border-[hsl(var(--sev-p0)/0.3)]',
        P1: 'bg-[hsl(var(--sev-p1)/0.1)] text-[hsl(var(--sev-p1))] border-[hsl(var(--sev-p1)/0.3)]',
        P2: 'bg-[hsl(var(--sev-p2)/0.1)] text-[hsl(var(--sev-p2))] border-[hsl(var(--sev-p2)/0.3)]',
        P3: 'bg-[hsl(var(--sev-p3)/0.1)] text-[hsl(var(--sev-p3))] border-[hsl(var(--sev-p3)/0.3)]',
        P4: 'bg-[hsl(var(--sev-p4)/0.1)] text-[hsl(var(--sev-p4))] border-[hsl(var(--sev-p4)/0.3)]',
      },
      size: {
        xs: 'px-1.5 py-0.5 text-[10px] uppercase tracking-wider',
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
      },
    },
    defaultVariants: {
      sev: 'P3',
      size: 'sm',
    },
  }
);

export type SeverityVariantProps = VariantProps<typeof severityVariants>;

const SEVERITY_LABELS: Record<Severity, string> = {
  P0: 'Critical',
  P1: 'High',
  P2: 'Medium',
  P3: 'Low',
  P4: 'Info',
};

const SEVERITY_ICONS: Record<Severity, LucideIcon> = {
  P0: ShieldAlert,
  P1: AlertCircle,
  P2: AlertTriangle,
  P3: Info,
  P4: ShieldCheck,
};

export function getSeverityLabel(sev: Severity): string {
  return SEVERITY_LABELS[sev] ?? 'Unknown';
}

export function getSeverityIcon(sev: Severity): LucideIcon {
  return SEVERITY_ICONS[sev] ?? Info;
}

/**
 * Map the backend's `BackendSeverity` (info/warn/high/critical) to the UI's
 * canonical `Severity` (P0..P4) used by every badge / icon / token lookup.
 */
const BACKEND_TO_SEVERITY: Record<BackendSeverity, Severity> = {
  critical: 'P0',
  high: 'P1',
  warn: 'P2',
  info: 'P3',
};

export function fromBackendSeverity(s: BackendSeverity | null | undefined): Severity {
  if (!s) return 'P4';
  return BACKEND_TO_SEVERITY[s] ?? 'P4';
}

/**
 * Aggregate run severity (info/low/medium/high/critical) → P0..P4.
 */
const RUN_TO_SEVERITY: Record<RunSeverity, Severity> = {
  critical: 'P0',
  high: 'P1',
  medium: 'P2',
  low: 'P3',
  info: 'P4',
};

export function fromRunSeverity(s: RunSeverity | null | undefined): Severity {
  if (!s) return 'P4';
  return RUN_TO_SEVERITY[s] ?? 'P4';
}
