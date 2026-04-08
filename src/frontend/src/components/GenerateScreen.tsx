import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { MCQOption, Settings, VariantQuestion } from "@/lib/variantEngine";
import { detectChapterType, formatExport } from "@/lib/variantEngine";
import {
  Bookmark,
  ClipboardPaste,
  Copy,
  Download,
  Settings2,
  Share2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface GenerateScreenProps {
  onGenerate: (question: string, settings: Settings) => void;
  currentQuestion: string;
  variants: VariantQuestion[];
  prefillQuestion?: string;
  serverError?: string | null;
}

interface SavedQuestion {
  id: string;
  questionText: string;
  options: MCQOption[];
  correctLabel: string;
  chapterType: string;
  subTopic: string;
  savedAt: number;
  solution?: VariantQuestion["solution"];
}

const SAVED_KEY = "variant_saved_questions";

function getSavedQuestions(): SavedQuestion[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedQuestion[];
  } catch {
    return [];
  }
}

function saveQuestion(q: SavedQuestion): void {
  const existing = getSavedQuestions();
  if (existing.some((s) => s.questionText === q.questionText)) return;
  existing.push(q);
  localStorage.setItem(SAVED_KEY, JSON.stringify(existing));
}

async function copyQuestionToClipboard(
  questionText: string,
  options: MCQOption[],
  correctLabel: string,
): Promise<void> {
  const lines = [questionText, ""];
  for (const opt of options) {
    lines.push(
      `${opt.label}) ${opt.text}${opt.label === correctLabel ? " ✓" : ""}`,
    );
  }
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Copied!");
  } catch {
    toast.error("Copy failed");
  }
}

/* ── Physical 3D Toggle ──────────────────── */
function PhysicalToggle({
  checked,
  onChange,
}: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: "52px",
        height: "28px",
        borderRadius: "50px",
        background: checked
          ? "linear-gradient(135deg, #1565C0, #2196F3)"
          : "#D0D8E4",
        boxShadow: checked
          ? "inset 0 2px 4px rgba(0,0,0,0.20), 0 1px 2px rgba(255,255,255,0.6)"
          : "inset 0 2px 6px rgba(0,0,0,0.15), 0 1px 2px rgba(255,255,255,0.8)",
        transition: "all 0.25s ease",
        border: "none",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: "linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.10)",
          transform: checked ? "translateX(26px)" : "translateX(3px)",
          transition: "transform 0.25s ease",
        }}
      />
    </button>
  );
}

/* ── Soft Slider ────────────────── */
function SoftSlider({
  value,
  onChange,
  disabled,
}: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  const sliderRef = useRef<HTMLInputElement>(null);

  const updateProgress = useCallback((v: number) => {
    if (sliderRef.current) {
      const pct = ((v - 1) / 9) * 100;
      sliderRef.current.style.setProperty("--progress", `${pct}%`);
    }
  }, []);

  useEffect(() => {
    updateProgress(value);
  }, [value, updateProgress]);

  return (
    <input
      ref={sliderRef}
      type="range"
      className="soft-slider w-full"
      min={1}
      max={10}
      step={1}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const v = Number(e.target.value);
        onChange(v);
        updateProgress(v);
      }}
      data-ocid="settings.decimal_slider"
      aria-label="Decimal precision"
      style={{ opacity: disabled ? 0.4 : 1 }}
    />
  );
}

/* ── Solution Slab ────────────────── */
function SolutionSlab({ solution }: { solution: VariantQuestion["solution"] }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginTop: "12px" }}>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        style={{
          padding: "8px 20px",
          borderRadius: "50px",
          background: "#F0F4F8",
          border: "1px solid #D0D8E4",
          fontSize: "12px",
          fontWeight: 600,
          color: "#1565C0",
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          fontFamily: "'Figtree', sans-serif",
        }}
      >
        {show ? "▲ Hide Solution" : "▼ Show Solution"}
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div
              className="solution-slab"
              style={{ marginTop: "10px", padding: "16px" }}
            >
              <div style={{ marginBottom: "10px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#1565C0",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Phase 1 — Given Data
                </span>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#37474F",
                    marginTop: "4px",
                  }}
                >
                  {solution.phase1}
                </p>
              </div>
              <div style={{ marginBottom: "10px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#1565C0",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Phase 2 — Core Logic
                </span>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#37474F",
                    marginTop: "4px",
                    fontFamily: "monospace",
                  }}
                >
                  {solution.phase2}
                </p>
              </div>
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#1565C0",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Phase 3 — Final Calculation
                </span>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#37474F",
                    marginTop: "4px",
                  }}
                >
                  {solution.phase3}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GenerateScreen({
  onGenerate,
  currentQuestion,
  variants,
  prefillQuestion,
  serverError = null,
}: GenerateScreenProps) {
  const [question, setQuestion] = useState(
    "If a car travels at 60 km/h, how long does it take to travel 120 km?",
  );
  const [integerOnly, setIntegerOnly] = useState(false);
  const [decimalPrecision, setDecimalPrecision] = useState(2);
  const [fractionMode, setFractionMode] = useState(false);
  const [quantity, setQuantity] = useState<3 | 4 | 5>(3);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, string>
  >({});
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());

  // Prefill question when navigating from Variant tab
  useEffect(() => {
    if (prefillQuestion?.trim()) {
      setQuestion(prefillQuestion);
      // Clear previous results so user sees the new question is ready
      setSelectedOptions({});
      setBookmarked(new Set());
    }
  }, [prefillQuestion]);

  const decimalsDisabled = integerOnly;
  const fractionDisabled = integerOnly;

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setQuestion(text);
    } catch {
      // silent
    }
  }

  function handleGenerate() {
    onGenerate(question.trim(), {
      integerOnly,
      decimalPrecision,
      fractionMode,
      quantity,
    });
    setSelectedOptions({});
    setBookmarked(new Set());
  }

  function handleOptionClick(variantIdx: number, clickedLabel: string) {
    if (selectedOptions[variantIdx]) return;
    setSelectedOptions((prev) => ({ ...prev, [variantIdx]: clickedLabel }));
  }

  function handleBookmark(variantIdx: number, variant: VariantQuestion) {
    if (bookmarked.has(variantIdx)) return;
    const chapterType = detectChapterType(variant.questionText);
    const saved: SavedQuestion = {
      id: `${Date.now()}${variantIdx}`,
      questionText: variant.questionText,
      options: variant.options,
      correctLabel: variant.correctLabel,
      chapterType,
      subTopic: variant.subTopic,
      savedAt: Date.now(),
      solution: variant.solution,
    };
    saveQuestion(saved);
    setBookmarked((prev) => new Set([...prev, variantIdx]));
    toast.success("Question saved!");
  }

  const exportText =
    variants.length > 0
      ? formatExport(currentQuestion, variants, {
          integerOnly,
          decimalPrecision,
          fractionMode,
          quantity,
        })
      : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportText);
      toast.success("Copied to clipboard!");
      setExportOpen(false);
    } catch {
      toast.error("Failed to copy.");
    }
  }

  function handleDownload() {
    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "variant-questions.txt";
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
    toast.success("Downloaded!");
  }

  function getOptionStyle(
    variantIdx: number,
    optionLabel: string,
    correctLabel: string,
  ): React.CSSProperties {
    const selected = selectedOptions[variantIdx];
    if (!selected) {
      return {
        background: "#ffffff",
        border: "1.5px solid #E0E0E0",
        color: "#424242",
      };
    }
    const isCorrect = optionLabel === correctLabel;
    const isSelected = optionLabel === selected;
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

  /* pill container style for format controls */
  const pillContainer = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: "50px",
    height: "56px",
    paddingLeft: "18px",
    paddingRight: "18px",
    background: active ? "#1565C0" : "#F0F4F8",
    border: active ? "none" : "1px solid #E3EAF3",
    boxShadow: active
      ? "0 4px 14px rgba(21,101,192,0.35)"
      : "0 2px 8px rgba(0,0,0,0.05)",
    transition: "all 0.22s ease",
    gap: "12px",
  });

  return (
    <div
      className="flex flex-col px-4 pt-8"
      style={{
        backgroundColor: "transparent",
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
          Question Generator
        </p>
      </div>

      {/* ── Input Area ── */}
      <div className="flex flex-col" style={{ gap: "12px" }}>
        <button
          type="button"
          onClick={handlePaste}
          data-ocid="input.paste_button"
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
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Paste your math question here..."
          data-ocid="input.textarea"
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
      </div>

      {/* ── Output Format Section ── */}
      <div className="flex flex-col" style={{ gap: "10px" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#90A4AE",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: "'Figtree', sans-serif",
          }}
        >
          Output Format
        </p>

        {/* Integer Only pill */}
        <div style={pillContainer(integerOnly)}>
          <Label
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: integerOnly ? "#ffffff" : "#546E7A",
              cursor: "pointer",
              fontFamily: "'Figtree', sans-serif",
              flex: 1,
            }}
          >
            Integer Only
          </Label>
          <PhysicalToggle checked={integerOnly} onChange={setIntegerOnly} />
        </div>

        {/* Decimal Precision pill */}
        <div
          style={{
            ...pillContainer(false),
            flexDirection: "column",
            height: "auto",
            paddingTop: "14px",
            paddingBottom: "14px",
            alignItems: "stretch",
            opacity: decimalsDisabled ? 0.45 : 1,
            pointerEvents: decimalsDisabled ? "none" : "auto",
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: "10px" }}
          >
            <Label
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#546E7A",
                fontFamily: "'Figtree', sans-serif",
              }}
            >
              Decimal Precision
            </Label>
            <span
              style={{ fontSize: "12px", fontWeight: 700, color: "#2196F3" }}
            >
              {decimalPrecision} decimal{decimalPrecision !== 1 ? "s" : ""}
            </span>
          </div>
          <SoftSlider
            value={decimalPrecision}
            onChange={setDecimalPrecision}
            disabled={decimalsDisabled}
          />
          <div
            className="flex justify-between"
            style={{
              marginTop: "6px",
              paddingLeft: "2px",
              paddingRight: "2px",
            }}
          >
            {Array.from({ length: 10 }, (_, i) => {
              const val = i + 1;
              const isActive = val === decimalPrecision;
              return (
                <span
                  key={`tick-${val}`}
                  style={{
                    fontSize: "9px",
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? "#2196F3" : "#B0BEC5",
                    lineHeight: 1,
                    textAlign: "center",
                    width: "10%",
                  }}
                >
                  {val}
                </span>
              );
            })}
          </div>
        </div>

        {/* Fraction Mode pill */}
        <div
          style={{
            ...pillContainer(fractionMode && !fractionDisabled),
            opacity: fractionDisabled ? 0.45 : 1,
            pointerEvents: fractionDisabled ? "none" : "auto",
          }}
        >
          <Label
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: fractionMode && !fractionDisabled ? "#ffffff" : "#546E7A",
              cursor: "pointer",
              fontFamily: "'Figtree', sans-serif",
              flex: 1,
            }}
          >
            Fraction Mode
          </Label>
          <PhysicalToggle
            checked={fractionMode && !fractionDisabled}
            onChange={setFractionMode}
          />
        </div>
      </div>

      {/* ── Quantity ── */}
      <div>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#90A4AE",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: "'Figtree', sans-serif",
            marginBottom: "12px",
          }}
        >
          Quantity
        </p>
        <div className="flex" style={{ gap: "12px" }}>
          {([3, 4, 5] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuantity(q)}
              data-ocid={`settings.quantity.${q}`}
              aria-pressed={quantity === q}
              className="flex items-center justify-center font-bold transition-all active:scale-95"
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background:
                  quantity === q
                    ? "linear-gradient(135deg, #2196F3, #1565C0)"
                    : "#F0F4F8",
                color: quantity === q ? "#ffffff" : "#546E7A",
                fontSize: "16px",
                border: quantity === q ? "none" : "1.5px solid #D0D8E4",
                cursor: "pointer",
                boxShadow:
                  quantity === q
                    ? "0 4px 14px rgba(33,150,243,0.40)"
                    : "0 2px 6px rgba(0,0,0,0.06)",
                fontFamily: "'Figtree', sans-serif",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── Generate Button ── */}
      <button
        type="button"
        onClick={handleGenerate}
        data-ocid="input.primary_button"
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <Settings2 size={18} />
        GENERATE VARIANTS
      </button>

      {/* ── Error Card ── */}
      {serverError && (
        <div
          style={{
            background: "#FFEBEE",
            border: "1.5px solid #DC3545",
            borderRadius: "20px",
            padding: "16px",
            marginBottom: "4px",
          }}
          data-ocid="results.error_state"
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#C62828",
              marginBottom: "6px",
              fontFamily: "'Figtree', sans-serif",
            }}
          >
            ❌ Could not solve question
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "#C62828",
              lineHeight: 1.5,
              fontFamily: "'Figtree', sans-serif",
            }}
          >
            {serverError}
          </p>
          <p
            style={{
              fontSize: "11px",
              color: "#9E9E9E",
              marginTop: "8px",
              fontFamily: "'Figtree', sans-serif",
            }}
          >
            Try rephrasing with clearer keywords (e.g. "profit", "discount",
            "speed", "mixture").
          </p>
        </div>
      )}

      {/* ── Generated Variant Cards ── */}
      <AnimatePresence>
        {variants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col"
            style={{ gap: "16px" }}
          >
            <div className="flex items-center justify-between">
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#546E7A",
                  fontFamily: "'Figtree', sans-serif",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Generated ({variants.length})
              </p>
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                data-ocid="results.open_modal_button"
                className="inline-flex items-center font-semibold"
                style={{
                  gap: "6px",
                  paddingLeft: "14px",
                  paddingRight: "14px",
                  height: "34px",
                  borderRadius: "50px",
                  background: "linear-gradient(135deg, #2196F3, #1565C0)",
                  color: "#ffffff",
                  fontSize: "12px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 3px 10px rgba(33,150,243,0.30)",
                  fontFamily: "'Figtree', sans-serif",
                }}
              >
                <Share2 size={12} />
                Export
              </button>
            </div>

            {variants.map((variant, idx) => {
              const isAnswered = !!selectedOptions[idx];
              const isSaved = bookmarked.has(idx);

              return (
                <motion.div
                  key={variant.id ?? variant.questionText}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: idx * 0.06,
                    duration: 0.28,
                    ease: "easeOut",
                  }}
                  data-ocid={`results.item.${idx + 1}`}
                  style={{
                    borderRadius: "24px",
                    background: "#ffffff",
                    padding: "18px",
                    boxShadow:
                      "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Chapter badge + copy + bookmark */}
                  <div
                    className="flex items-center justify-between"
                    style={{ marginBottom: "8px" }}
                  >
                    <div className="flex items-center" style={{ gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#1565C0",
                          background: "#E3F2FD",
                          borderRadius: "50px",
                          padding: "2px 10px",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          fontFamily: "'Figtree', sans-serif",
                        }}
                      >
                        {variant.chapter}
                      </span>
                      {variant.subTopic && (
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 600,
                            color: "#90A4AE",
                            background: "#F0F4F8",
                            borderRadius: "50px",
                            padding: "2px 8px",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {variant.subTopic}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center" style={{ gap: "6px" }}>
                      {/* Copy button */}
                      <button
                        type="button"
                        onClick={() =>
                          copyQuestionToClipboard(
                            variant.questionText,
                            variant.options,
                            variant.correctLabel,
                          )
                        }
                        data-ocid={`results.copy.${idx + 1}`}
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
                      {/* Bookmark button */}
                      <button
                        type="button"
                        onClick={() => handleBookmark(idx, variant)}
                        data-ocid={`results.bookmark.${idx + 1}`}
                        aria-label={isSaved ? "Saved" : "Save question"}
                        style={{
                          background: isSaved ? "#E3F2FD" : "#F0F4F8",
                          border: "none",
                          cursor: isSaved ? "default" : "pointer",
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
                        <Bookmark
                          size={16}
                          fill={isSaved ? "#2196F3" : "none"}
                          style={{ color: isSaved ? "#2196F3" : "#90A4AE" }}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Variant label */}
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#90A4AE",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      display: "block",
                      marginBottom: "6px",
                    }}
                  >
                    Variant #{idx + 1}
                  </span>

                  {/* Question text */}
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#212121",
                      marginBottom: "14px",
                      lineHeight: 1.6,
                    }}
                  >
                    {variant.questionText}
                  </p>

                  {/* MCQ Options */}
                  <div className="flex flex-col" style={{ gap: "8px" }}>
                    {variant.options.map((option) => {
                      const optStyle = getOptionStyle(
                        idx,
                        option.label,
                        variant.correctLabel,
                      );
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => handleOptionClick(idx, option.label)}
                          data-ocid={`results.option.${idx + 1}.${option.label}`}
                          disabled={isAnswered}
                          className="w-full flex items-center text-left transition-all"
                          style={{
                            height: "48px",
                            paddingLeft: "14px",
                            paddingRight: "14px",
                            borderRadius: "16px",
                            cursor: isAnswered ? "default" : "pointer",
                            gap: "10px",
                            boxShadow: isAnswered
                              ? "none"
                              : "0 2px 8px rgba(0,0,0,0.06)",
                            ...optStyle,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              minWidth: "20px",
                              color: optStyle.color,
                            }}
                          >
                            {option.label}
                          </span>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 500,
                              flex: 1,
                              color: optStyle.color,
                            }}
                          >
                            {option.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Solution Slab */}
                  {variant.solution && (
                    <SolutionSlab solution={variant.solution} />
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Export Dialog ── */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent
          className="max-w-sm"
          style={{ borderRadius: "24px" }}
          data-ocid="results.dialog"
        >
          <DialogHeader>
            <DialogTitle
              style={{ fontFamily: "'Figtree', sans-serif", fontWeight: 700 }}
            >
              Export Results
            </DialogTitle>
          </DialogHeader>
          <div
            className="flex flex-col"
            style={{ gap: "10px", paddingTop: "4px" }}
          >
            <button
              type="button"
              onClick={handleCopy}
              data-ocid="results.secondary_button"
              className="flex items-center w-full font-medium"
              style={{
                gap: "12px",
                height: "48px",
                paddingLeft: "16px",
                paddingRight: "16px",
                borderRadius: "16px",
                border: "1.5px solid #E0E0E0",
                color: "#424242",
                background: "#fff",
                cursor: "pointer",
                fontSize: "14px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <Copy size={16} style={{ color: "#2196F3", flexShrink: 0 }} />
              Copy All Text
            </button>
            <button
              type="button"
              onClick={handleDownload}
              data-ocid="results.save_button"
              className="flex items-center w-full font-medium"
              style={{
                gap: "12px",
                height: "48px",
                paddingLeft: "16px",
                paddingRight: "16px",
                borderRadius: "16px",
                border: "1.5px solid #E0E0E0",
                color: "#424242",
                background: "#fff",
                cursor: "pointer",
                fontSize: "14px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <Download size={16} style={{ color: "#2196F3", flexShrink: 0 }} />
              Download .txt
            </button>
          </div>
          <button
            type="button"
            onClick={() => setExportOpen(false)}
            data-ocid="results.cancel_button"
            className="w-full text-sm font-medium"
            style={{
              height: "40px",
              color: "#9E9E9E",
              borderRadius: "12px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              marginTop: "4px",
            }}
          >
            Cancel
          </button>
        </DialogContent>
      </Dialog>

      {/* ── Branding Footer ── */}
      <div className="text-center" style={{ paddingBottom: "12px" }}>
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
  );
}
