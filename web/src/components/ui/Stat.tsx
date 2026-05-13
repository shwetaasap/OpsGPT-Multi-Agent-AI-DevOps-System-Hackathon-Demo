import * as React from 'react';
import { animate, useMotionValue, useTransform, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Card } from './Card';
import { Sparkline } from './Sparkline';

interface StatProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  iconClassName?: string;
  delta?: number;             // signed percentage; null/0/undefined hides arrow
  format?: (n: number) => string;
  sparkline?: number[];
  sparkColor?: string;
  className?: string;
}

const defaultFormatter = (n: number) => Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(n);

export function Stat({ label, value, icon: Icon, iconClassName, delta, format, sparkline, sparkColor, className }: StatProps) {
  const prefersReducedMotion = useReducedMotion();
  const animatedValue = useMotionValue(typeof value === 'number' && !prefersReducedMotion ? 0 : (typeof value === 'number' ? value : 0));
  const formatted = useTransform(animatedValue, (n) => (format ? format(n) : defaultFormatter(n)));
  const [text, setText] = React.useState(typeof value === 'string' ? value : (format ? format(value) : defaultFormatter(value)));

  React.useEffect(() => {
    if (typeof value === 'string') {
      setText(value);
      return;
    }
    if (prefersReducedMotion) {
      setText(format ? format(value) : defaultFormatter(value));
      return;
    }
    const controls = animate(animatedValue, value, { duration: 0.8, ease: [0.16, 1, 0.3, 1] });
    const unsubscribe = formatted.on('change', (v) => setText(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, format, prefersReducedMotion, animatedValue, formatted]);

  const deltaPositive = (delta ?? 0) > 0;
  const deltaNegative = (delta ?? 0) < 0;
  const showDelta = typeof delta === 'number' && delta !== 0;

  return (
    <Card className={cn('flex flex-col justify-between gap-3 p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        {Icon && (
          <div className={cn('rounded-md bg-muted/40 p-1.5 text-muted-foreground', iconClassName)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{text}</div>
        {showDelta && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium tabular-nums',
              deltaPositive && 'text-success',
              deltaNegative && 'text-destructive'
            )}
          >
            {deltaPositive ? <ArrowUp className="h-3 w-3" /> : deltaNegative ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(delta!).toFixed(1)}%
          </div>
        )}
      </div>

      {sparkline && sparkline.length > 1 && (
        <div className="-mx-5 -mb-5 mt-1">
          <Sparkline data={sparkline} color={sparkColor} height={40} />
        </div>
      )}
    </Card>
  );
}
