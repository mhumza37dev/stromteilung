import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide safety net.
 *
 * Without this, an exception thrown during render unmounts the entire React
 * tree and leaves the user staring at a blank page (we hit this with Chrome's
 * auto-translate corrupting the DOM mid-navigation). The boundary catches the
 * throw, logs it, and renders a recoverable fallback.
 *
 * Intentionally bilingual-agnostic: the i18n context may itself be the thing
 * that crashed, so we render in plain English/German without going through
 * `useLang`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to devtools — a real deployment would forward to Sentry/etc.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4 font-sans">
        <div className="max-w-[420px] w-full bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="text-lg font-bold text-gray-900 mb-1">
            Something went wrong
          </div>
          <div className="text-sm text-gray-500 mb-4">
            Etwas ist schiefgelaufen. Bitte laden Sie die Seite neu.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium px-4 py-2 rounded-lg border-none cursor-pointer"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="flex-1 bg-transparent text-gray-600 border-[1.5px] border-gray-200 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer"
            >
              Try again
            </button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-4 text-[11px] text-red-600 whitespace-pre-wrap break-words bg-red-50 border border-red-100 rounded p-2 max-h-[160px] overflow-auto">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
