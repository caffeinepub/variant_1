import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import {
  CheckCircle2,
  Cloud,
  Copy,
  Download,
  LogIn,
  LogOut,
  Smartphone,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

interface SettingsScreenProps {
  installable?: boolean;
  onInstall?: () => void;
}

export function SettingsScreen({
  installable = false,
  onInstall,
}: SettingsScreenProps) {
  const { identity, login, clear, isLoggingIn, isInitializing } =
    useInternetIdentity();
  const [copied, setCopied] = useState(false);

  const isLoggedIn = !!identity;
  const principal = identity?.getPrincipal().toString();
  const truncatedPrincipal = principal
    ? `${principal.slice(0, 8)}...${principal.slice(-6)}`
    : null;

  const alreadyInstalled = localStorage.getItem("pwa-installed") === "true";
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true;

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

  const sectionLabel = (text: string) => (
    <p
      style={{
        fontSize: "11px",
        fontWeight: 700,
        color: "#90A4AE",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: "10px",
        fontFamily: "'Figtree', sans-serif",
      }}
    >
      {text}
    </p>
  );

  // Show install section if: installable and not yet installed, or not in standalone
  const showInstallSection = !alreadyInstalled && !isStandalone;

  return (
    <div
      className="px-4 pt-8"
      style={{ minHeight: "calc(100vh - 70px)", paddingBottom: "24px" }}
    >
      {/* ── Header ── */}
      <div className="text-center" style={{ marginBottom: "28px" }}>
        <h1
          style={{
            fontFamily: "'Figtree', sans-serif",
            fontWeight: 800,
            fontSize: "36px",
            letterSpacing: "-0.5px",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#90CAF9", fontWeight: 600 }}>VAR</span>
          <span style={{ color: "#0D47A1", fontWeight: 900 }}>IANT</span>
        </h1>
        <p
          style={{
            fontSize: "11px",
            color: "#90A4AE",
            fontWeight: 500,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginTop: "6px",
          }}
        >
          Settings
        </p>
      </div>

      <div className="flex flex-col" style={{ gap: "20px" }}>
        {/* ── Install App Section ── */}
        {showInstallSection && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {sectionLabel("Install App")}
            <div
              style={{
                borderRadius: "24px",
                background: "#ffffff",
                padding: "20px",
                boxShadow:
                  "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="flex items-center"
                style={{ gap: "16px", marginBottom: "16px" }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, #E3F2FD, #BBDEFB)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 14px rgba(33,150,243,0.18)",
                    flexShrink: 0,
                  }}
                >
                  <Smartphone size={24} style={{ color: "#2196F3" }} />
                </div>
                <div className="flex-1">
                  <p
                    style={{
                      fontFamily: "'Figtree', sans-serif",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#212121",
                    }}
                  >
                    Add to Home Screen
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#90A4AE",
                      marginTop: "2px",
                    }}
                  >
                    Full-screen, no browser bar
                  </p>
                </div>
              </div>

              {installable && onInstall ? (
                <button
                  type="button"
                  onClick={onInstall}
                  data-ocid="settings.install_button"
                  className="w-full flex items-center justify-center font-bold transition-all active:scale-[0.98]"
                  style={{
                    gap: "8px",
                    height: "50px",
                    borderRadius: "50px",
                    background: "linear-gradient(135deg, #2196F3, #1565C0)",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "14px",
                    boxShadow: "0 6px 20px rgba(33,150,243,0.35)",
                    cursor: "pointer",
                    fontFamily: "'Figtree', sans-serif",
                  }}
                >
                  <Download size={16} />
                  Install Variant App
                </button>
              ) : (
                <div
                  style={{
                    background: "#F8F9FA",
                    borderRadius: "16px",
                    padding: "14px 16px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#546E7A",
                      lineHeight: 1.6,
                    }}
                  >
                    Open this app in Chrome on Android, then tap the menu (⋮)
                    and select{" "}
                    <strong style={{ color: "#1565C0" }}>Install app</strong>.
                    On Safari (iOS), tap the Share icon{" "}
                    <svg
                      style={{ display: "inline", verticalAlign: "middle" }}
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#2196F3"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-label="Share"
                      role="img"
                    >
                      <title>Share</title>
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>{" "}
                    then{" "}
                    <strong style={{ color: "#1565C0" }}>
                      Add to Home Screen
                    </strong>
                    .
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Cloud Connect ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {sectionLabel("Cloud Connect")}
          <div
            style={{
              borderRadius: "24px",
              background: "#ffffff",
              padding: "20px",
              boxShadow:
                "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-center" style={{ gap: "16px" }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "16px",
                  background: isLoggedIn
                    ? "linear-gradient(135deg, #E8F5E9, #C8E6C9)"
                    : "linear-gradient(135deg, #E3F2FD, #BBDEFB)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isLoggedIn
                    ? "0 4px 14px rgba(40,167,69,0.18)"
                    : "0 4px 14px rgba(33,150,243,0.18)",
                  flexShrink: 0,
                }}
              >
                {isLoggedIn ? (
                  <Wifi size={24} style={{ color: "#388E3C" }} />
                ) : (
                  <WifiOff size={24} style={{ color: "#2196F3" }} />
                )}
              </div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: "'Figtree', sans-serif",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#212121",
                  }}
                >
                  {isLoggedIn ? "Connected" : "Not Connected"}
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#90A4AE",
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
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 12px",
                    background: "#E8F5E9",
                    color: "#388E3C",
                    borderRadius: "50px",
                    boxShadow: "0 2px 6px rgba(40,167,69,0.12)",
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
                  className="w-full flex items-center justify-center font-bold transition-all active:scale-[0.98]"
                  style={{
                    gap: "8px",
                    height: "50px",
                    borderRadius: "50px",
                    background:
                      isLoggingIn || isInitializing
                        ? "#90CAF9"
                        : "linear-gradient(135deg, #2196F3, #1565C0)",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "14px",
                    boxShadow:
                      isLoggingIn || isInitializing
                        ? "none"
                        : "0 6px 20px rgba(33,150,243,0.35)",
                    cursor:
                      isLoggingIn || isInitializing ? "not-allowed" : "pointer",
                    fontFamily: "'Figtree', sans-serif",
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
                  className="w-full flex items-center justify-center font-bold transition-all active:scale-[0.98]"
                  style={{
                    gap: "8px",
                    height: "50px",
                    borderRadius: "50px",
                    background: "#ffffff",
                    color: "#E53935",
                    border: "1.5px solid #FFCDD2",
                    fontSize: "14px",
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(220,53,69,0.10)",
                    fontFamily: "'Figtree', sans-serif",
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
          {sectionLabel("Login ID")}
          <div
            style={{
              borderRadius: "24px",
              background: "#ffffff",
              padding: "20px",
              boxShadow:
                "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-center" style={{ gap: "12px" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "14px",
                  background: "#F0F4F8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                }}
              >
                <User size={18} style={{ color: "#546E7A" }} />
              </div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <p
                  className="font-semibold truncate"
                  style={{ fontSize: "13px", color: "#37474F" }}
                  data-ocid="settings.login_id"
                >
                  {isLoggedIn ? truncatedPrincipal : "Not logged in"}
                </p>
                <p
                  style={{
                    fontSize: "11px",
                    color: "#B0BEC5",
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
                  className="flex items-center justify-center transition-all"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "12px",
                    background: copied ? "#E8F5E9" : "#F0F4F8",
                    border: "1px solid #E3EAF3",
                    cursor: "pointer",
                    flexShrink: 0,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  }}
                  aria-label="Copy principal ID"
                >
                  {copied ? (
                    <CheckCircle2 size={16} style={{ color: "#388E3C" }} />
                  ) : (
                    <Copy size={16} style={{ color: "#546E7A" }} />
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
          {sectionLabel("About")}
          <div
            style={{
              borderRadius: "24px",
              background: "#ffffff",
              padding: "20px",
              boxShadow:
                "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-center" style={{ gap: "14px" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #E3F2FD, #BBDEFB)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 4px 14px rgba(33,150,243,0.18)",
                }}
              >
                <Cloud size={20} style={{ color: "#2196F3" }} />
              </div>
              <div>
                <p
                  style={{
                    fontFamily: "'Figtree', sans-serif",
                    fontSize: "16px",
                    fontWeight: 800,
                  }}
                >
                  <span style={{ color: "#90CAF9", fontWeight: 600 }}>VAR</span>
                  <span style={{ color: "#0D47A1", fontWeight: 900 }}>
                    IANT
                  </span>
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#90A4AE",
                    marginTop: "2px",
                  }}
                >
                  Question Generator · v6.0
                </p>
              </div>
            </div>
            <p
              style={{
                fontSize: "12px",
                color: "#B0BEC5",
                lineHeight: 1.7,
                marginTop: "16px",
              }}
            >
              Generate mathematically consistent MCQ variants from any
              Quantitative Aptitude question. Powered by smart classification,
              logical solvers, and the Rule of 4 distractor engine.
            </p>
          </div>
        </motion.div>

        {/* Branding */}
        <div className="text-center" style={{ paddingBottom: "16px" }}>
          <p style={{ fontSize: "11px", color: "#B0BEC5" }}>
            © {new Date().getFullYear()}. Built with{" "}
            <span style={{ color: "#F44336" }}>♥</span> using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#90A4AE" }}
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
