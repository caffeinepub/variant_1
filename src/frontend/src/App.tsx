import { DrillScreen } from "@/components/DrillScreen";
import { GenerateScreen } from "@/components/GenerateScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { VariantScreen } from "@/components/VariantScreen";
import { VocabScreen } from "@/components/VocabScreen";
import { Toaster } from "@/components/ui/sonner";
import { generateVariantJS, solveQuestionJS } from "@/lib/jsEngine";
import { classify } from "@/lib/variantEngine";
import type { Settings, VariantQuestion } from "@/lib/variantEngine";
import {
  BookOpen,
  FolderOpen,
  Home,
  Settings as SettingsIcon,
  Target,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";

type Tab = "generate" | "variant" | "drill" | "vocab" | "settings";

// App is the single exported component -- providers live in main.tsx
export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("generate");
  const [variants, setVariants] = useState<VariantQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [prefillQuestion, setPrefillQuestion] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  // Actor is used for non-blocking session saving only -- never gates the app shell
  const { actor } = useActor();
  const { identity } = useInternetIdentity();

  function handleGenerate(question: string, settings: Settings) {
    if (!question.trim()) {
      toast.error("Please enter a question first.");
      return;
    }

    setServerError(null);

    try {
      // Solve base question (synchronous, in-browser)
      const baseResult = solveQuestionJS(question.trim(), settings);

      // Generate additional variants
      const additionalCount = settings.quantity - 1;
      const variantResults = Array.from({ length: additionalCount }, () => {
        try {
          return generateVariantJS(question.trim(), settings);
        } catch {
          return null;
        }
      });

      // Helper to convert JS engine result to VariantQuestion
      function toVariantQuestion(
        result: typeof baseResult,
        questionText: string,
        idx: number,
      ): VariantQuestion {
        const { chapter, subTopic } = classify(questionText);
        const labels = ["A", "B", "C", "D"] as const;
        const options = result.options_full.map((opt, i) => ({
          label: labels[i],
          text: opt.display,
          isCorrect: i === result.correct_index,
        }));
        const correctLabel = labels[result.correct_index];
        const steps = result.solution_steps ?? [];
        return {
          id: `js-${Date.now()}-${idx}`,
          questionText,
          options,
          correctAnswer: result.answer.display,
          correctLabel,
          chapter,
          subTopic,
          solution: {
            phase1: steps[0] ?? "Extracting given data...",
            phase2: steps.slice(1, -1).join(" | ") || "Applying formula",
            phase3: steps[steps.length - 1] ?? result.answer.display,
          },
        };
      }

      const generated: VariantQuestion[] = [
        toVariantQuestion(baseResult, question.trim(), 0),
        ...variantResults
          .map((r, i) => {
            if (!r) return null;
            const qText = r.new_question_text ?? question.trim();
            return toVariantQuestion(r, qText, i + 1);
          })
          .filter((v): v is VariantQuestion => v !== null),
      ];

      setVariants(generated);
      setCurrentQuestion(question);

      // Non-blocking backend save -- only when actor is available
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
      let message = "Could not solve question";
      if (err instanceof Error) {
        message = err.message;
      }
      setServerError(message);
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
                  serverError={serverError}
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
