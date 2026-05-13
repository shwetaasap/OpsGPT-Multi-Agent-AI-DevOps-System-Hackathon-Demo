import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches React render errors anywhere below it and shows a visible error
 * panel instead of crashing into a blank screen. Mounted around <Outlet />
 * in DashboardLayout so route-level errors are surfaced.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error caught by ErrorBoundary:', error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="max-w-2xl mx-auto py-12">
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /> Something broke while rendering this page
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="p-3 bg-muted/40 border border-border rounded-md text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-64 overflow-auto">
                {this.state.error.name}: {this.state.error.message}
                {this.state.error.stack && `\n\n${this.state.error.stack}`}
              </pre>
              <div className="flex gap-2">
                <Button onClick={this.reset}>Try again</Button>
                <Button variant="outline" onClick={() => (window.location.href = '/')}>
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
