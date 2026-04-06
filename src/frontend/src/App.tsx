import { DrillScreen } from "@/components/DrillScreen";
import { GenerateScreen } from "@/components/GenerateScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { VariantScreen } from "@/components/VariantScreen";
import { VocabScreen } from "@/components/VocabScreen";
import { Toaster } from "@/components/ui/sonner";
import { generateVariants } from "@/lib/variantEngine";
import type { Settings, VariantQuestion } from "@/lib/variantEngine";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BookOpen,
  Download,
  FolderOpen,
  Home,
  Settings as SettingsIcon,
  Target,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useActor } from "./hooks/useActor";
import {
  InternetIdentityProvider,
  useInternetIdentity,
} from "./hooks/useInternetIdentity";

const queryClient = new QueryClient();

type Tab = "generate" | "variant" | "drill" | "vocab" | "settings";

// ── iOS detection ──
function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true
  );
}

function AppInner() {
  const [activeTab, setActiveTab] = useState<Tab>("generate");
  const [variants, setVariants] = useState<VariantQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [prefillQuestion, setPrefillQuestion] = useState("");

  // Install state
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSCard, setShowIOSCard] = useState(false);
  const [installable, setInstallable] = useState(false);

  const { actor } = useActor();
  const { identity } = useInternetIdentity();

  useEffect(() => {
    // Don't show if already installed
    const alreadyInstalled = localStorage.getItem("pwa-installed") === "true";
    if (alreadyInstalled || isStandalone()) return;

    if (isIOS()) {
      setShowIOSCard(true);
      return;
    }

    const handleInstallable = () => {
      setInstallable(true);
      setShowInstallBanner(true);
    };

    window.addEventListener("pwa-installable", handleInstallable);

    // Already captured before this mounted
    if (window.deferredInstallPrompt) {
      setInstallable(true);
      setShowInstallBanner(true);
    }

    const handleInstalled = () => {
      setShowInstallBanner(false);
      setInstallable(false);
      localStorage.setItem("pwa-installed", "true");
    };

    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("pwa-installable", handleInstallable);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function handleInstallClick() {
    await window.triggerInstall();
    setShowInstallBanner(false);
    setInstallable(false);
  }

  function handleDismissBanner() {
    setShowInstallBanner(false);
    // Don't mark as installed — just dismissed. Keep installable true so Settings still shows it.
  }

  function handleGenerate(question: string, settings: Settings) {
    if (!question.trim()) {
      toast.error("Please enter a question first.");
      return;
    }
    try {
      const generated = generateVariants(question, settings);
      setVariants(generated);
      setCurrentQuestion(question);

      if (actor && identity) {
        const sessionId = crypto.randomUUID();
        actor
          .saveSession(
            sessionId,
            question,
            {
              decimalPrecision: BigInt(settings.decimalPrecision),
              integerOnly: settings.integerOnly,
              quantity: BigInt(settings.quantity),
              fractionMode: settings.fractionMode,
            },
            generated.map((v) => ({
              questionText: v.questionText,
              optionA: v.options.find((o) => o.label === "A")?.text ?? "",
              optionB: v.options.find((o) => o.label === "B")?.text ?? "",
              optionC: v.options.find((o) => o.label === "C")?.text ?? "",
              correctOption: v.correctLabel,
            })),
          )
          .catch(() => {
            // Non-blocking: ignore backend save errors silently
          });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    }
  }

  function handleNavigateToGenerate(questionText: string) {
    setPrefillQuestion(questionText);
    setActiveTab("generate");
  }

  const tabs: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: "generate", label: "Generate", Icon: Home },
    { id: "variant", label: "Variant", Icon: FolderOpen },
    { id: "drill", label: "Drill", Icon: Target },
    { id: "vocab", label: "Vocab", Icon: BookOpen },
    { id: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  return (
    <div
      className="min-h-screen flex justify-center"
      style={{ backgroundColor: "#f8fafc", minHeight: "100dvh" }}
    >
      {/* ── iOS Install Card ── */}
      {showIOSCard && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(80px + env(safe-area-inset-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 32px)",
            maxWidth: "440px",
            backgroundColor: "#0a0a0f",
            border: "1px solid #00E5FF33",
            borderRadius: "20px",
            padding: "16px 18px",
            zIndex: 99998,
            boxShadow: "0 4px 24px rgba(0,229,255,0.18)",
          }}
        >
          <button
            type="button"
            onClick={() => setShowIOSCard(false)}
            style={{
              position: "absolute",
              top: "10px",
              right: "14px",
              background: "transparent",
              border: "none",
              color: "#90A4AE",
              fontSize: "18px",
              cursor: "pointer",
              lineHeight: 1,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
          <div
            style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                background: "linear-gradient(135deg, #00E5FF22, #00E5FF44)",
                border: "1px solid #00E5FF55",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {/* Share icon (box with up arrow) */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#00E5FF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label="Share"
                role="img"
              >
                <title>Share</title>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: "4px",
                  fontFamily: "'Figtree', sans-serif",
                }}
              >
                Install Variant on iPhone
              </p>
              <p
                style={{ fontSize: "12px", color: "#90A4AE", lineHeight: 1.5 }}
              >
                Tap the{" "}
                <svg
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    margin: "0 2px",
                  }}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#00E5FF"
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
                Share icon at the bottom of Safari, then tap{" "}
                <span style={{ color: "#00E5FF", fontWeight: 600 }}>
                  Add to Home Screen
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Android / Desktop Install Banner ── */}
      {showInstallBanner && installable && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(80px + env(safe-area-inset-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 99998,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <button
            type="button"
            onClick={handleInstallClick}
            data-ocid="install.bottom_banner"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#0a0a0f",
              color: "#00E5FF",
              border: "1.5px solid #00E5FF55",
              borderRadius: "50px",
              padding: "11px 22px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow:
                "0 4px 20px rgba(0,229,255,0.25), 0 0 0 1px rgba(0,229,255,0.1)",
              fontFamily: "'Figtree', sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            <Download size={16} color="#00E5FF" />
            Install Variant App
          </button>
          <p
            style={{
              fontSize: "11px",
              color: "#546E7A",
              textAlign: "center",
              fontFamily: "'Figtree', sans-serif",
            }}
          >
            Install to use full-screen without browser bar
          </p>
          <button
            type="button"
            onClick={handleDismissBanner}
            style={{
              background: "transparent",
              border: "none",
              color: "#546E7A",
              fontSize: "11px",
              cursor: "pointer",
              padding: "2px 8px",
              fontFamily: "'Figtree', sans-serif",
            }}
          >
            Not now
          </button>
        </div>
      )}

      <div
        className="w-full relative flex flex-col"
        style={{ maxWidth: "480px", minHeight: "100dvh" }}
      >
        {/* ── Scrollable Content ── */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            paddingBottom: "calc(90px + env(safe-area-inset-bottom))",
          }}
        >
          <AnimatePresence mode="wait">
            {activeTab === "generate" && (
              <motion.div
                key="generate"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <GenerateScreen
                  onGenerate={handleGenerate}
                  currentQuestion={currentQuestion}
                  variants={variants}
                  prefillQuestion={prefillQuestion}
                />
              </motion.div>
            )}
            {activeTab === "variant" && (
              <motion.div
                key="variant"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <VariantScreen
                  onNavigateToGenerate={handleNavigateToGenerate}
                />
              </motion.div>
            )}
            {activeTab === "drill" && (
              <motion.div
                key="drill"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <DrillScreen />
              </motion.div>
            )}
            {activeTab === "vocab" && (
              <motion.div
                key="vocab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <VocabScreen />
              </motion.div>
            )}
            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <SettingsScreen
                  installable={installable}
                  onInstall={handleInstallClick}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* ── Fixed Bottom Navigation Bar ── */}
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: "480px",
            height: "calc(70px + env(safe-area-inset-bottom))",
            paddingBottom: "env(safe-area-inset-bottom)",
            backgroundColor: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: "1px solid #E3EAF3",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
            zIndex: 9999,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-around",
            paddingTop: "0",
          }}
        >
          {tabs.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                data-ocid={`nav.${id}.tab`}
                className="flex flex-col items-center justify-center flex-1 transition-all"
                style={{
                  gap: "2px",
                  height: "70px",
                  color: isActive ? "#2196F3" : "#9E9E9E",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "26px",
                    borderRadius: "50px",
                    background: isActive ? "#E3F2FD" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    color={isActive ? "#2196F3" : "#9E9E9E"}
                  />
                </div>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#2196F3" : "#9E9E9E",
                    fontFamily: "'Figtree', sans-serif",
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <Toaster position="top-center" richColors />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <InternetIdentityProvider>
        <AppInner />
      </InternetIdentityProvider>
    </QueryClientProvider>
  );
}
