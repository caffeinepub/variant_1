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

// ── Global unhandled rejection logger ──
// Prevents silent white screens caused by async promise failures
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Variant] Unhandled promise rejection:", event.reason);
  // Log only -- do not suppress or rethrow
});

// ── Error Boundary ──
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
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
            background: "#0a0a0f",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
            fontFamily: "sans-serif",
          }}
        >
          <p style={{ color: "#20E6E6", fontSize: "18px", fontWeight: 600 }}>
            Something went wrong loading the app.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "transparent",
              border: "1.5px solid #20E6E6",
              color: "#20E6E6",
              borderRadius: "8px",
              padding: "10px 24px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {this.state.error && (
            <p
              style={{
                color: "#546E7A",
                fontSize: "12px",
                maxWidth: "360px",
                wordBreak: "break-word",
                marginTop: "8px",
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

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <InternetIdentityProvider>
        <App />
      </InternetIdentityProvider>
    </QueryClientProvider>
  </ErrorBoundary>,
);

// Hide the initial loading spinner now that React has rendered
const loader = document.getElementById("initial-loader");
if (loader) loader.style.display = "none";
