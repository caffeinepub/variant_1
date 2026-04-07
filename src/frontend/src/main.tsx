import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { InternetIdentityProvider } from "./hooks/useInternetIdentity";
import "./index.css";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// ── Global error handler to prevent silent white screens ──
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Variant] Unhandled promise rejection:", event.reason);
});

// ── Error Boundary ──
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<Record<string, unknown>>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<Record<string, unknown>>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Variant] React error boundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#0a0a0f",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            padding: "24px",
            fontFamily: "sans-serif",
          }}
        >
          <p
            style={{
              color: "#20E6E6",
              fontSize: "16px",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            Something went wrong loading the app.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 28px",
              borderRadius: "50px",
              background: "#20E6E6",
              color: "#0a0a0f",
              border: "none",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {this.state.error && (
            <p
              style={{
                color: "#546E7A",
                fontSize: "11px",
                maxWidth: "320px",
                textAlign: "center",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message}
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <InternetIdentityProvider>
        <App />
      </InternetIdentityProvider>
    </QueryClientProvider>
  </ErrorBoundary>,
);

// ── Hide initial loader once React has rendered ──
const loader = document.getElementById("initial-loader");
if (loader) {
  // Small delay so React has time to paint the first frame
  setTimeout(() => {
    loader.style.transition = "opacity 0.3s ease";
    loader.style.opacity = "0";
    setTimeout(() => {
      loader.style.display = "none";
    }, 300);
  }, 100);
}
