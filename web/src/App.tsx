import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { IncidentDetails } from './pages/IncidentDetails';
import { WorkflowView } from './pages/WorkflowView';
import { IntegrationsView } from './pages/IntegrationsView';
import { HistoryView } from './pages/HistoryView';
import { SettingsView } from './pages/SettingsView';
import { CommandPalette } from './components/CommandPalette';
import { Toaster } from './components/ui/Toaster';

export default function App() {
  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/incidents" element={<HistoryView />} />
            <Route path="/incidents/:id" element={<IncidentDetails />} />
            <Route path="/workflow" element={<WorkflowView />} />
            <Route path="/integrations" element={<IntegrationsView />} />
            <Route path="/history" element={<HistoryView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Route>
        </Routes>
      </AnimatePresence>
      <CommandPalette />
      <Toaster />
    </Router>
  );
}
