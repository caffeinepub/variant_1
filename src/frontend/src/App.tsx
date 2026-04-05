import { DrillScreen } from "@/components/DrillScreen";
import { GenerateScreen } from "@/components/GenerateScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { VariantScreen } from "@/components/VariantScreen";
import { Toaster } from "@/components/ui/sonner";
import { generateVariants } from "@/lib/variantEngine";
import type { GeneratedVariant, Settings } from "@/lib/variantEngine";
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
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
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

  const tabs: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: "generate", label: "Generate", Icon: Home },
    { id: "variant", label: "Variant", Icon: FolderOpen },
    { id: "drill", label: "Drill", Icon: Target },
    { id: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  return (
    <div
      className="min-h-screen flex justify-center"
      style={{ backgroundColor: "#F5F7FA" }}
    >
      <div
        className="w-full relative flex flex-col"
        style={{ maxWidth: "480px", minHeight: "100vh" }}
      >
        {/* ── Scrollable Content ── */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: "90px" }}
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
                <VariantScreen />
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
                <DrillScreen variants={variants} />
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
            height: "70px",
            backgroundColor: "#FFFFFF",
            borderTop: "1px solid #EEEEEE",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
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
                className="flex flex-col items-center justify-center flex-1 h-full transition-colors"
                style={{
                  gap: "3px",
                  color: isActive ? "#2196F3" : "#9E9E9E",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  color={isActive ? "#2196F3" : "#9E9E9E"}
                />
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#2196F3" : "#9E9E9E",
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
