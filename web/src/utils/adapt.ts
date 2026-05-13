import {
  AgentNode,
  AgentStatus,
  AnalysisReport,
  AnalysisResult,
  AnalysisRun,
  BackendFix,
  BackendIncident,
  BackendSeverity,
  Incident,
  IncidentStatus,
  IntegrationStatus,
  Severity,
  WorkflowExecution,
} from '../types';

const SEVERITY_MAP: Record<BackendSeverity, Severity> = {
  critical: 'P0',
  high: 'P1',
  warn: 'P2',
  info: 'P3',
};

export function toFrontendSeverity(s: BackendSeverity): Severity {
  return SEVERITY_MAP[s] ?? 'P4';
}

function statusFor(severity: BackendSeverity, hasFix: boolean): IncidentStatus {
  if (!hasFix) return 'analyzing';
  if (severity === 'critical' || severity === 'high') return 'remediating';
  return 'active';
}

export function toIncident(
  inc: BackendIncident,
  fix: BackendFix | undefined,
  run: AnalysisRun
): Incident {
  return {
    id: inc.id,
    title: inc.summary || inc.error_type,
    status: statusFor(inc.severity, !!fix),
    severity: toFrontendSeverity(inc.severity),
    timestamp: inc.first_seen ?? run.startedAt,
    source: run.fileName ?? 'log upload',
    serviceName: inc.service,
    incidentType: inc.error_type,
    assignedWorkflow: run.report.routing_path ?? fix?.runbook_ref ?? 'auto-classified',
    shortDescription: inc.summary,
    assignedTeam: inc.service,
    slackChannel: run.report.slack_channel ?? run.report.slack_thread_ts ?? undefined,
    jiraTicket: run.report.jira_keys[0],
  };
}

export function toAnalysisResult(
  inc: BackendIncident,
  fix: BackendFix | undefined,
  report: AnalysisReport
): AnalysisResult {
  return {
    severity: toFrontendSeverity(inc.severity),
    summary: inc.summary,
    rootCause: fix?.rationale ?? 'No remediation generated.',
    remediationSteps: fix?.steps ?? [],
    confidence: report.rag_confidence === 'high' ? 0.9 :
                report.rag_confidence === 'medium' ? 0.7 :
                report.rag_confidence === 'low' ? 0.5 : undefined,
    reasoning: report.rag_sources.length > 0
      ? `Grounded in runbook(s): ${report.rag_sources.join(', ')}`
      : undefined,
    operationalImpact: inc.evidence,
    serviceAffected: inc.service,
    recommendedEscalation: inc.severity === 'critical' ? 'L3' :
                           inc.severity === 'high' ? 'L2' : 'L1',
    validationSteps: report.validation_reason ? [report.validation_reason] : undefined,
    rollbackPlan: fix?.risk === 'high'
      ? [`Risk flagged ${fix.risk} — verify rollback path before applying.`]
      : undefined,
    estimatedTime: undefined,
  };
}

interface NodeSpec {
  id: string;
  name: string;
  description: string;
  output: (r: AnalysisReport) => string | undefined;
}

const NODE_SPECS: NodeSpec[] = [
  {
    id: 'classify',
    name: 'Classifier',
    description: 'Reads raw logs and extracts typed incidents.',
    output: r => `Extracted ${r.incidents.length} incident${r.incidents.length === 1 ? '' : 's'}.`,
  },
  {
    id: 'severity_router',
    name: 'Severity Router',
    description: 'Pure-Python router — picks the downstream branch from aggregate severity.',
    output: r => r.severity ? `Severity: ${r.severity} → ${r.routing_path ?? 'n/a'}` : undefined,
  },
  {
    id: 'deep_analysis',
    name: 'Deep Analysis',
    description: 'Extra correlation/dependency mapping for critical and high-severity runs.',
    output: r => r.flags.requires_deep_analysis ? 'Deep analysis triggered.' : 'Skipped.',
  },
  {
    id: 'rag_retriever',
    name: 'RAG Retriever',
    description: 'Fetches relevant runbook snippets via BM25 over knowledge_base/.',
    output: r =>
      r.flags.requires_rag
        ? `Retrieved ${r.rag_snippet_count} snippet${r.rag_snippet_count === 1 ? '' : 's'} (confidence: ${r.rag_confidence}).`
        : 'Skipped.',
  },
  {
    id: 'remediate',
    name: 'Remediation',
    description: 'Generates a Fix per incident, grounded in retrieved runbooks.',
    output: r => `Generated ${Object.keys(r.remediations).length} fix${Object.keys(r.remediations).length === 1 ? '' : 'es'}.`,
  },
  {
    id: 'validator',
    name: 'Validator / Critic',
    description: 'Scores remediations and gates retries vs escalation.',
    output: r =>
      r.validator_status
        ? `${r.validator_status} · score ${r.quality_score ?? '—'}/10 · retries ${r.retry_count}`
        : undefined,
  },
  {
    id: 'cookbook',
    name: 'Cookbook',
    description: 'Synthesizes one consolidated runbook checklist.',
    output: r => r.cookbook ? `${r.cookbook.title} — ${r.cookbook.items.length} items.` : undefined,
  },
  {
    id: 'summary_report',
    name: 'Summary Report',
    description: 'Lightweight branch for info-only logs — bypasses remediation entirely. Only fires when the aggregate severity is "info".',
    output: r =>
      r.severity === 'info'
        ? 'Used — info-only logs.'
        : `Skipped — severity "${r.severity ?? '—'}" took the full remediation path.`,
  },
  {
    id: 'human_approval',
    name: 'Human Approval',
    description: 'Gate for critical/escalated incidents.',
    output: r => r.human_approval_status ? `Status: ${r.human_approval_status}` : undefined,
  },
  {
    id: 'slack',
    name: 'Slack Notifier',
    description: 'Demo-safe mock Slack notification.',
    output: r =>
      r.slack_status === 'sent_mock' || r.slack_status === 'prepared_mock'
        ? `${r.slack_status}: ${r.slack_message_preview ?? r.slack_thread_ts}`
        : 'Skipped.',
  },
  {
    id: 'jira',
    name: 'JIRA Ticketer',
    description: 'Demo-safe mock JIRA ticket creation.',
    output: r => r.jira_keys.length > 0 ? `${r.jira_status ?? 'created_mock'}: ${r.jira_keys.join(', ')}` : 'Skipped.',
  },
  {
    id: 'report',
    name: 'Report Builder',
    description: 'Renders the consolidated markdown report.',
    output: r => r.report_md ? `Rendered ${r.report_md.length} chars.` : undefined,
  },
];

function nodeStatus(spec: NodeSpec, visited: Set<string>): AgentStatus {
  return visited.has(spec.id) ? 'completed' : 'pending';
}

export function toWorkflowExecution(run: AnalysisRun, incidentId: string): WorkflowExecution {
  const visited = new Set(run.report.execution_path);
  const nodes: AgentNode[] = NODE_SPECS.map(spec => ({
    id: spec.id,
    name: spec.name,
    description: spec.description,
    status: nodeStatus(spec, visited),
    output: spec.output(run.report) ?? undefined,
  }));

  return {
    id: run.runId,
    incidentId,
    startedAt: run.startedAt,
    nodes,
  };
}

export function toIntegrations(run: AnalysisRun | null): IntegrationStatus[] {
  if (!run) return [];
  const r = run.report;

  const slackOk = r.slack_status === 'sent_mock' || r.slack_status === 'prepared_mock';
  const jiraOk = r.jira_status === 'created_mock' || r.jira_keys.length > 0;

  return [
    {
      id: 'slack',
      name: 'Slack Notifier',
      type: 'notification',
      status: slackOk ? 'healthy' : 'offline',
      latency: '—',
      uptime: r.slack_status ?? 'skipped',
      lastExecution: {
        timestamp: run.startedAt,
        status: slackOk ? 'success' : 'failure',
        retryCount: 0,
        payload: undefined,
        response: r.slack_message_preview || r.slack_thread_ts || 'skipped',
      },
    },
    {
      id: 'jira',
      name: 'JIRA Ticketer',
      type: 'ticketing',
      status: jiraOk ? 'healthy' : 'offline',
      latency: '—',
      uptime: r.jira_status ?? 'skipped',
      lastExecution: {
        timestamp: run.startedAt,
        status: jiraOk ? 'success' : 'failure',
        retryCount: 0,
        payload: undefined,
        response: r.jira_summary || (r.jira_keys.length ? r.jira_keys.join(', ') : 'skipped'),
      },
    },
    {
      id: 'rag',
      name: 'Knowledge Base (BM25)',
      type: 'monitoring',
      status: r.rag_confidence === 'none' ? 'degraded' : 'healthy',
      latency: '—',
      uptime: r.rag_confidence,
      lastExecution: {
        timestamp: run.startedAt,
        status: r.rag_sources.length > 0 ? 'success' : 'failure',
        retryCount: 0,
        payload: undefined,
        response: r.rag_sources.join(', ') || 'no sources matched',
      },
    },
  ];
}

// ---- Run-level summary used on Workflow + Dashboard --------------------

export interface RunSummary {
  severity: string;
  routingPath: string;
  routingReason: string;
  validatorStatus: string;
  qualityScore: string;
  retryCount: number;
  humanApproval: string;
  executionPath: string[];
  flags: AnalysisReport['flags'];
}

export function summarizeRun(report: AnalysisReport): RunSummary {
  return {
    severity: report.severity ?? '—',
    routingPath: report.routing_path ?? '—',
    routingReason: report.routing_reason ?? 'No routing decision recorded.',
    validatorStatus: report.validator_status ?? '—',
    qualityScore: report.quality_score != null ? `${report.quality_score}/10` : '—',
    retryCount: report.retry_count,
    humanApproval: report.human_approval_status ?? '—',
    executionPath: report.execution_path,
    flags: report.flags,
  };
}
