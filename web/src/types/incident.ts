export type Severity = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'active' | 'analyzing' | 'remediating' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: Severity;
  timestamp: string;
  source: string;
  serviceName: string;
  incidentType: string;
  assignedWorkflow: string;
  shortDescription: string;
  assignedTeam: string;
  slackChannel?: string;
  jiraTicket?: string;
  githubIssue?: string;
}

export interface AgentStep {
  id: string;
  agentName: string;
  action: string;
  timestamp: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
}

export interface IntegrationStatus {
  id: string;
  name: string;
  type: 'notification' | 'ticketing' | 'webhook' | 'monitoring';
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  latency: string;
  uptime: string;
  lastExecution: {
    timestamp: string;
    status: 'success' | 'failure';
    retryCount: number;
    payload?: string;
    response?: string;
  };
}

export interface AnalysisResult {
  severity: Severity;
  summary: string;
  rootCause: string;
  remediationSteps: string[];
  confidence?: number;
  reasoning?: string;
  operationalImpact?: string;
  serviceAffected?: string;
  recommendedEscalation?: string;
  validationSteps?: string[];
  rollbackPlan?: string[];
  estimatedTime?: string;
}

// --- Backend (Python LangGraph) shapes ---

export type BackendSeverity = 'info' | 'warn' | 'high' | 'critical';
export type RagConfidence = 'high' | 'medium' | 'low' | 'none';
export type RunSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type ValidatorStatus = 'approved' | 'needs_revision' | 'escalate';
export type HumanApprovalStatus = 'required' | 'approved' | 'skipped';

export interface BackendIncident {
  id: string;
  service: string;
  error_type: string;
  severity: BackendSeverity;
  summary: string;
  evidence: string;
  first_seen?: string | null;
}

export interface BackendFix {
  incident_id: string;
  rationale: string;
  steps: string[];
  risk: 'low' | 'medium' | 'high';
  runbook_ref?: string | null;
}

export interface BackendChecklist {
  title: string;
  items: string[];
}

export interface RagComplianceEntry {
  incident_id: string;
  severity: BackendSeverity;
  requirement: string;
  status: 'ok' | 'warn' | 'fail';
  reason: string;
  rag_confidence: RagConfidence;
  runbook_ref?: string | null;
}

export interface RouterFlags {
  requires_deep_analysis: boolean;
  requires_rag: boolean;
  requires_human_approval: boolean;
  requires_ticket: boolean;
  requires_notification: boolean;
}

export interface AnalysisReport {
  incidents: BackendIncident[];
  remediations: Record<string, BackendFix>;
  cookbook: BackendChecklist | null;
  report_md: string;

  rag_sources: string[];
  rag_confidence: RagConfidence;
  rag_compliance: RagComplianceEntry[];
  rag_snippet_count: number;

  severity: RunSeverity | null;
  incident_type: string | null;
  routing_path: string | null;
  routing_reason: string | null;
  flags: RouterFlags;

  validator_status: ValidatorStatus | null;
  quality_score: number | null;
  issues_found: string[];
  revision_instruction: string;
  escalation_required: boolean;
  validation_reason: string | null;
  retry_count: number;

  human_approval_status: HumanApprovalStatus | null;
  execution_path: string[];

  slack_status?: 'sent_mock' | 'prepared_mock' | 'skipped' | string;
  slack_channel?: string | null;
  slack_message_id?: string | null;
  slack_thread_ts: string | null;
  slack_message_preview?: string;
  jira_status?: 'created_mock' | 'skipped' | string;
  jira_keys: string[];
  jira_priority?: string | null;
  jira_summary?: string;
  jira_description_preview?: string;

  usage?: UsageSummary;
}

export interface UsageSummary {
  llm_calls: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_tokens: number;
  total_cost_usd: number;
  models_used: string[];
  unpriced_calls: number;
}

export interface AnalysisRun {
  runId: string;
  startedAt: string;
  fileName?: string;
  report: AnalysisReport;
}
