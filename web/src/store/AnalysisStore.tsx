import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnalysisReport, AnalysisRun } from '../types';

const STORAGE_KEY = 'opsgpt:runs';
const MAX_RUNS = 25;

interface StoreState {
  runs: AnalysisRun[];
  current: AnalysisRun | null;
  recordRun: (report: AnalysisReport, fileName?: string) => AnalysisRun;
  clearRuns: () => void;
}

const AnalysisStoreContext = createContext<StoreState | null>(null);

function loadRuns(): AnalysisRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AnalysisRun[];
  } catch {
    return [];
  }
}

function saveRuns(runs: AnalysisRun[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {
    /* storage full or disabled */
  }
}

export function AnalysisStoreProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<AnalysisRun[]>(() => loadRuns());

  useEffect(() => {
    saveRuns(runs);
  }, [runs]);

  const recordRun = useCallback((report: AnalysisReport, fileName?: string): AnalysisRun => {
    const run: AnalysisRun = {
      runId: `RUN-${Date.now()}`,
      startedAt: new Date().toISOString(),
      fileName,
      report,
    };
    setRuns(prev => [run, ...prev].slice(0, MAX_RUNS));
    return run;
  }, []);

  const clearRuns = useCallback(() => setRuns([]), []);

  const value = useMemo<StoreState>(() => ({
    runs,
    current: runs[0] ?? null,
    recordRun,
    clearRuns,
  }), [runs, recordRun, clearRuns]);

  return (
    <AnalysisStoreContext.Provider value={value}>
      {children}
    </AnalysisStoreContext.Provider>
  );
}

export function useAnalysisStore(): StoreState {
  const ctx = useContext(AnalysisStoreContext);
  if (!ctx) throw new Error('useAnalysisStore must be used within AnalysisStoreProvider');
  return ctx;
}
