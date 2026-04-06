import { DrillScreen } from "@/components/DrillScreen";
import { GenerateScreen } from "@/components/GenerateScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { VariantScreen } from "@/components/VariantScreen";
import { Toaster } from "@/components/ui/sonner";
import { generateVariants } from "@/lib/variantEngine";
import type { Settings, VariantQuestion } from "@/lib/variantEngine";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  FolderOpen,
  Home,
  Settings as SettingsIcon,
  Target,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useActor } from "./hooks/useActor";
import {
  InternetIdentityProvider,
  useInternetIdentity,
} from "./hooks/useInternetIdentity";

const queryClient = new QueryClient();

type Tab = "generate" | "variant" | "drill" | "settings";

function AppInner() {
  const [activeTab, setActiveTab] = useState<Tab>("generate");
  const [variants, setVariants] = useState<VariantQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [prefillQuestion, setPrefillQuestion] = useState("");
  const { actor } = useActor();
  const { identity } = useInternetIdentity();

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
    { id: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  return (
    <div
      className="min-h-screen flex justify-center"
      style={{ backgroundColor: "#f8fafc", minHeight: "100dvh" }}
    >
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
            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <SettingsScreen />
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
                  gap: "3px",
                  height: "70px",
                  color: isActive ? "#2196F3" : "#9E9E9E",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "28px",
                    borderRadius: "50px",
                    background: isActive ? "#E3F2FD" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    color={isActive ? "#2196F3" : "#9E9E9E"}
                  />
                </div>
                <span
                  style={{
                    fontSize: "10px",
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
