import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary so the app never renders a blank/black screen.
 * Catches any error thrown during render or in lifecycle methods of children.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[RootErrorBoundary] Yakalanan hata:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message ?? 'Bilinmeyen bir hata oluştu.';
      return (
        <div
          data-testid="root-error-boundary"
          style={{
            minHeight: '100vh',
            background: '#0b0f17',
            color: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
          }}
        >
          <div style={{ maxWidth: 640, width: '100%' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              !
            </div>
            <h1 style={{ fontSize: 20, marginBottom: 8 }}>
              Uygulama başlatılamadı
            </h1>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
              Sayfanın yüklenmesi sırasında beklenmedik bir hata oluştu.
              Aşağıdaki hata mesajı sorunu tespit etmenize yardımcı olabilir.
            </p>
            <pre
              style={{
                fontSize: 12,
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: 8,
                padding: 12,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#fca5a5',
              }}
            >
              {message}
            </pre>
            <button
              data-testid="root-error-reload-btn"
              type="button"
              onClick={this.handleReload}
              style={{
                marginTop: 16,
                padding: '8px 14px',
                borderRadius: 6,
                background: '#2563eb',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Sayfayı yeniden yükle
            </button>
            <p
              style={{
                marginTop: 12,
                fontSize: 11,
                color: '#6b7280',
              }}
            >
              İpucu: Eğer hata Supabase yapılandırmasıyla ilgiliyse, proje kökünde
              <code style={{ margin: '0 4px' }}>.env</code> dosyasının var olduğundan
              ve <code>VITE_SUPABASE_URL</code> ile{' '}
              <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> değerlerinin tanımlı
              olduğundan emin olun.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RootErrorBoundary;
