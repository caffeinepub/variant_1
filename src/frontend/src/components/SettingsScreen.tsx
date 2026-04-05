import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import {
  CheckCircle2,
  Cloud,
  Copy,
  LogIn,
  LogOut,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

export function SettingsScreen() {
  const { identity, login, clear, isLoggingIn, isInitializing } =
    useInternetIdentity();
  const [copied, setCopied] = useState(false);

  const isLoggedIn = !!identity;
  const principal = identity?.getPrincipal().toString();
  const truncatedPrincipal = principal
    ? `${principal.slice(0, 8)}...${principal.slice(-6)}`
    : null;

  async function handleCopyPrincipal() {
    if (!principal) return;
    try {
      await navigator.clipboard.writeText(principal);
      setCopied(true);
      toast.success("Principal ID copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy.");
    }
  }

  return (
    <div className="px-4 pt-8" style={{ minHeight: "calc(100vh - 70px)" }}>
      {/* ── Header ── */}
      <div className="text-center" style={{ marginBottom: "20px" }}>
        <h1
          className="font-extrabold tracking-tight"
          style={{ fontSize: "32px", color: "#2196F3" }}
        >
          VARIANT
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: "#9E9E9E",
            fontWeight: 500,
            marginTop: "8px",
          }}
        >
          Settings
        </p>
      </div>

      <div className="flex flex-col" style={{ gap: "20px" }}>
        {/* ── Cloud Connect ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <p
            className="font-bold"
            style={{
              fontSize: "11px",
              color: "#9E9E9E",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Cloud Connect
          </p>

          <div
            className="rounded-2xl bg-white"
            style={{ padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center" style={{ gap: "16px" }}>
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{
                  width: 48,
                  height: 48,
                  background: isLoggedIn ? "#E8F5E9" : "#E3F2FD",
                }}
              >
                {isLoggedIn ? (
                  <Wifi size={22} style={{ color: "#388E3C" }} />
                ) : (
                  <WifiOff size={22} style={{ color: "#2196F3" }} />
                )}
              </div>

              <div className="flex-1" style={{ minWidth: 0 }}>
                <p
                  className="font-bold"
                  style={{ fontSize: "15px", color: "#212121" }}
                >
                  {isLoggedIn ? "Connected" : "Not Connected"}
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#9E9E9E",
                    marginTop: "2px",
                  }}
                >
                  {isLoggedIn
                    ? "Variants saved to cloud"
                    : "Log in to sync your variants"}
                </p>
              </div>

              {isLoggedIn && (
                <span
                  className="rounded-full font-bold"
                  style={{
                    fontSize: "11px",
                    paddingLeft: "10px",
                    paddingRight: "10px",
                    paddingTop: "4px",
                    paddingBottom: "4px",
                    background: "#E8F5E9",
                    color: "#388E3C",
                  }}
                >
                  Active
                </span>
              )}
            </div>

            <div style={{ marginTop: "16px" }}>
              {!isLoggedIn ? (
                <button
                  type="button"
                  onClick={login}
                  disabled={isLoggingIn || isInitializing}
                  data-ocid="settings.cloud_connect_button"
                  className="w-full flex items-center justify-center font-bold transition-all"
                  style={{
                    gap: "8px",
                    height: "48px",
                    borderRadius: "24px",
                    background:
                      isLoggingIn || isInitializing ? "#90CAF9" : "#2196F3",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "14px",
                    boxShadow: "0 2px 8px rgba(33,150,243,0.2)",
                    cursor:
                      isLoggingIn || isInitializing ? "not-allowed" : "pointer",
                  }}
                >
                  {isLoggingIn ? (
                    <>
                      <div
                        className="animate-spin rounded-full border-2 border-white border-t-transparent"
                        style={{ width: 16, height: 16 }}
                      />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <LogIn size={16} />
                      Connect with Internet Identity
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={clear}
                  data-ocid="settings.disconnect_button"
                  className="w-full flex items-center justify-center font-bold transition-all"
                  style={{
                    gap: "8px",
                    height: "48px",
                    borderRadius: "24px",
                    background: "#ffffff",
                    color: "#E53935",
                    border: "1.5px solid #FFCDD2",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  <LogOut size={16} />
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Login ID ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
        >
          <p
            className="font-bold"
            style={{
              fontSize: "11px",
              color: "#9E9E9E",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Login ID
          </p>

          <div
            className="rounded-2xl bg-white"
            style={{ padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center" style={{ gap: "12px" }}>
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{
                  width: 40,
                  height: 40,
                  background: "#F5F7FA",
                }}
              >
                <User size={18} style={{ color: "#757575" }} />
              </div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <p
                  className="font-semibold truncate"
                  style={{ fontSize: "13px", color: "#424242" }}
                  data-ocid="settings.login_id"
                >
                  {isLoggedIn ? truncatedPrincipal : "Not logged in"}
                </p>
                <p
                  style={{
                    fontSize: "11px",
                    color: "#BDBDBD",
                    marginTop: "2px",
                  }}
                >
                  {isLoggedIn ? "Principal ID" : "Log in to get your ID"}
                </p>
              </div>
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={handleCopyPrincipal}
                  data-ocid="settings.copy_button"
                  className="flex items-center justify-center rounded-xl transition-all shrink-0"
                  style={{
                    width: 36,
                    height: 36,
                    background: copied ? "#E8F5E9" : "#F5F7FA",
                    border: "1px solid #E0E0E0",
                    cursor: "pointer",
                  }}
                  aria-label="Copy principal ID"
                >
                  {copied ? (
                    <CheckCircle2 size={16} style={{ color: "#388E3C" }} />
                  ) : (
                    <Copy size={16} style={{ color: "#757575" }} />
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── About ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.16 }}
        >
          <p
            className="font-bold"
            style={{
              fontSize: "11px",
              color: "#9E9E9E",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            About
          </p>

          <div
            className="rounded-2xl bg-white"
            style={{ padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center" style={{ gap: "12px" }}>
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{ width: 40, height: 40, background: "#E3F2FD" }}
              >
                <Cloud size={18} style={{ color: "#2196F3" }} />
              </div>
              <div>
                <p
                  className="font-bold"
                  style={{ fontSize: "15px", color: "#2196F3" }}
                >
                  VARIANT
                </p>
                <p style={{ fontSize: "12px", color: "#9E9E9E" }}>
                  Question Generator · v2.0
                </p>
              </div>
            </div>
            <p
              style={{
                fontSize: "12px",
                color: "#BDBDBD",
                lineHeight: 1.7,
                marginTop: "16px",
              }}
            >
              Generate multiple-choice question variants from any math question.
              Customize integer, decimal, and fraction output modes.
            </p>
          </div>
        </motion.div>

        {/* Branding */}
        <div className="text-center" style={{ paddingBottom: "16px" }}>
          <p style={{ fontSize: "11px", color: "#BDBDBD" }}>
            © {new Date().getFullYear()}. Built with{" "}
            <span style={{ color: "#F44336" }}>♥</span> using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#9E9E9E" }}
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
