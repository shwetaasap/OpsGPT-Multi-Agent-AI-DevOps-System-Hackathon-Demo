import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, Sparkles, Terminal, Upload, Activity, Inbox, Server, Zap, MessageSquare, Ticket } from 'lucide-react';
import { useIncident, useLiveWorkflow } from '../hooks/useIncidents';
import { useAnalysis } from '../hooks/useAnalysis';
import { useAnalysisStore } from '../store/AnalysisStore';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { SeverityBadge } from '../components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Separator } from '../components/ui/Separator';
import { cn } from '../utils/cn';
import { RemediationPanel } from '../components/RemediationPanel';
import { CookbookPanel } from '../components/CookbookPanel';
import { AgentWorkflowGraph } from '../components/AgentWorkflowGraph';

export function IncidentDetails() {
  const { id } = useParams();
  const { incident } = useIncident(id!);
  const { workflow } = useLiveWorkflow(id!);
  const { runs } = useAnalysisStore();
  const run = runs.find((r) => r.report.incidents.some((i) => i.id === id));
  const report = run?.report;
  const { analysis, analyze, isAnalyzing, error: analysisError } = useAnalysis({
    asAnalysisResult: true,
    incidentId: id,
  });
  const [logs, setLogs] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setLogs(content);
        setActiveTab('logs');
        analyze(content, file.name);
      };
      reader.readAsText(file);
    }
  };

  if (!incident) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex flex-col items-center justify-center text-center space-y-4">
        <Inbox className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Incident <span className="font-mono text-foreground">{id}</span> not found in any local run.
        </p>
        <Link to="/" className="text-xs font-medium text-primary hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 w-full">
      {/* Breadcrumb header — not sticky so it doesn't overlap the meta strip
          below as the user scrolls. The DashboardLayout's main header is
          already sticky, so global navigation context is always available. */}
      <div className="-mx-6 md:-mx-8 px-6 md:px-8 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1.5 -ml-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Back to dashboard"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/incidents" className="hover:text-foreground transition-colors">Incidents</Link>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-mono text-foreground">{incident.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={isAnalyzing}
              disabled={isAnalyzing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Re-run with new logs
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".log,.txt,.json"
              onChange={onFileUpload}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">{incident.title}</h1>
          <SeverityBadge severity={incident.severity} size="sm" showLabel />
          <span className="text-xs text-muted-foreground hidden md:inline">
            {incident.serviceName} · {incident.incidentType}
          </span>
        </div>
      </div>

      {analysisError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive break-all">
          {analysisError}
        </div>
      )}

      {/* Horizontal meta strip — facts at a glance, full width */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetaCell icon={Server} label="Service" value={incident.serviceName} mono />
        <MetaCell label="Type" value={incident.incidentType} />
        <MetaCell label="Source" value={incident.source} mono />
        {incident.assignedTeam && <MetaCell label="Team" value={incident.assignedTeam} />}
        {incident.slackChannel && (
          <MetaCell icon={MessageSquare} label="Slack" value={incident.slackChannel} mono />
        )}
        {incident.jiraTicket && (
          <MetaCell icon={Ticket} label="JIRA" value={incident.jiraTicket} mono />
        )}
        {report?.usage && (
          <MetaCell label="Token Cost" value={`$${report.usage.total_cost_usd.toFixed(4)}`} mono accent />
        )}
        {report?.validator_status && (
          <MetaCell label="Validator" value={report.validator_status} />
        )}
        {report?.quality_score != null && (
          <MetaCell label="Quality" value={`${report.quality_score}/10`} />
        )}
      </div>

      {/* Full-width tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="cookbook">Cookbook</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {!analysis ? <NoAnalysisYet /> : <RemediationPanel analysis={analysis} />}
        </TabsContent>

        <TabsContent value="workflow">
          {workflow ? (
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Agent Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-6">
                <AgentWorkflowGraph nodes={workflow.nodes} report={report} />
              </CardContent>
            </Card>
          ) : <NoAnalysisYet />}
        </TabsContent>

        <TabsContent value="logs">
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <SectionLabel>Log buffer</SectionLabel>
              </div>
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3 w-3" />
                Upload &amp; re-analyze
              </Button>
            </div>
            <pre className="p-4 max-h-[600px] overflow-auto font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {logs || <span className="text-muted-foreground/60 italic">Log buffer empty. Upload a file to attach raw logs.</span>}
            </pre>
          </Card>
        </TabsContent>

        <TabsContent value="cookbook">
          {!analysis ? <NoAnalysisYet /> : <CookbookPanel analysis={analysis} />}
        </TabsContent>

        <TabsContent value="pipeline">
          {!report ? (
            <NoAnalysisYet />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Pipeline state</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <MetaRow label="Run severity" value={report.severity ?? '—'} />
                  <MetaRow label="Routing path" value={report.routing_path ?? '—'} mono />
                  <MetaRow label="Validator" value={report.validator_status ?? '—'} />
                  <MetaRow
                    label="Quality"
                    value={report.quality_score != null ? `${report.quality_score}/10` : '—'}
                  />
                  <MetaRow label="Retries" value={String(report.retry_count)} />
                  {report.human_approval_status && (
                    <MetaRow label="Approval" value={report.human_approval_status} />
                  )}
                  {report.escalation_required && <MetaRow label="Escalation" value="required" />}
                </CardContent>
              </Card>

              {report.usage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" /> Token cost
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <MetaRow label="LLM calls" value={String(report.usage.llm_calls)} />
                    <MetaRow label="Input tokens" value={report.usage.total_tokens_input.toLocaleString()} />
                    <MetaRow label="Output tokens" value={report.usage.total_tokens_output.toLocaleString()} />
                    <MetaRow label="Total tokens" value={report.usage.total_tokens.toLocaleString()} />
                    <Separator />
                    <MetaRow label="Total token cost" value={`$${report.usage.total_cost_usd.toFixed(4)}`} mono />
                    {report.usage.models_used.length > 0 && (
                      <MetaRow label="Models" value={report.usage.models_used.join(', ')} mono />
                    )}
                  </CardContent>
                </Card>
              )}

              {report.execution_path.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Execution path</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-1.5">
                      {report.execution_path.map((step, i) => (
                        <motion.li
                          key={`${step}-${i}`}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.15 }}
                          className="flex items-center gap-2 text-xs text-foreground"
                        >
                          <span className="font-mono text-[10px] text-muted-foreground w-4">{i + 1}</span>
                          <span className="font-mono">{step}</span>
                        </motion.li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function MetaCell({ icon: Icon, label, value, mono, accent }: { icon?: React.ElementType; label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className={cn(
      'rounded-lg border border-border bg-card/40 p-3',
      accent && 'border-primary/30 bg-primary/5'
    )}>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={cn(
        'text-sm font-medium text-foreground break-all',
        mono && 'font-mono text-xs',
        accent && 'text-primary'
      )}>
        {value}
      </div>
    </div>
  );
}

function MetaRow({ icon: Icon, label, value, mono }: { icon?: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-mono flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className={cn('text-right text-foreground break-all', mono && 'font-mono text-[11px]')}>{value}</span>
    </div>
  );
}

function NoAnalysisYet() {
  return (
    <Card className="p-12 text-center border-dashed">
      <Sparkles className="h-12 w-12 text-primary/30 mx-auto mb-4" />
      <h3 className="text-foreground font-semibold mb-2">No analysis attached to this incident</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Upload a log file (top right) to re-run the pipeline against this incident.
      </p>
    </Card>
  );
}
