import type { MCQOption, VariantQuestion } from "@/lib/variantEngine";
import { generateVariants } from "@/lib/variantEngine";
import {
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Target,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

async function copyQuestionToClipboard(
  questionText: string,
  options: MCQOption[],
  correctLabel: string | null,
): Promise<void> {
  const lines = [questionText, ""];
  for (const opt of options) {
    lines.push(
      `${opt.label}) ${opt.text}${
        correctLabel && opt.label === correctLabel ? " ✓" : ""
      }`,
    );
  }
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Copied!");
  } catch {
    toast.error("Copy failed");
  }
}

export function DrillScreen(_props: { variants?: VariantQuestion[] }) {
  const [drillQuestion, setDrillQuestion] = useState("");
  const [drillVariants, setDrillVariants] = useState<VariantQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setDrillQuestion(text);
    } catch {
      // silent
    }
  }

  function handleGenerateDrill() {
    const trimmed = drillQuestion.trim();
    if (!trimmed) {
      toast.error("Please paste a question first.");
      return;
    }
    try {
      const generated = generateVariants(trimmed, {
        integerOnly: false,
        decimalPrecision: 2,
        fractionMode: false,
        quantity: 5,
      });
      setDrillVariants(generated);
      setCurrentIndex(0);
      setAnswered(false);
      setSelectedOption(null);
      setScore(0);
      setIsComplete(false);
      setHasStarted(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    }
  }

  function handleOptionSelect(label: string) {
    if (answered) return;
    const correctLabel = drillVariants[currentIndex].correctLabel;
    const isCorrect = label === correctLabel;
    setSelectedOption(label);
    setAnswered(true);
    if (isCorrect) setScore((prev) => prev + 1);
  }

  function handleNext() {
    const next = currentIndex + 1;
    if (next >= drillVariants.length) {
      setIsComplete(true);
    } else {
      setCurrentIndex(next);
      setAnswered(false);
      setSelectedOption(null);
    }
  }

  function handleRestart() {
    setCurrentIndex(0);
    setAnswered(false);
    setSelectedOption(null);
    setScore(0);
    setIsComplete(false);
    setHasStarted(false);
    setDrillVariants([]);
  }

  function getOptionStyle(
    optionLabel: string,
    correctLabel: string,
  ): React.CSSProperties {
    if (!answered) {
      return {
        background: "#ffffff",
        border: "1.5px solid #E3EAF3",
        color: "#424242",
      };
    }
    const isCorrect = optionLabel === correctLabel;
    const isSelected = optionLabel === selectedOption;
    if (isCorrect)
      return {
        background: "#E8F5E9",
        border: "1.5px solid #28A745",
        color: "#2E7D32",
      };
    if (isSelected && !isCorrect)
      return {
        background: "#FFEBEE",
        border: "1.5px solid #DC3545",
        color: "#C62828",
      };
    return {
      background: "#F8F9FA",
      border: "1.5px solid #E0E0E0",
      color: "#9E9E9E",
    };
  }

  const currentVariant =
    drillVariants.length > 0 ? drillVariants[currentIndex] : null;

  return (
    <div
      className="flex flex-col px-4 pt-8"
      style={{
        minHeight: "calc(100vh - 70px)",
        gap: "20px",
        paddingBottom: "24px",
      }}
    >
      {/* ── Header ── */}
      <div className="text-center">
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
          Drill Mode
        </p>
      </div>

      {/* ── Input Area ── */}
      <div className="flex flex-col" style={{ gap: "12px" }}>
        <button
          type="button"
          onClick={handlePaste}
          data-ocid="drill.paste_button"
          className="inline-flex items-center gap-1.5 self-start font-semibold transition-all active:scale-95"
          style={{
            height: "40px",
            paddingLeft: "16px",
            paddingRight: "16px",
            borderRadius: "50px",
            border: "1.5px solid #2196F3",
            color: "#1565C0",
            background: "#ffffff",
            fontSize: "13px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(33,150,243,0.15)",
            fontFamily: "'Figtree', sans-serif",
          }}
        >
          <ClipboardPaste size={14} />
          Paste Question
        </button>

        <textarea
          value={drillQuestion}
          onChange={(e) => setDrillQuestion(e.target.value)}
          placeholder="Paste your math question here..."
          data-ocid="drill.textarea"
          className="w-full resize-none outline-none"
          style={{
            minHeight: "120px",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.07), 0 0 0 1.5px #E3EAF3",
            border: "none",
            borderRadius: "20px",
            padding: "16px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#212121",
            backgroundColor: "#ffffff",
            lineHeight: "1.6",
            fontFamily: "inherit",
          }}
        />

        <button
          type="button"
          onClick={handleGenerateDrill}
          data-ocid="drill.primary_button"
          className="w-full font-bold transition-all active:scale-[0.98]"
          style={{
            height: "54px",
            borderRadius: "50px",
            background: "linear-gradient(135deg, #2196F3, #1565C0)",
            color: "#ffffff",
            fontSize: "15px",
            letterSpacing: "1.5px",
            border: "none",
            cursor: "pointer",
            boxShadow:
              "0 6px 20px rgba(33,150,243,0.35), 0 2px 6px rgba(0,0,0,0.10)",
            fontFamily: "'Figtree', sans-serif",
          }}
        >
          GENERATE DRILL
        </button>
      </div>

      {/* ── Initial empty state ── */}
      {!hasStarted && (
        <div
          className="flex flex-col items-center justify-center text-center"
          data-ocid="drill.empty_state"
          style={{ paddingTop: "20px", paddingBottom: "40px", gap: "16px" }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              background: "linear-gradient(135deg, #E3F2FD, #BBDEFB)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 20px rgba(33,150,243,0.18)",
            }}
          >
            <Target size={28} style={{ color: "#2196F3" }} />
          </div>
          <div>
            <p
              style={{
                fontFamily: "'Figtree', sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                color: "#263238",
              }}
            >
              Ready to Practice
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "#90A4AE",
                maxWidth: 240,
                margin: "6px auto 0",
                lineHeight: 1.6,
              }}
            >
              Paste a question above and tap Generate Drill to start
            </p>
          </div>
        </div>
      )}

      {/* ── Drill Complete ── */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          data-ocid="drill.success_state"
          className="flex flex-col items-center text-center"
          style={{
            borderRadius: "24px",
            background: "#ffffff",
            padding: "32px 24px",
            boxShadow:
              "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              background: "linear-gradient(135deg, #E8F5E9, #C8E6C9)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 20px rgba(40,167,69,0.20)",
            }}
          >
            <CheckCircle2 size={36} style={{ color: "#28A745" }} />
          </div>
          <div>
            <p
              style={{
                fontFamily: "'Figtree', sans-serif",
                fontSize: "22px",
                fontWeight: 800,
                color: "#212121",
              }}
            >
              🎉 Drill Complete!
            </p>
            <p
              style={{
                fontFamily: "'Figtree', sans-serif",
                fontSize: "28px",
                fontWeight: 800,
                color: "#2196F3",
                marginTop: "8px",
              }}
            >
              {score} / {drillVariants.length} correct
            </p>
            <p style={{ fontSize: "13px", color: "#90A4AE", marginTop: "4px" }}>
              {score === drillVariants.length
                ? "Perfect score! 🏆"
                : score >= Math.ceil(drillVariants.length * 0.7)
                  ? "Great job! Keep it up."
                  : "Keep practicing, you'll get there!"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRestart}
            data-ocid="drill.secondary_button"
            className="font-bold transition-all active:scale-[0.98]"
            style={{
              height: "50px",
              paddingLeft: "36px",
              paddingRight: "36px",
              borderRadius: "50px",
              background: "linear-gradient(135deg, #2196F3, #1565C0)",
              color: "#ffffff",
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              marginTop: "8px",
              boxShadow: "0 6px 20px rgba(33,150,243,0.35)",
              fontFamily: "'Figtree', sans-serif",
            }}
          >
            Restart Drill
          </button>
        </motion.div>
      )}

      {/* ── Current Question ── */}
      {hasStarted && !isComplete && currentVariant && (
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex flex-col"
          style={{ gap: "12px" }}
        >
          {/* Progress */}
          <div className="flex items-center justify-between">
            <span
              style={{ fontSize: "12px", fontWeight: 700, color: "#90A4AE" }}
            >
              Question {currentIndex + 1} of {drillVariants.length}
            </span>
            <span
              style={{ fontSize: "12px", fontWeight: 700, color: "#2196F3" }}
            >
              Score: {score} / {currentIndex}
            </span>
          </div>

          {/* Chapter badge */}
          {currentVariant.chapter && (
            <div className="flex items-center" style={{ gap: "6px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#1565C0",
                  background: "#E3F2FD",
                  borderRadius: "50px",
                  padding: "2px 10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {currentVariant.chapter}
              </span>
              {currentVariant.subTopic && (
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 600,
                    color: "#90A4AE",
                    background: "#F0F4F8",
                    borderRadius: "50px",
                    padding: "2px 8px",
                    textTransform: "uppercase",
                  }}
                >
                  {currentVariant.subTopic}
                </span>
              )}
            </div>
          )}

          {/* Question card */}
          <div
            data-ocid={`drill.question.${currentIndex + 1}`}
            style={{
              borderRadius: "24px",
              background: "#ffffff",
              padding: "18px",
              boxShadow:
                "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            {/* Card header: variant label + copy button */}
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: "8px" }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#90A4AE",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                VARIANT #{currentIndex + 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  copyQuestionToClipboard(
                    currentVariant.questionText,
                    currentVariant.options,
                    answered ? currentVariant.correctLabel : null,
                  )
                }
                data-ocid={`drill.copy.${currentIndex + 1}`}
                aria-label="Copy question"
                title="Copy question"
                style={{
                  background: "#F0F4F8",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  flexShrink: 0,
                }}
              >
                <Copy size={14} style={{ color: "#90A4AE" }} />
              </button>
            </div>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#212121",
                lineHeight: 1.6,
              }}
            >
              {currentVariant.questionText}
            </p>
          </div>

          {/* Answer options */}
          <div className="flex flex-col" style={{ gap: "8px" }}>
            {currentVariant.options.map((option) => {
              const optStyle = getOptionStyle(
                option.label,
                currentVariant.correctLabel,
              );
              const isCorrect =
                answered && option.label === currentVariant.correctLabel;
              const isWrong =
                answered &&
                option.label === selectedOption &&
                option.label !== currentVariant.correctLabel;

              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleOptionSelect(option.label)}
                  disabled={answered}
                  data-ocid={`drill.option.${currentIndex + 1}.${option.label}`}
                  className="w-full flex items-center text-left transition-all"
                  style={{
                    height: "52px",
                    paddingLeft: "16px",
                    paddingRight: "16px",
                    borderRadius: "16px",
                    cursor: answered ? "default" : "pointer",
                    gap: "12px",
                    boxShadow: answered ? "none" : "0 2px 8px rgba(0,0,0,0.06)",
                    ...optStyle,
                  }}
                >
                  <span
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: isCorrect
                        ? "#C8E6C9"
                        : isWrong
                          ? "#FFCDD2"
                          : "#F0F4F8",
                      color: isCorrect
                        ? "#1B5E20"
                        : isWrong
                          ? "#B71C1C"
                          : "#546E7A",
                      fontSize: "14px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {option.label}
                  </span>
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: 600 }}>
                    {option.text}
                  </span>
                  {isCorrect && (
                    <CheckCircle2
                      size={18}
                      style={{ color: "#388E3C", flexShrink: 0 }}
                    />
                  )}
                  {isWrong && (
                    <XCircle
                      size={18}
                      style={{ color: "#E53935", flexShrink: 0 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Next Question button */}
          {answered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <button
                type="button"
                onClick={handleNext}
                data-ocid="drill.button"
                className="w-full font-bold transition-all active:scale-[0.98]"
                style={{
                  height: "52px",
                  borderRadius: "50px",
                  background: "linear-gradient(135deg, #2196F3, #1565C0)",
                  color: "#ffffff",
                  fontSize: "15px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(33,150,243,0.35)",
                  fontFamily: "'Figtree', sans-serif",
                }}
              >
                {currentIndex + 1 >= drillVariants.length
                  ? "See Results"
                  : "Next Question →"}
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
