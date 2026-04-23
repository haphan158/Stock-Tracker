'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: '#f9fafb',
          color: '#111827',
          padding: '1rem',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Application error
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1rem' }}>
            A critical error occurred. Please reload the page.
          </p>
          {process.env.NODE_ENV !== 'production' && error?.message ? (
            <pre
              style={{
                textAlign: 'left',
                fontSize: '0.75rem',
                color: '#b91c1c',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 4,
                padding: '0.75rem',
                marginBottom: '1rem',
                overflow: 'auto',
              }}
            >
              {error.message}
            </pre>
          ) : null}
          <button
            onClick={() => reset()}
            style={{
              background: '#2563eb',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
