import React from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Check,
  Copy,
  AlertTriangle,
  ShieldAlert,
  Terminal,
  Download,
  Info,
  Server,
  Zap,
  Activity,
} from 'lucide-react';
import { AnalysisResult } from '../types';
import { cn } from '../utils/cn';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface RemediationPanelProps {
  analysis: AnalysisResult;
}

export function RemediationPanel({ analysis }: RemediationPanelProps) {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = () => {
    const text = analysis.remediationSteps.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confidence = analysis.confidence ?? 0;
  const confidenceColor =
    confidence > 0.8 ? 'text-green-500' : confidence > 0.6 ? 'text-yellow-500' : 'text-muted-foreground';
  const confidenceLabel = confidence > 0 ? `${(confidence * 100).toFixed(0)}%` : '—';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBox icon={Server} label="Affected Service" value={analysis.serviceAffected ?? '—'} color="text-primary" />
        <MetricBox icon={Zap} label="RAG Confidence" value={confidenceLabel} color={confidenceColor} />
        <MetricBox icon={ShieldAlert} label="Escalation" value={analysis.recommendedEscalation ?? '—'} color="text-red-500" />
        <MetricBox icon={Activity} label="Est. Restoration" value={analysis.estimatedTime ?? '—'} color="text-muted-foreground" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Executive Summary" icon={<Info className="w-4 h-4 text-primary" />}>
            <p className="text-foreground/90 leading-relaxed mt-2">{analysis.summary}</p>
          </Card>

          <Card title="Root Cause Analysis" icon={<Terminal className="w-4 h-4 text-primary" />}>
            <div className="prose prose-invert prose-sm max-w-none mt-2 text-foreground/90">
              <ReactMarkdown>{analysis.rootCause}</ReactMarkdown>
            </div>
            {analysis.reasoning && (
              <div className="mt-4 p-4 bg-card border border-border rounded-lg">
                <h5 className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Activity className="w-3 h-3" /> Pipeline Reasoning
                </h5>
                <p className="text-xs text-muted-foreground italic">{analysis.reasoning}</p>
              </div>
            )}
          </Card>

          <Card title="Remediation Steps" icon={<Zap className="w-4 h-4 text-primary" />}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">{analysis.remediationSteps.length} step{analysis.remediationSteps.length === 1 ? '' : 's'}</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={copyToClipboard}>
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy Steps'}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => copyToClipboard()}>
                  <Download className="w-3 h-3" /> Export
                </Button>
              </div>
            </div>
            {analysis.remediationSteps.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No remediation steps generated.</p>
            ) : (
              <div className="space-y-3">
                {analysis.remediationSteps.map((step, i) => (
                  <div key={i} className="flex gap-4 group">
                    <div className="w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground">{i + 1}</span>
                    </div>
                    <div className="flex-1 pb-4 border-b border-border group-last:border-0">
                      <div className="prose prose-invert prose-sm max-w-none text-foreground/90">
                        <ReactMarkdown>{step}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {analysis.operationalImpact && (
            <Card title="Operational Impact" icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}>
              <div className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
                {analysis.operationalImpact}
              </div>
            </Card>
          )}

          {analysis.rollbackPlan && analysis.rollbackPlan.length > 0 && (
            <Card title="Rollback" icon={<ShieldAlert className="w-4 h-4 text-red-500" />}>
              <ul className="mt-2 space-y-2">
                {analysis.rollbackPlan.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed pl-4 border-l border-red-900/50 italic">
                    {r}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

interface MetricBoxProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}

function MetricBox({ icon: Icon, label, value, color }: MetricBoxProps) {
  return (
    <div className="bg-card/50 border border-border p-4 rounded-xl flex items-center gap-4">
      <div className={cn('p-2 rounded-lg bg-background border border-border/50', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{label}</div>
        <div className="text-xs font-bold text-foreground mt-0.5 break-all">{value}</div>
      </div>
    </div>
  );
}
