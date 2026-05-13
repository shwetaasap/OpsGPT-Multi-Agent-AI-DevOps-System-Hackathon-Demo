import { useState } from 'react';
import { toast } from 'sonner';
import { apiService } from '../services/apiService';
import { useAnalysisStore } from '../store/AnalysisStore';
import { AnalysisReport, AnalysisResult } from '../types';
import { toAnalysisResult } from '../utils/adapt';

interface UseAnalysisOptions {
  /** Map the multi-incident report into a single AnalysisResult for legacy panels. */
  asAnalysisResult?: boolean;
  /** Pick a specific incident from the report to convert. */
  incidentId?: string;
}

export function useAnalysis(opts: UseAnalysisOptions = {}) {
  const { recordRun, current } = useAnalysisStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (logs: string, fileName?: string): Promise<AnalysisReport | undefined> => {
    if (!logs) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const report = await apiService.analyze(logs);
      recordRun(report, fileName);
      const incidentCount = report.incidents.length;
      const cost = report.usage?.total_cost_usd ?? 0;
      toast.success(
        `Analysis complete · ${incidentCount} incident${incidentCount === 1 ? '' : 's'}`,
        { description: cost > 0 ? `$${cost.toFixed(4)} · ${report.usage?.total_tokens.toLocaleString() ?? 0} tokens` : undefined }
      );
      // Auto-flag P0 detections.
      const p0 = report.incidents.find((i) => i.severity === 'critical');
      if (p0) {
        toast.warning(`P0 incident detected: ${p0.error_type}`, { description: p0.summary });
      }
      return report;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed.';
      setError(msg);
      toast.error('Analysis failed', { description: msg });
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  let analysisResult: AnalysisResult | null = null;
  if (opts.asAnalysisResult && current) {
    const inc = opts.incidentId
      ? current.report.incidents.find(i => i.id === opts.incidentId)
      : current.report.incidents[0];
    if (inc) {
      analysisResult = toAnalysisResult(inc, current.report.remediations[inc.id], current.report);
    }
  }

  return {
    analyze,
    isAnalyzing,
    error,
    report: current?.report ?? null,
    analysis: analysisResult,
  };
}
