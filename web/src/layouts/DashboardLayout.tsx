import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  History,
  LayoutDashboard,
  Laptop,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldAlert,
  Signal,
  Sparkles,
  Sun,
  Terminal,
  User,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../utils/cn';
import { useIncidents } from '../hooks/useIncidents';
import { useAnalysisStore } from '../store/AnalysisStore';
import { useTheme } from '../store/ThemeContext';
import { Button } from '../components/ui/Button';
import { Kbd } from '../components/ui/Kbd';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/Popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/DropdownMenu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/Sheet';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/Tooltip';
import { Sparkline } from '../components/ui/Sparkline';
import { ErrorBoundary } from '../components/ErrorBoundary';

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: AlertTriangle, label: 'Incidents', path: '/incidents' },
  { icon: Zap, label: 'Agent Workflow', path: '/workflow' },
  { icon: Signal, label: 'Integrations', path: '/integrations' },
  { icon: History, label: 'History', path: '/history' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const MOBILE_NAV_ITEMS = NAV_ITEMS.slice(0, 4);

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
        <Sidebar className="hidden md:flex" />
        <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

        <div className="flex-1 flex flex-col min-w-0">
          <Header onMobileMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-20 md:pb-8">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </TooltipProvider>
  );
}

// ---------- Sidebar (desktop) ------------------------------------------------

function Sidebar({ className }: { className?: string }) {
  const { incidents } = useIncidents();
  const { runs } = useAnalysisStore();
  const sparkData = useRunsPerHour(runs);

  return (
    <aside className={cn('w-60 border-r border-border bg-card/40 backdrop-blur flex-col h-screen sticky top-0 shrink-0', className)}>
      <Link to="/" className="px-5 pt-5 pb-4 flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow-sm shadow-primary/30">
          <Terminal className="h-4 w-4" />
        </div>
        <span className="font-semibold text-base tracking-tight text-foreground">OpsGPT</span>
      </Link>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="active-rail"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary"
                  />
                )}
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                'h-1.5 w-1.5 rounded-full',
                runs.length > 0 ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'
              )} />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Pipeline</span>
            </div>
            <span className="text-xs tabular-nums text-foreground">{runs.length}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mb-1.5">
            {incidents.length} incident{incidents.length === 1 ? '' : 's'} tracked
          </div>
          {sparkData.length > 1 && <Sparkline data={sparkData} height={28} />}
        </div>
      </div>
    </aside>
  );
}

function MobileSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Terminal className="h-4 w-4" />
            </div>
            OpsGPT
          </SheetTitle>
        </SheetHeader>
        <nav className="px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => onOpenChange(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

// ---------- Header -----------------------------------------------------------

function Header({ onMobileMenuClick }: { onMobileMenuClick: () => void }) {
  const { incidents } = useIncidents();
  const p0Count = incidents.filter((i) => i.severity === 'P0' && i.status !== 'resolved').length;

  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between gap-3 px-4 md:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
          onClick={onMobileMenuClick}
        >
          <Menu />
        </Button>
        <CommandTrigger />
      </div>

      <div className="flex items-center gap-2">
        {p0Count > 0 && <P0Pill count={p0Count} />}
        <RunCountPill />
        <ThemeToggle />
        <NotificationsButton />
        <UserMenu />
      </div>
    </header>
  );
}

function CommandTrigger() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 text-muted-foreground hover:text-foreground w-44 md:w-72 justify-between font-normal"
      onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
    >
      <span className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5" />
        Search…
      </span>
      <Kbd>⌘K</Kbd>
    </Button>
  );
}

function P0Pill({ count }: { count: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/incidents"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--sev-p0)/0.3)] bg-[hsl(var(--sev-p0)/0.1)] px-2.5 py-1 text-xs font-medium text-[hsl(var(--sev-p0))]"
        >
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--sev-p0))]"
          />
          <ShieldAlert className="h-3 w-3" />
          {count} active P0
        </Link>
      </TooltipTrigger>
      <TooltipContent>Critical incidents needing review</TooltipContent>
    </Tooltip>
  );
}

function RunCountPill() {
  const { runs } = useAnalysisStore();
  if (runs.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-muted-foreground hover:text-foreground hidden sm:inline-flex">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="tabular-nums">{runs.length}</span>
          <span className="hidden md:inline">runs</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Recent runs</div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {runs.slice(0, 6).map((run) => (
            <Link
              key={run.runId}
              to={run.report.incidents.length > 0 ? `/incidents/${run.report.incidents[0].id}` : '/workflow'}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <span className="truncate text-foreground">{run.fileName ?? 'Pasted logs'}</span>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
              </span>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Laptop;
  const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Switch to ${next} theme`} onClick={toggleTheme}>
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Theme: {theme}. Click to cycle.</TooltipContent>
    </Tooltip>
  );
}

function NotificationsButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>No notifications yet.</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="User menu"
          className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <User className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings className="h-4 w-4" /> Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- Mobile bottom nav ------------------------------------------------

function MobileBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur grid grid-cols-4">
      {MOBILE_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-foreground' : 'text-muted-foreground'
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label.replace('Agent ', '')}
        </NavLink>
      ))}
    </nav>
  );
}

// ---------- Sparkline data helper -------------------------------------------

function useRunsPerHour(runs: ReturnType<typeof useAnalysisStore>['runs']): number[] {
  return useMemo(() => {
    if (runs.length === 0) return [];
    const buckets: number[] = new Array(12).fill(0);
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    for (const r of runs) {
      const ago = (now - new Date(r.startedAt).getTime()) / hour;
      const idx = Math.min(11, Math.max(0, 11 - Math.floor(ago)));
      buckets[idx] += 1;
    }
    return buckets;
  }, [runs]);
}
