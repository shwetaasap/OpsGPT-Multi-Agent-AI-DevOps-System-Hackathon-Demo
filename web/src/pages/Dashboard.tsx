import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ActivitySquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  Inbox,
  Sparkles,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { SeverityBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Stat } from '../components/ui/Stat';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Skeleton } from '../components/ui/Skeleton';
import { useIncidents } from '../hooks/useIncidents';
import { LogUploader } from '../components/LogUploader';
import { useAnalysis } from '../hooks/useAnalysis';
import { useAnalysisStore } from '../store/AnalysisStore';
import type { AnalysisRun } from '../types';
import { cn } from '../utils/cn';

export function Dashboard() {
  const { incidents } = useIncidents();
  const { current, runs } = useAnalysisStore();
  const { analyze, isAnalyzing, error } = useAnalysis();
  const navigate = useNavigate();
  const [showUploader, setShowUploader] = useState(incidents.length === 0);

  const handleAnalysis = async (logs: string, fileName?: string) => {
    const report = await analyze(logs, fileName);
    if (report && report.incidents.length > 0) {
      setTimeout(() => navigate(`/incidents/${report.incidents[0].id}`), 600);
    }
  };

  const stats = useDashboardStats(runs, incidents);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur p-6 md:p-8">
        <div
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              'radial-gradient(circle at 20% -20%, hsl(var(--primary) / 0.18), transparent 55%), ' +
              'radial-gradient(circle at 90% 110%, hsl(var(--primary) / 0.1), transparent 50%)',
          }}
        />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <SectionLabel className="mb-2 text-primary">
              <ActivitySquare className="h-3 w-3" /> Pipeline overview
            </SectionLabel>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">System Overview</h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Multi-agent incident analysis powered by LangGraph. Drop ops logs to classify, remediate, and
              cost-track in one shot.
            </p>
          </div>
          <Button onClick={() => setShowUploader((v) => !v)} className="gap-2 shrink-0">
            <Sparkles className="h-4 w-4" />
            {showUploader ? 'Hide uploader' : 'Analyze logs'}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showUploader && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-6">
              <LogUploader onAnalysisStart={handleAnalysis} isAnalyzing={isAnalyzing} error={error} />
            </Card>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Hero stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Active Incidents"
          icon={AlertCircle}
          iconClassName="text-[hsl(var(--sev-p0))]"
          value={stats.active}
          delta={stats.activeDelta}
          sparkline={stats.spark.active}
          sparkColor="hsl(var(--sev-p0))"
        />
        <Stat
          label="Resolved 24h"
          icon={CheckCircle2}
          iconClassName="text-success"
          value={stats.resolved}
          delta={stats.resolvedDelta}
          sparkline={stats.spark.resolved}
          sparkColor="hsl(var(--success))"
        />
        <Stat
          label="Avg MTTR"
          icon={Clock}
          iconClassName="text-info"
          value={stats.mttrText}
          sparkline={stats.spark.runs}
        />
        <Stat
          label="Total Token Cost"
          icon={DollarSign}
          iconClassName="text-[hsl(var(--sev-p4))]"
          value={stats.totalCost}
          format={(n) => `$${n.toFixed(4)}`}
          sparkline={stats.spark.cost}
          sparkColor="hsl(var(--sev-p4))"
        />
      </div>

      {/* Latest run summary (if any) */}
      {current && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Latest run
              <span className="text-xs font-mono text-muted-foreground ml-2">
                {current.fileName ?? 'pasted logs'}
              </span>
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(current.startedAt), { addSuffix: true })}
            </span>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <PipelineStat label="Severity" value={current.report.severity ?? '—'} />
            <PipelineStat label="Routing" value={current.report.routing_path ?? '—'} mono />
            <PipelineStat label="Validator" value={current.report.validator_status ?? '—'} />
            <PipelineStat
              label="Quality"
              value={current.report.quality_score != null ? `${current.report.quality_score}/10` : '—'}
            />
            <PipelineStat label="Retries" value={String(current.report.retry_count)} />
            {current.report.usage && (
              <PipelineStat label="Cost" value={`$${current.report.usage.total_cost_usd.toFixed(4)}`} mono />
            )}
          </CardContent>
        </Card>
      )}

      {/* Activity feed + Top services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">Recent Activity</CardTitle>
            <Link to="/history" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            {incidents.length === 0 ? <EmptyActivity /> : <ActivityList incidents={incidents.slice(0, 8)} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground">Top Services</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topServices.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No incidents yet.</p>
            ) : (
              <ul className="space-y-3">
                {stats.topServices.map(([service, count]) => {
                  const max = stats.topServices[0][1];
                  return (
                    <li key={service} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-foreground truncate">{service}</span>
                        <span className="tabular-nums text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / max) * 100}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="h-full bg-primary"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

// ---------- Pieces -----------------------------------------------------------

function PipelineStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <SectionLabel>{label}</SectionLabel>
      <div className={cn('text-sm text-foreground', mono && 'font-mono text-xs break-all')}>{value}</div>
    </div>
  );
}

function ActivityList({ incidents }: { incidents: ReturnType<typeof useIncidents>['incidents'] }) {
  return (
    <ul className="divide-y divide-border">
      {incidents.map((inc, idx) => (
        <motion.li
          key={inc.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.04, duration: 0.2 }}
        >
          <Link
            to={`/incidents/${inc.id}`}
            className="flex items-center gap-3 px-6 py-3 hover:bg-accent/50 transition-colors group"
          >
            <SeverityBadge severity={inc.severity} size="xs" />
            <span className="font-mono text-xs text-muted-foreground shrink-0">{inc.id}</span>
            <span className="flex-1 text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {inc.title}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0 hidden sm:inline">
              {formatDistanceToNow(new Date(inc.timestamp), { addSuffix: true })}
            </span>
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}

function EmptyActivity() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
        <Inbox className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">No incidents yet</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Upload a log file to kick off the multi-agent pipeline. Incidents will appear here as they're classified.
      </p>
    </div>
  );
}

// ---------- Stats helper ----------------------------------------------------

interface DashboardStats {
  active: number;
  activeDelta: number;
  resolved: number;
  resolvedDelta: number;
  mttrText: string | number;
  totalCost: number;
  topServices: [string, number][];
  spark: {
    active: number[];
    resolved: number[];
    runs: number[];
    cost: number[];
  };
}

function useDashboardStats(runs: AnalysisRun[], incidents: ReturnType<typeof useIncidents>['incidents']): DashboardStats {
  return useMemo<DashboardStats>(() => {
    const active = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'closed').length;
    const resolved = incidents.filter((i) => i.status === 'resolved').length;

    const totalCost = runs.reduce((sum, r) => sum + (r.report.usage?.total_cost_usd ?? 0), 0);

    // 12-bucket sparklines: bucket runs/incidents per hour over the last 12 hours.
    const buckets = (predicate: (r: AnalysisRun) => number) => {
      const out = new Array(12).fill(0);
      const now = Date.now();
      const hour = 60 * 60 * 1000;
      for (const r of runs) {
        const ago = (now - new Date(r.startedAt).getTime()) / hour;
        const idx = Math.min(11, Math.max(0, 11 - Math.floor(ago)));
        out[idx] += predicate(r);
      }
      return out;
    };

    const spark = {
      runs: buckets(() => 1),
      active: buckets((r) => r.report.incidents.filter((i) => i.severity === 'critical' || i.severity === 'high').length),
      resolved: buckets((r) => r.report.incidents.length),
      cost: buckets((r) => r.report.usage?.total_cost_usd ?? 0),
    };

    // Top services by incident count (top 5).
    const counts = new Map<string, number>();
    for (const inc of incidents) {
      counts.set(inc.serviceName, (counts.get(inc.serviceName) ?? 0) + 1);
    }
    const topServices = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      active,
      activeDelta: 0,
      resolved,
      resolvedDelta: 0,
      mttrText: incidents.length > 0 ? '—' : '—',
      totalCost,
      topServices,
      spark,
    };
  }, [runs, incidents]);
}

// Re-export Skeleton so the dev tree-shake keeps it; some downstream commits
// reference it via this module.
export { Skeleton };
