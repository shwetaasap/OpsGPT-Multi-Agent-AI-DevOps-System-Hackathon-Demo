import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ExternalLink,
  History,
  LayoutDashboard,
  Settings,
  Signal,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './ui/Command';
import { useAnalysisStore } from '../store/AnalysisStore';
import { useTheme } from '../store/ThemeContext';
import { useIncidents } from '../hooks/useIncidents';

const LANGSMITH_PROJECT_URL = 'https://smith.langchain.com/projects';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { runs, clearRuns } = useAnalysisStore();
  const { incidents } = useIncidents();
  const { theme, toggleTheme } = useTheme();

  // Global ⌘K / Ctrl+K hotkey
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const runWithToast = (fn: () => void, message: string) => {
    setOpen(false);
    fn();
    toast.success(message);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search incidents, runs, or jump to a page…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        {incidents.length > 0 && (
          <CommandGroup heading="Incidents">
            {incidents.slice(0, 8).map((inc) => (
              <CommandItem
                key={inc.id}
                value={`${inc.id} ${inc.title} ${inc.serviceName} ${inc.severity}`}
                onSelect={() => go(`/incidents/${inc.id}`)}
              >
                <AlertTriangle className="text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">{inc.id}</span>
                <span className="truncate">{inc.title}</span>
                <CommandShortcut>{inc.severity}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {runs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Runs">
              {runs.slice(0, 5).map((run) => (
                <CommandItem
                  key={run.runId}
                  value={`run ${run.runId} ${run.fileName ?? ''}`}
                  onSelect={() => {
                    if (run.report.incidents.length > 0) {
                      go(`/incidents/${run.report.incidents[0].id}`);
                    } else {
                      go('/workflow');
                    }
                  }}
                >
                  <Sparkles className="text-muted-foreground" />
                  <span className="truncate">{run.fileName ?? 'Pasted logs'}</span>
                  <CommandShortcut>{new Date(run.startedAt).toLocaleTimeString()}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go('/')}>
            <LayoutDashboard /> Dashboard
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go('/incidents')}>
            <AlertTriangle /> Incidents
            <CommandShortcut>G I</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go('/workflow')}>
            <Zap /> Agent Workflow
            <CommandShortcut>G W</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go('/integrations')}>
            <Signal /> Integrations
          </CommandItem>
          <CommandItem onSelect={() => go('/history')}>
            <History /> History
            <CommandShortcut>G H</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go('/settings')}>
            <Settings /> Settings
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => runWithToast(toggleTheme, `Theme set to ${theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'}`)}
          >
            <Settings /> Toggle theme (current: {theme})
          </CommandItem>
          <CommandItem
            onSelect={() => {
              if (runs.length === 0) {
                setOpen(false);
                toast.info('No runs to clear.');
                return;
              }
              runWithToast(clearRuns, `Cleared ${runs.length} run${runs.length === 1 ? '' : 's'}`);
            }}
          >
            <Trash2 className="text-destructive" /> Clear local run history
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              window.open(LANGSMITH_PROJECT_URL, '_blank', 'noopener');
            }}
          >
            <ExternalLink /> Open LangSmith dashboard
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
