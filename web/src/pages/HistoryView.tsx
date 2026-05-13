import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Zap,
  CheckCircle2,
  BellOff,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIncidents } from '../hooks/useIncidents';
import { useAnalysisStore } from '../store/AnalysisStore';
import { Card } from '../components/ui/Card';
import { SeverityBadge } from '../components/ui/Badge';
import { cn } from '../utils/cn';
import { format } from 'date-fns';

export function HistoryView() {
  const { incidents, loading } = useIncidents();
  const { clearRuns, runs } = useAnalysisStore();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const itemsPerPage = 8;

  const handleClearHistory = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      // Auto-cancel the confirm prompt after 4 seconds.
      setTimeout(() => setConfirmingClear(false), 4000);
      return;
    }
    clearRuns();
    setExpandedRows({});
    setSearchQuery('');
    setSeverityFilter('All');
    setStatusFilter('All');
    setCurrentPage(1);
    setConfirmingClear(false);
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredIncidents = incidents.filter(i => {
    const matchesSearch = 
      i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.incidentType.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeverity = severityFilter === 'All' || i.severity === severityFilter;
    const matchesStatus = statusFilter === 'All' || i.status === statusFilter.toLowerCase();

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage);
  const paginatedIncidents = filteredIncidents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-muted-foreground font-mono text-sm tracking-widest uppercase">Syncing_Incident_Repository...</span>
    </div>
  );

  // Summary Metrics
  const criticalCount = incidents.filter(i => i.severity === 'P0').length;
  const activeWorkflows = incidents.filter(i => i.status === 'active' || i.status === 'analyzing' || i.status === 'remediating').length;
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="w-1.5 h-10 bg-primary rounded-full" />
           <div>
             <h1 className="text-3xl font-bold text-foreground tracking-tight">Incident Command</h1>
             <div className="flex items-center gap-2 text-muted-foreground mt-1">
               <span className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                 <span className="text-[10px] font-mono tracking-widest uppercase">Live System Feed</span>
               </span>
               <span className="text-muted-foreground/50 mx-2">|</span>
               <p className="text-sm">Real-time observability and automated recovery audit.</p>
             </div>
           </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-card hover:bg-muted border border-border rounded-md text-xs font-bold text-foreground/90 flex items-center gap-2 transition-colors group">
            <Download className="w-4 h-4 group-hover:text-primary transition-colors" /> Export Operations Audit
          </button>
          <button
            onClick={handleClearHistory}
            disabled={runs.length === 0}
            className={cn(
              'px-4 py-2 border rounded-md text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed',
              confirmingClear
                ? 'bg-red-600 hover:bg-red-500 border-red-500 text-foreground shadow-lg shadow-red-500/20'
                : 'bg-card hover:bg-red-900/20 border-border hover:border-red-500/50 text-foreground/90 hover:text-red-300'
            )}
          >
            <Trash2 className="w-4 h-4" />
            {confirmingClear
              ? `Click again to clear ${runs.length} run${runs.length === 1 ? '' : 's'}`
              : `Clear history${runs.length ? ` (${runs.length})` : ''}`}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          label="P0 Incidents" 
          value={criticalCount} 
          icon={AlertCircle} 
          color="text-red-500" 
          badge="Action Required"
        />
        <SummaryCard 
          label="Workflows In Flight" 
          value={activeWorkflows} 
          icon={Zap} 
          color="text-primary" 
          badge="Live Agents"
        />
        <SummaryCard 
          label="Failed Alerts" 
          value="0" 
          icon={BellOff} 
          color="text-yellow-500" 
          badge="Channel Normal"
        />
        <SummaryCard 
          label="Resolved Today" 
          value={resolvedCount} 
          icon={CheckCircle2} 
          color="text-green-500" 
          badge="Auto-Remediated"
        />
      </div>

      {/* Main Incident Section */}
      <Card className="p-0 border-border/60 shadow-2xl relative overflow-visible">
        {/* Table Filters */}
        <div className="p-5 border-b border-border flex flex-wrap gap-4 items-center bg-muted/20 backdrop-blur-sm sticky top-[64px] z-30 rounded-t-xl">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by ID, Service, or Incident Type..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-background/80 border border-border focus:border-primary focus:ring-1 focus:ring-blue-500/20 rounded-lg py-2 pl-10 pr-4 text-sm text-foreground/90 outline-none transition-all placeholder:text-muted-foreground/70"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex items-center bg-background border border-border rounded-lg px-3 gap-2">
               <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest whitespace-nowrap">Severity</span>
               <select 
                 value={severityFilter}
                 onChange={(e) => {
                   setSeverityFilter(e.target.value);
                   setCurrentPage(1);
                 }}
                 className="bg-transparent border-none text-xs font-bold py-2 text-foreground/90 focus:outline-none cursor-pointer"
               >
                 <option value="All">All</option>
                 <option value="P0">P0</option>
                 <option value="P1">P1</option>
                 <option value="P2">P2</option>
                 <option value="P3">P3</option>
               </select>
            </div>
            
            <div className="flex items-center bg-background border border-border rounded-lg px-3 gap-2">
               <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest whitespace-nowrap">Status</span>
               <select 
                 value={statusFilter}
                 onChange={(e) => {
                   setStatusFilter(e.target.value);
                   setCurrentPage(1);
                 }}
                 className="bg-transparent border-none text-xs font-bold py-2 text-foreground/90 focus:outline-none cursor-pointer"
               >
                 <option value="All">All</option>
                 <option value="Active">Active</option>
                 <option value="Analyzing">Analyzing</option>
                 <option value="Remediating">Remediating</option>
                 <option value="Resolved">Resolved</option>
               </select>
            </div>
          </div>
        </div>


        {/* Desktop Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-card/40 text-muted-foreground text-[10px] uppercase font-mono tracking-[0.15em] border-b border-border">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4 font-bold">Timestamp</th>
                <th className="px-6 py-4 font-bold">Service / Component</th>
                <th className="px-6 py-4 font-bold">Severity</th>
                <th className="px-6 py-4 font-bold">Incident Type</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Workflow</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {paginatedIncidents.map((incident) => (
                <React.Fragment key={incident.id}>
                  <tr 
                    className={cn(
                      "group hover:bg-muted/20 transition-colors cursor-pointer",
                      expandedRows[incident.id] ? "bg-blue-900/5" : ""
                    )}
                    onClick={() => toggleRow(incident.id)}
                  >
                    <td className="px-6 py-4">
                      {expandedRows[incident.id] ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground/70 group-hover:text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-mono text-muted-foreground">
                        {format(new Date(incident.timestamp), 'HH:mm:ss')}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70 font-mono uppercase mt-0.5">
                        {format(new Date(incident.timestamp), 'MMM dd')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{incident.serviceName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{incident.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <SeverityBadge severity={incident.severity} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-foreground/90">{incident.incidentType}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          incident.status === 'active' ? "bg-red-500 animate-pulse" :
                          incident.status === 'analyzing' ? "bg-blue-500" :
                          incident.status === 'resolved' ? "bg-green-500" : "bg-slate-500"
                        )} />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                          {incident.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2 text-xs font-mono text-primary/80">
                         <Zap className="w-3 h-3" />
                         {incident.assignedWorkflow}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <Link 
                        to={`/incidents/${incident.id}`} 
                        className="p-1 px-3 bg-card border border-border rounded group-hover:border-muted text-xs font-bold text-muted-foreground hover:text-foreground transition-all inline-flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                       >
                         Manage <ExternalLink className="w-3 h-3" />
                       </Link>
                    </td>
                  </tr>

                  {/* Expandable Content */}
                  <AnimatePresence>
                    {expandedRows[incident.id] && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-muted/30 overflow-hidden"
                      >
                        <td colSpan={8} className="p-0 overflow-hidden">
                          <div className="p-8 border-l-2 border-primary/50 m-4 ml-14 bg-card/50 rounded-r-xl border border-border shadow-inner">
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                <div className="space-y-4">
                                   <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">Issue Description</div>
                                   <p className="text-sm text-foreground/90 leading-relaxed font-sans italic border-l-2 border-border pl-4 py-1">
                                     "{incident.shortDescription}"
                                   </p>
                                </div>
                                <div className="space-y-4 text-xs">
                                   <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">Impacted Infrastructure</div>
                                   <div className="flex flex-wrap gap-2">
                                      {['US-East-1', 'VPC-Peering', 'K8s-Prod-01'].map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-muted border border-muted rounded text-foreground/90 font-mono uppercase tracking-tighter">
                                          {tag}
                                        </span>
                                      ))}
                                   </div>
                                </div>
                                <div className="space-y-4">
                                   <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">Operational State</div>
                                   <div className="space-y-2">
                                      <div className="flex justify-between items-center text-xs">
                                         <span className="text-muted-foreground">Log Ingestion</span>
                                         <span className="text-green-500 uppercase font-bold">Operational</span>
                                      </div>
                                      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                         <div className="w-full h-full bg-green-500/50" />
                                      </div>
                                      <Link to={`/incidents/${incident.id}`} className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-primary hover:text-primary group/link">
                                        Open Detailed Analysis View
                                        <ArrowRight className="w-3 h-3 transition-transform group-hover/link:translate-x-1" />
                                      </Link>
                                   </div>
                                </div>
                             </div>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border bg-card/40 flex items-center justify-between">
           <div className="text-[10px] text-muted-foreground font-mono uppercase">
              Page {currentPage} of {Math.max(1, totalPages)} | Showing {paginatedIncidents.length} of {filteredIncidents.length} Records
           </div>
           <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded border border-border bg-card flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              >
                 <ChevronDown className="w-4 h-4 text-muted-foreground rotate-90" />
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="w-8 h-8 rounded border border-border bg-card flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              >
                 <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
              </button>
           </div>
        </div>
      </Card>
    </motion.div>
  );
}

function SummaryCard({ label, value, icon: Icon, color, badge }: any) {
  return (
    <div className="bg-card border border-border p-6 rounded-xl relative overflow-hidden group hover:border-muted transition-all shadow-lg hover:shadow-blue-500/5">
      <div className="absolute top-0 right-0 p-3">
        <Icon className={cn("w-12 h-12 opacity-[0.03] group-hover:opacity-10 transition-opacity", color)} />
      </div>
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-3">
           <div className={cn("p-2 rounded-lg bg-background border border-border", color)}>
             <Icon className="w-4 h-4" />
           </div>
           <span className={cn("text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-border/50 bg-background", color)}>
             {badge}
           </span>
        </div>
        <h3 className="text-2xl font-black text-foreground tracking-tighter">{value}</h3>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
      </div>
    </div>
  );
}
