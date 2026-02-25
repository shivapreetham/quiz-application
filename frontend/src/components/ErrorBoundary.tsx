import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-background via-secondary/20 to-background">
          <Card className="max-w-md w-full shadow-2xl border-destructive/20">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 text-6xl">⚠️</div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
              <CardDescription>
                The application encountered an unexpected error
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm font-mono text-destructive break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              <Button onClick={this.handleReset} className="w-full" size="lg">
                Return to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
