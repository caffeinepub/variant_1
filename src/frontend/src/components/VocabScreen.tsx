import type { SavedWord, VocabQuestion } from "@/lib/vocabEngine";
import {
  deleteSavedWord,
  generateVocabQuestion,
  getDifficultyLabel,
  getSavedWords,
  saveWord,
} from "@/lib/vocabEngine";
import { BookOpen, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/* ── Physical 3D Toggle (local copy) ──────────────────── */
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

/* ── Soft Slider (local copy) ────────────────── */
function SoftSlider({
  value,
  onChange,
}: { value: number; onChange: (v: number) => void }) {
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
      onChange={(e) => {
        const v = Number(e.target.value);
        onChange(v);
        updateProgress(v);
      }}
      data-ocid="vocab.difficulty_slider"
      aria-label="Difficulty level"
    />
  );
}

/* ── Saved Words Section ──────────────────────────────── */
function SavedWordsSection({
  words,
  onDelete,
}: {
  words: SavedWord[];
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const tiers: Array<{
    key: string;
    label: "Beginner" | "Intermediate" | "Advanced" | "Professional";
    range: [number, number];
  }> = [
    { key: "beginner", label: "Beginner", range: [1, 3] },
    { key: "intermediate", label: "Intermediate", range: [4, 6] },
    { key: "advanced", label: "Advanced", range: [7, 8] },
    { key: "professional", label: "Professional", range: [9, 10] },
  ];

  const tierColors: Record<string, string> = {
    beginner: "#4CAF50",
    intermediate: "#2196F3",
    advanced: "#FF9800",
    professional: "#9C27B0",
  };

  return (
    <div
      style={{
        borderRadius: "24px",
        background: "#ffffff",
        boxShadow: "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-ocid="vocab.saved_words.toggle"
        className="w-full flex items-center justify-between"
        style={{
          padding: "18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <div className="flex items-center" style={{ gap: "10px" }}>
          <BookOpen size={18} style={{ color: "#1565C0" }} />
          <span
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#212121",
              fontFamily: "'Figtree', sans-serif",
            }}
          >
            Saved Words ({words.length})
          </span>
        </div>
        {open ? (
          <ChevronUp size={18} style={{ color: "#90A4AE" }} />
        ) : (
          <ChevronDown size={18} style={{ color: "#90A4AE" }} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {words.length === 0 ? (
              <div
                style={{
                  padding: "24px 18px",
                  textAlign: "center",
                  color: "#90A4AE",
                  fontSize: "13px",
                }}
                data-ocid="vocab.saved_words.empty_state"
              >
                No words saved yet. Tap the heart icon after a question.
              </div>
            ) : (
              <div style={{ paddingBottom: "18px" }}>
                {tiers.map(({ key, label, range }) => {
                  const tierWords = words.filter(
                    (w) => w.difficulty >= range[0] && w.difficulty <= range[1],
                  );
                  if (tierWords.length === 0) return null;
                  return (
                    <div key={key} style={{ marginBottom: "16px" }}>
                      <div
                        style={{
                          paddingLeft: "18px",
                          paddingRight: "18px",
                          marginBottom: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            color: tierColors[key],
                            textTransform: "uppercase",
                            letterSpacing: "0.10em",
                          }}
                        >
                          {label}
                        </span>
                      </div>
                      <div className="flex flex-col" style={{ gap: "8px" }}>
                        {tierWords.map((w, i) => (
                          <div
                            key={w.id}
                            data-ocid={`vocab.saved_word.item.${i + 1}`}
                            style={{
                              marginLeft: "18px",
                              marginRight: "18px",
                              background: "#F8FAFC",
                              borderRadius: "16px",
                              padding: "12px 14px",
                              border: "1px solid #E3EAF3",
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div style={{ flex: 1, marginRight: "10px" }}>
                                <div
                                  className="flex items-center"
                                  style={{ gap: "8px", marginBottom: "4px" }}
                                >
                                  <span
                                    style={{
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      color: "#212121",
                                      fontFamily: "'Figtree', sans-serif",
                                    }}
                                  >
                                    {w.word}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "9px",
                                      fontWeight: 700,
                                      color:
                                        w.type === "synonym"
                                          ? "#2196F3"
                                          : "#E91E63",
                                      background:
                                        w.type === "synonym"
                                          ? "#E3F2FD"
                                          : "#FCE4EC",
                                      borderRadius: "50px",
                                      padding: "2px 8px",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                    }}
                                  >
                                    {w.type}
                                  </span>
                                </div>
                                <p
                                  style={{
                                    fontSize: "12px",
                                    color: "#546E7A",
                                    marginBottom: "4px",
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {w.meaning}
                                </p>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    color: "#90A4AE",
                                    fontStyle: "italic",
                                  }}
                                >
                                  {w.root}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => onDelete(w.id)}
                                data-ocid={`vocab.saved_word.delete_button.${i + 1}`}
                                aria-label={`Delete ${w.word}`}
                                style={{
                                  background: "#FFEBEE",
                                  border: "none",
                                  cursor: "pointer",
                                  borderRadius: "50%",
                                  width: "28px",
                                  height: "28px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <Trash2
                                  size={12}
                                  style={{ color: "#DC3545" }}
                                />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Vocab Screen ──────────────────────────────────── */
export function VocabScreen() {
  const [difficulty, setDifficulty] = useState(5);
  const [type, setType] = useState<"synonym" | "antonym">("synonym");
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState<VocabQuestion | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<
    "A" | "B" | "C" | "D" | null
  >(null);
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [isSaved, setIsSaved] = useState(false);

  // Load saved words on mount
  useEffect(() => {
    setSavedWords(getSavedWords());
  }, []);

  const answered = selectedLabel !== null;
  const diffLabel = getDifficultyLabel(difficulty);

  async function handleGenerate() {
    setLoading(true);
    setQuestion(null);
    setSelectedLabel(null);
    setIsSaved(false);
    try {
      const q = await generateVocabQuestion(difficulty, type);
      setQuestion(q);
    } catch {
      toast.error("Failed to generate question. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleOptionSelect(label: "A" | "B" | "C" | "D") {
    if (answered) return;
    setSelectedLabel(label);
    const opt = question?.options.find((o) => o.label === label);
    if (!opt) return;
    if (opt.isCorrect) {
      toast.success("Correct! 🎉");
    } else {
      toast.error(
        `Incorrect. The answer is ${question?.correctLabel}) ${question?.correctAnswer}`,
      );
    }
  }

  function handleSave() {
    if (!question || isSaved) return;
    const w: SavedWord = {
      id: `${Date.now()}_${question.word}`,
      word: question.word,
      meaning: question.meaning,
      root: question.root,
      type: question.type,
      difficulty: question.difficulty,
      savedAt: Date.now(),
    };
    saveWord(w);
    setSavedWords(getSavedWords());
    setIsSaved(true);
    toast.success(`"${question.word}" saved!`);
  }

  function handleDelete(id: string) {
    deleteSavedWord(id);
    setSavedWords(getSavedWords());
    toast.success("Word removed.");
  }

  const diffLabelColors: Record<string, string> = {
    Beginner: "#4CAF50",
    Intermediate: "#2196F3",
    Advanced: "#FF9800",
    Professional: "#9C27B0",
  };

  const diffLabelBg: Record<string, string> = {
    Beginner: "#E8F5E9",
    Intermediate: "#E3F2FD",
    Advanced: "#FFF3E0",
    Professional: "#F3E5F5",
  };

  const getOptionStyle = (opt: {
    isCorrect: boolean;
    label: string;
  }): React.CSSProperties => {
    if (!answered) {
      return {
        background: "#ffffff",
        border: "1.5px solid #E0E0E0",
        color: "#424242",
      };
    }
    if (opt.isCorrect) {
      return {
        background: "#E8F5E9",
        border: "1.5px solid #28A745",
        color: "#2E7D32",
      };
    }
    if (opt.label === selectedLabel) {
      return {
        background: "#FFEBEE",
        border: "1.5px solid #DC3545",
        color: "#C62828",
      };
    }
    return {
      background: "#F8F9FA",
      border: "1.5px solid #E0E0E0",
      color: "#9E9E9E",
    };
  };

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
          Vocabulary Trainer
        </p>
      </div>

      {/* ── Controls Card ── */}
      <div
        style={{
          borderRadius: "24px",
          background: "#ffffff",
          boxShadow: "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
          padding: "18px",
        }}
      >
        {/* Synonym / Antonym toggle row */}
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: "18px" }}
        >
          <div>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#90A4AE",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: "4px",
                fontFamily: "'Figtree', sans-serif",
              }}
            >
              Question Type
            </p>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#212121",
                fontFamily: "'Figtree', sans-serif",
              }}
            >
              {type === "synonym" ? "Find Synonym" : "Find Antonym"}
            </p>
          </div>
          <div className="flex items-center" style={{ gap: "8px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: type === "synonym" ? "#1565C0" : "#90A4AE",
              }}
            >
              Syn
            </span>
            <PhysicalToggle
              checked={type === "antonym"}
              onChange={(v) => setType(v ? "antonym" : "synonym")}
            />
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: type === "antonym" ? "#E91E63" : "#90A4AE",
              }}
            >
              Ant
            </span>
          </div>
        </div>

        {/* Difficulty slider */}
        <div>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: "10px" }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#90A4AE",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                fontFamily: "'Figtree', sans-serif",
              }}
            >
              Difficulty
            </p>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: diffLabelColors[diffLabel],
                background: diffLabelBg[diffLabel],
                borderRadius: "50px",
                padding: "3px 10px",
              }}
            >
              {diffLabel} ({difficulty}/10)
            </span>
          </div>
          <SoftSlider value={difficulty} onChange={setDifficulty} />
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
              const isActive = val === difficulty;
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
      </div>

      {/* ── Generate Button ── */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        data-ocid="vocab.primary_button"
        className="w-full font-bold transition-all active:scale-[0.98]"
        style={{
          height: "54px",
          borderRadius: "50px",
          background: loading
            ? "#B0BEC5"
            : "linear-gradient(135deg, #2196F3, #1565C0)",
          color: "#ffffff",
          fontSize: "15px",
          letterSpacing: "1.5px",
          border: "none",
          cursor: loading ? "default" : "pointer",
          boxShadow: loading
            ? "none"
            : "0 6px 20px rgba(33,150,243,0.35), 0 2px 6px rgba(0,0,0,0.10)",
          fontFamily: "'Figtree', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        {loading ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                border: "2.5px solid rgba(255,255,255,0.4)",
                borderTopColor: "#fff",
                animation: "spin 0.7s linear infinite",
              }}
            />
            Generating...
          </>
        ) : (
          <>
            <BookOpen size={18} />
            GENERATE WORD
          </>
        )}
      </button>

      {/* ── Loading state ── */}
      {loading && (
        <div
          style={{
            textAlign: "center",
            color: "#90A4AE",
            fontSize: "13px",
            paddingTop: "8px",
          }}
          data-ocid="vocab.loading_state"
        >
          Finding the perfect word for difficulty {difficulty}...
        </div>
      )}

      {/* ── Word Card ── */}
      <AnimatePresence mode="wait">
        {question && !loading && (
          <motion.div
            key={question.word + question.type}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            style={{
              borderRadius: "24px",
              background: "#ffffff",
              padding: "18px",
              boxShadow:
                "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
            }}
            data-ocid="vocab.card"
          >
            {/* Word header row */}
            <div
              className="flex items-start justify-between"
              style={{ marginBottom: "12px" }}
            >
              <div style={{ flex: 1 }}>
                {/* Type badge */}
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: type === "synonym" ? "#2196F3" : "#E91E63",
                    background: type === "synonym" ? "#E3F2FD" : "#FCE4EC",
                    borderRadius: "50px",
                    padding: "2px 10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    display: "inline-block",
                    marginBottom: "8px",
                  }}
                >
                  {type === "synonym" ? "Find Synonym" : "Find Antonym"}
                </span>

                {/* Word */}
                <h2
                  style={{
                    fontFamily: "'Figtree', sans-serif",
                    fontWeight: 800,
                    fontSize: "28px",
                    color: "#0D47A1",
                    lineHeight: 1.1,
                    marginBottom: "6px",
                    textTransform: "capitalize",
                  }}
                >
                  {question.word}
                </h2>

                {/* Meaning */}
                <p
                  style={{
                    fontSize: "13px",
                    color: "#546E7A",
                    lineHeight: 1.5,
                    marginBottom: "8px",
                  }}
                >
                  {question.meaning}
                </p>

                {/* Etymology root pill */}
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: "#78909C",
                    background: "#F0F4F8",
                    borderRadius: "50px",
                    padding: "3px 12px",
                    fontStyle: "italic",
                    display: "inline-block",
                  }}
                >
                  📜 {question.root}
                </span>
              </div>

              {/* Save/heart button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaved}
                data-ocid="vocab.save_button"
                aria-label={isSaved ? "Saved" : "Save word"}
                style={{
                  background: isSaved ? "#FCE4EC" : "#F0F4F8",
                  border: "none",
                  cursor: isSaved ? "default" : "pointer",
                  borderRadius: "50%",
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  flexShrink: 0,
                  fontSize: "18px",
                  marginLeft: "12px",
                  marginTop: "4px",
                }}
              >
                {isSaved ? "❤️" : "🤍"}
              </button>
            </div>

            {/* Question prompt */}
            <p
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#90A4AE",
                textTransform: "uppercase",
                letterSpacing: "0.10em",
                marginBottom: "10px",
                fontFamily: "'Figtree', sans-serif",
              }}
            >
              {type === "synonym"
                ? `Choose the best synonym for "${question.word}":`
                : `Choose the best antonym for "${question.word}":`}
            </p>

            {/* Options */}
            <div className="flex flex-col" style={{ gap: "8px" }}>
              {question.options.map((opt) => {
                const style = getOptionStyle(opt);
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => handleOptionSelect(opt.label)}
                    disabled={answered}
                    data-ocid={`vocab.option.${opt.label}`}
                    className="w-full flex items-center text-left transition-all"
                    style={{
                      height: "48px",
                      paddingLeft: "14px",
                      paddingRight: "14px",
                      borderRadius: "16px",
                      cursor: answered ? "default" : "pointer",
                      gap: "10px",
                      boxShadow: answered
                        ? "none"
                        : "0 2px 8px rgba(0,0,0,0.06)",
                      ...style,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        minWidth: "20px",
                        color: style.color as string,
                      }}
                    >
                      {opt.label}
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        flex: 1,
                        color: style.color as string,
                      }}
                    >
                      {opt.text}
                    </span>
                    {answered && opt.isCorrect && (
                      <span style={{ fontSize: "14px", color: "#28A745" }}>
                        ✓
                      </span>
                    )}
                    {answered &&
                      opt.label === selectedLabel &&
                      !opt.isCorrect && (
                        <span style={{ fontSize: "14px", color: "#DC3545" }}>
                          ✗
                        </span>
                      )}
                  </button>
                );
              })}
            </div>

            {/* Post-answer: show feedback + Next button */}
            <AnimatePresence>
              {answered && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ marginTop: "16px" }}
                >
                  {/* Correct answer callout */}
                  <div
                    style={{
                      background: "#E8F5E9",
                      borderRadius: "16px",
                      padding: "12px 14px",
                      marginBottom: "12px",
                    }}
                    data-ocid="vocab.success_state"
                  >
                    <p
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#2E7D32",
                      }}
                    >
                      ✓ Correct {type}:{" "}
                      <span style={{ fontWeight: 800 }}>
                        {question.correctAnswer}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerate}
                    data-ocid="vocab.secondary_button"
                    className="w-full font-bold transition-all active:scale-[0.98]"
                    style={{
                      height: "48px",
                      borderRadius: "50px",
                      background: "#F0F4F8",
                      color: "#1565C0",
                      fontSize: "14px",
                      border: "1.5px solid #D0D8E4",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      fontFamily: "'Figtree', sans-serif",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    Next Word →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Saved Words ── */}
      <SavedWordsSection words={savedWords} onDelete={handleDelete} />

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
