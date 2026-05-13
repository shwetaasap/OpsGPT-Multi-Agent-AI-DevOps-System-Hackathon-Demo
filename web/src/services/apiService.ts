import { AnalysisReport } from '../types';
import { getApiKey } from '../utils/apiKey';

// In production, the FastAPI server serves the React bundle from the same
// origin — so a relative URL just works. Local dev sets VITE_API_URL to
// http://localhost:8000 explicitly via web/.env.
const API_URL = import.meta.env.VITE_API_URL ?? '';

export interface HealthResponse {
  status: boolean;
  server_key_configured: boolean;
}

export const apiService = {
  async analyze(logs: string): Promise<AnalysisReport> {
    if (!logs) throw new Error('LOG_CONTENT_EMPTY');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = getApiKey();
    if (apiKey) {
      headers['X-OpenRouter-API-Key'] = apiKey;
    }

    const res = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ logs }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`ANALYZE_FAILED: ${detail}`);
    }

    return (await res.json()) as AnalysisReport;
  },

  async health(): Promise<HealthResponse> {
    const res = await fetch(`${API_URL}/api/health`);
    if (!res.ok) throw new Error(`HEALTH_FAILED: ${res.status}`);
    return (await res.json()) as HealthResponse;
  },
};
