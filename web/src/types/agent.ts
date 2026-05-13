export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentNode {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  duration?: string;
  tokens?: number;
  startTime?: string;
  endTime?: string;
  output?: string;
  error?: string;
}

export interface WorkflowExecution {
  id: string;
  incidentId: string;
  startedAt: string;
  nodes: AgentNode[];
}
