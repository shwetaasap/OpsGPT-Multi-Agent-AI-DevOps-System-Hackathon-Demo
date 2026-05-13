import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Settings, Zap, Server, Trash2, Key, Check, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAnalysisStore } from '../store/AnalysisStore';
import { apiService } from '../services/apiService';
import { clearApiKey, getApiKey, maskApiKey, setApiKey } from '../utils/apiKey';

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

export function SettingsView() {
  const { runs, clearRuns } = useAnalysisStore();
  const [storedKey, setStoredKey] = useState<string | null>(() => getApiKey());
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const [serverKeyConfigured, setServerKeyConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    apiService.health()
      .then(h => setServerKeyConfigured(h.server_key_configured))
      .catch(() => setServerKeyConfigured(null));
  }, []);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setStoredKey(trimmed);
    setDraft('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const handleClear = () => {
    clearApiKey();
    setStoredKey(null);
    setDraft('');
  };

  const usingPersonal = !!storedKey;
  const usingServerFallback = !storedKey && serverKeyConfigured === true;
  const noKeyAvailable = !storedKey && serverKeyConfigured === false;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} className="w-full space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Configuration</h1>
        <p className="text-muted-foreground mt-1">Backend wiring, model defaults, and your personal API key.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="space-y-1">
          <button className="w-full text-left px-4 py-2 rounded-md bg-primary/10 text-primary border border-primary/20 font-bold text-sm flex items-center gap-3">
            <Settings className="w-4 h-4" /> General
          </button>
        </aside>

        <div className="md:col-span-3 space-y-8">
          <Card title="OpenRouter API Key" icon={<Key className="w-4 h-4 text-primary" />}>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Paste your own OpenRouter key — it stays in this browser only and is sent
              with each <code className="text-foreground font-mono">/api/analyze</code> request via the
              <code className="text-foreground font-mono"> X-OpenRouter-API-Key</code> header. Get one at{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                openrouter.ai/keys
              </a>.
            </p>

            <div className="mt-4 space-y-3">
              <div className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${
                usingPersonal ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                usingServerFallback ? 'bg-primary/10 border-primary/30 text-primary' :
                noKeyAvailable ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                'bg-muted/40 border-muted text-muted-foreground'
              }`}>
                {usingPersonal ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>
                  {usingPersonal && <>Using personal key <span className="font-mono ml-1">{maskApiKey(storedKey!)}</span></>}
                  {usingServerFallback && <>Using server-side default (Vault). Override below to use your own.</>}
                  {noKeyAvailable && <>No key configured — analysis will fail until one is set.</>}
                  {serverKeyConfigured === null && !storedKey && 'Checking server key status…'}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Paste your OpenRouter API key"
                  className="flex-1 bg-card border border-border px-3 py-2 text-xs text-foreground rounded font-mono outline-none focus:border-primary"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button onClick={handleSave} disabled={!draft.trim()}>
                  {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save'}
                </Button>
                {storedKey && (
                  <Button variant="outline" onClick={handleClear}>
                    Clear
                  </Button>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground">
                Stored as <code className="font-mono">opsgpt:openrouter_api_key</code> in localStorage. Never sent to GitHub or the server's persistent state.
              </p>
            </div>
          </Card>

          <Card title="Backend" icon={<Server className="w-4 h-4 text-primary" />}>
            <div className="space-y-4 mt-4">
              <Field label="API URL" value={API_URL} hint="Set VITE_API_URL in web/.env" />
              <Field label="Endpoint" value="POST /api/analyze" />
              <Field label="Provider" value="OpenRouter" hint="Configured in agents/config.py" />
            </div>
          </Card>

          <Card title="Model" icon={<Zap className="w-4 h-4 text-primary" />}>
            <div className="space-y-4 mt-4">
              <Field label="Default" value="anthropic/claude-sonnet-4.5" hint="Override via OPENROUTER_MODEL env var" />
              <Field label="Structured output" value="Pydantic v2 schemas" />
            </div>
          </Card>

          <Card title="Local Run History" icon={<Trash2 className="w-4 h-4 text-primary" />}>
            <div className="mt-4 space-y-4">
              <Field label="Stored runs" value={`${runs.length} (max 25)`} hint="Persisted to localStorage as opsgpt:runs" />
              <div className="flex justify-end">
                <Button variant="outline" onClick={clearRuns} disabled={runs.length === 0}>
                  Clear all runs
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-2">{label}</label>
      <div className="bg-card border border-border px-3 py-2 text-xs text-foreground rounded font-mono break-all">{value}</div>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
