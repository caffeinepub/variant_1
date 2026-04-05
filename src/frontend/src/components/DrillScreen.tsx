import type { GeneratedVariant } from "@/lib/variantEngine";
import { CheckCircle2, Target, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

interface DrillScreenProps {
  variants: GeneratedVariant[];
}

type DrillAnswer = {
  selected: string;
  correct: string;
};

export function DrillScreen({ variants }: DrillScreenProps) {
  const [answers, setAnswers] = useState<Record<number, DrillAnswer>>({});

  function handleAnswer(variantIdx: number, selected: string, correct: string) {
    if (answers[variantIdx]) return;
    setAnswers((prev) => ({ ...prev, [variantIdx]: { selected, correct } }));
  }

  if (variants.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center px-4 pt-8"
        data-ocid="drill.empty_state"
        style={{ minHeight: "calc(100vh - 70px)", gap: "20px" }}
      >
        {/* Branding */}
        <div className="text-center" style={{ marginBottom: "16px" }}>
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
            Drill Mode
          </p>
        </div>

        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 64, height: 64, background: "#E3F2FD" }}
        >
          <Target size={28} style={{ color: "#2196F3" }} />
        </div>
        <div>
          <p
            className="font-bold"
            style={{ fontSize: "18px", color: "#212121" }}
          >
            No Variants Yet
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "#9E9E9E",
              maxWidth: 240,
              margin: "8px auto 0",
              lineHeight: 1.6,
            }}
          >
            Generate questions first, then come back here to practice
          </p>
        </div>
      </div>
    );
  }

  const correctCount = Object.values(answers).filter(
    (a) => a.selected === a.correct,
  ).length;
  const totalAnswered = Object.keys(answers).length;

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
          Drill Mode
        </p>
      </div>

      {/* Score bar */}
      {totalAnswered > 0 && (
        <div
          className="rounded-2xl bg-white flex items-center justify-between"
          style={{
            padding: "16px",
            marginBottom: "20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <div>
            <p
              className="font-bold"
              style={{ fontSize: "13px", color: "#424242" }}
            >
              Progress
            </p>
            <p
              className="font-extrabold"
              style={{ fontSize: "22px", color: "#2196F3", marginTop: "2px" }}
            >
              {correctCount} / {totalAnswered}
            </p>
          </div>
          <div className="text-right">
            <p style={{ fontSize: "12px", color: "#9E9E9E" }}>
              {variants.length - totalAnswered} remaining
            </p>
            <p
              className="font-bold"
              style={{
                fontSize: "13px",
                marginTop: "2px",
                color:
                  totalAnswered > 0
                    ? correctCount / totalAnswered >= 0.7
                      ? "#388E3C"
                      : "#E53935"
                    : "#9E9E9E",
              }}
            >
              {totalAnswered > 0
                ? `${Math.round((correctCount / totalAnswered) * 100)}%`
                : ""}
            </p>
          </div>
        </div>
      )}

      <div
        className="flex flex-col"
        style={{ gap: "20px", paddingBottom: "20px" }}
      >
        {variants.map((variant, idx) => {
          const answer = answers[idx];
          const isAnswered = !!answer;

          const allOptions = [
            ...variant.options,
            { label: "D", text: "None of the above" },
          ];

          return (
            <motion.div
              key={variant.questionText}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.25 }}
              data-ocid={`drill.question.${idx + 1}`}
              className="flex flex-col"
              style={{ gap: "10px" }}
            >
              {/* Question card */}
              <div
                className="rounded-2xl bg-white"
                style={{
                  padding: "16px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <span
                  className="font-bold uppercase tracking-widest block"
                  style={{
                    fontSize: "11px",
                    color: "#2196F3",
                    marginBottom: "8px",
                  }}
                >
                  VARIANT #{idx + 1}
                </span>
                <p
                  className="font-semibold leading-relaxed"
                  style={{ fontSize: "14px", color: "#212121" }}
                >
                  {variant.questionText}
                </p>
              </div>

              {/* Answer options */}
              <div className="flex flex-col" style={{ gap: "8px" }}>
                {allOptions.map((option) => {
                  const isSelected =
                    isAnswered && answer.selected === option.label;
                  const isCorrectLabel = variant.correctLabel === option.label;
                  const isWrongSelected = isSelected && !isCorrectLabel;
                  const showCorrect = isAnswered && isCorrectLabel;

                  let bg = "#ffffff";
                  let borderColor = "#E0E0E0";
                  let textColor = "#424242";
                  let labelBg = "#F5F7FA";
                  let labelColor = "#757575";

                  if (showCorrect) {
                    bg = "#E8F5E9";
                    borderColor = "#A5D6A7";
                    textColor = "#2E7D32";
                    labelBg = "#C8E6C9";
                    labelColor = "#1B5E20";
                  } else if (isWrongSelected) {
                    bg = "#FFEBEE";
                    borderColor = "#FFCDD2";
                    textColor = "#C62828";
                    labelBg = "#FFCDD2";
                    labelColor = "#B71C1C";
                  }

                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() =>
                        handleAnswer(idx, option.label, variant.correctLabel)
                      }
                      disabled={isAnswered}
                      data-ocid={`drill.option.${idx + 1}.${option.label}`}
                      className="w-full flex items-center text-left transition-all"
                      style={{
                        gap: "12px",
                        height: "52px",
                        paddingLeft: "16px",
                        paddingRight: "16px",
                        borderRadius: "12px",
                        background: bg,
                        border: `1.5px solid ${borderColor}`,
                        cursor: isAnswered ? "default" : "pointer",
                        boxShadow: isAnswered
                          ? "none"
                          : "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                    >
                      <span
                        className="flex items-center justify-center shrink-0 font-bold"
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: labelBg,
                          color: labelColor,
                          fontSize: "14px",
                        }}
                      >
                        {option.label}
                      </span>
                      <span
                        className="flex-1 font-semibold"
                        style={{ fontSize: "14px", color: textColor }}
                      >
                        {option.text}
                      </span>
                      {showCorrect && (
                        <CheckCircle2
                          size={18}
                          style={{ color: "#388E3C", flexShrink: 0 }}
                        />
                      )}
                      {isWrongSelected && (
                        <XCircle
                          size={18}
                          style={{ color: "#E53935", flexShrink: 0 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
