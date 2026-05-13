import { useMemo } from 'react';
import { useAnalysisStore } from '../store/AnalysisStore';
import { Incident, IntegrationStatus, WorkflowExecution } from '../types';
import { toIncident, toIntegrations, toWorkflowExecution } from '../utils/adapt';

export function useIncidents() {
  const { runs } = useAnalysisStore();
  const incidents = useMemo<Incident[]>(() => {
    return runs.flatMap(run =>
      run.report.incidents.map(inc =>
        toIncident(inc, run.report.remediations[inc.id], run)
      )
    );
  }, [runs]);

  return { incidents, loading: false, error: null };
}

export function useIncident(id: string) {
  const { runs } = useAnalysisStore();
  const incident = useMemo<Incident | null>(() => {
    for (const run of runs) {
      const inc = run.report.incidents.find(i => i.id === id);
      if (inc) return toIncident(inc, run.report.remediations[inc.id], run);
    }
    return null;
  }, [runs, id]);

  return { incident, loading: false, error: incident ? null : 'NOT_FOUND' };
}

function findRunForIncident(runs: ReturnType<typeof useAnalysisStore>['runs'], id: string) {
  return runs.find(r => r.report.incidents.some(i => i.id === id));
}

export function useWorkflow(incidentId: string) {
  const { runs } = useAnalysisStore();
  const workflow = useMemo<WorkflowExecution | null>(() => {
    const run = findRunForIncident(runs, incidentId);
    return run ? toWorkflowExecution(run, incidentId) : null;
  }, [runs, incidentId]);

  return { workflow, loading: false };
}

export const useLiveWorkflow = useWorkflow;

export function useIntegrations() {
  const { current } = useAnalysisStore();
  const integrations = useMemo<IntegrationStatus[]>(
    () => toIntegrations(current),
    [current]
  );
  return { integrations, loading: false };
}
