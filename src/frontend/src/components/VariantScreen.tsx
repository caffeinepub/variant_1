import type { MCQOption, VariantQuestion } from "@/lib/variantEngine";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

interface SavedQuestion {
  id: string;
  questionText: string;
  options: MCQOption[];
  correctLabel: string;
  chapterType: string;
  subTopic?: string;
  savedAt: number;
  solution?: VariantQuestion["solution"];
}

interface VariantScreenProps {
  onNavigateToGenerate: (questionText: string) => void;
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

type SubTopicGroup = Record<string, SavedQuestion[]>;
type ChapterGroup = Record<string, SubTopicGroup>;

function groupByChapterAndSubTopic(questions: SavedQuestion[]): ChapterGroup {
  const groups: ChapterGroup = {};
  for (const q of questions) {
    const chapter = q.chapterType || "General Math";
    const subTopic = q.subTopic || "General";
    if (!groups[chapter]) groups[chapter] = {};
    if (!groups[chapter][subTopic]) groups[chapter][subTopic] = [];
    groups[chapter][subTopic].push(q);
  }
  return groups;
}

export function VariantScreen({ onNavigateToGenerate }: VariantScreenProps) {
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(),
  );
  const [expandedSubTopics, setExpandedSubTopics] = useState<Set<string>>(
    new Set(),
  );

  const loadFromStorage = useCallback(() => {
    setSavedQuestions(getSavedQuestions());
  }, []);

  useEffect(() => {
    loadFromStorage();
    const onFocus = () => loadFromStorage();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadFromStorage]);

  function toggleChapter(chapter: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapter)) next.delete(chapter);
      else next.add(chapter);
      return next;
    });
  }

  function toggleSubTopic(key: string) {
    setExpandedSubTopics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleClearAll() {
    localStorage.removeItem(SAVED_KEY);
    setSavedQuestions([]);
    setExpandedChapters(new Set());
    setExpandedSubTopics(new Set());
  }

  const grouped = groupByChapterAndSubTopic(savedQuestions);
  const chapterNames = Object.keys(grouped).sort();
  const isEmpty = savedQuestions.length === 0;

  return (
    <div
      className="px-4 pt-8"
      style={{ minHeight: "calc(100vh - 70px)", paddingBottom: "24px" }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-start justify-between"
        style={{ marginBottom: "24px" }}
      >
        <div>
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
            Saved Questions
          </p>
        </div>

        {!isEmpty && (
          <button
            type="button"
            onClick={handleClearAll}
            data-ocid="variant.delete_button"
            className="inline-flex items-center font-semibold transition-all active:scale-95"
            style={{
              gap: "6px",
              paddingLeft: "14px",
              paddingRight: "14px",
              height: "36px",
              borderRadius: "50px",
              background: "#fff",
              color: "#DC3545",
              border: "1.5px solid #FFCDD2",
              fontSize: "12px",
              cursor: "pointer",
              marginTop: "10px",
              boxShadow: "0 2px 8px rgba(220,53,69,0.10)",
              fontFamily: "'Figtree', sans-serif",
            }}
          >
            <Trash2 size={12} />
            Clear All
          </button>
        )}
      </div>

      {/* ── Empty State ── */}
      {isEmpty && (
        <div
          className="flex flex-col items-center justify-center text-center"
          data-ocid="variant.empty_state"
          style={{ paddingTop: "60px", paddingBottom: "60px", gap: "20px" }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              background: "linear-gradient(135deg, #E3F2FD, #BBDEFB)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 20px rgba(33,150,243,0.18)",
            }}
          >
            <FolderOpen size={32} style={{ color: "#2196F3" }} />
          </div>
          <div>
            <p
              style={{
                fontFamily: "'Figtree', sans-serif",
                fontSize: "18px",
                fontWeight: 700,
                color: "#263238",
              }}
            >
              No saved questions yet
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "#90A4AE",
                maxWidth: 260,
                margin: "8px auto 0",
                lineHeight: 1.6,
              }}
            >
              Bookmark questions from the Generate tab to save them here.
            </p>
          </div>
        </div>
      )}

      {/* ── Chapter Folders (two-tier) ── */}
      {!isEmpty && (
        <div className="flex flex-col" style={{ gap: "12px" }}>
          {chapterNames.map((chapter, ci) => {
            const subTopicGroups = grouped[chapter];
            const subTopicNames = Object.keys(subTopicGroups).sort();
            const totalQ = Object.values(subTopicGroups).reduce(
              (s, arr) => s + arr.length,
              0,
            );
            const isChapterOpen = expandedChapters.has(chapter);

            return (
              <motion.div
                key={chapter}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: ci * 0.05, duration: 0.22 }}
                data-ocid={`variant.item.${ci + 1}`}
                style={{
                  borderRadius: "24px",
                  background: "#ffffff",
                  overflow: "hidden",
                  boxShadow:
                    "0 6px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)",
                  borderLeft: "4px solid #2196F3",
                }}
              >
                {/* Chapter header */}
                <button
                  type="button"
                  onClick={() => toggleChapter(chapter)}
                  data-ocid={`variant.panel.${ci + 1}`}
                  className="w-full flex items-center text-left"
                  style={{ padding: "16px 16px 16px 14px", gap: "12px" }}
                >
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "12px",
                      background: isChapterOpen
                        ? "linear-gradient(135deg, #2196F3, #1565C0)"
                        : "#E3F2FD",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: isChapterOpen
                        ? "0 3px 10px rgba(33,150,243,0.30)"
                        : "none",
                      transition: "all 0.22s ease",
                    }}
                  >
                    {isChapterOpen ? (
                      <FolderOpen size={18} style={{ color: "#ffffff" }} />
                    ) : (
                      <Folder size={18} style={{ color: "#2196F3" }} />
                    )}
                  </div>

                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: "'Figtree', sans-serif",
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#212121",
                      }}
                      className="truncate"
                    >
                      {chapter}
                    </p>
                    <div
                      className="flex items-center"
                      style={{ gap: "6px", marginTop: "2px" }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#2196F3",
                        }}
                      >
                        {totalQ} question{totalQ !== 1 ? "s" : ""}
                      </span>
                      <span style={{ fontSize: "10px", color: "#B0BEC5" }}>
                        ·
                      </span>
                      <span style={{ fontSize: "10px", color: "#90A4AE" }}>
                        {subTopicNames.length} topic
                        {subTopicNames.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <motion.div
                    animate={{ rotate: isChapterOpen ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight
                      size={18}
                      style={{ color: "#90A4AE", flexShrink: 0 }}
                    />
                  </motion.div>
                </button>

                {/* Sub-topic groups */}
                <AnimatePresence>
                  {isChapterOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div
                        style={{
                          borderTop: "1px solid #F0F4F8",
                          padding: "12px 14px 14px",
                        }}
                      >
                        {subTopicNames.map((subTopic, si) => {
                          const questions = subTopicGroups[subTopic];
                          const stKey = `${chapter}__${subTopic}`;
                          const isSubOpen = expandedSubTopics.has(stKey);

                          return (
                            <div
                              key={subTopic}
                              style={{
                                marginBottom:
                                  si < subTopicNames.length - 1 ? "8px" : "0",
                                borderRadius: "16px",
                                background: "#F8FAFC",
                                overflow: "hidden",
                                borderLeft: "3px solid #90CAF9",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                              }}
                            >
                              {/* SubTopic header */}
                              <button
                                type="button"
                                onClick={() => toggleSubTopic(stKey)}
                                className="w-full flex items-center text-left"
                                style={{ padding: "10px 12px", gap: "10px" }}
                              >
                                <div
                                  style={{
                                    width: "26px",
                                    height: "26px",
                                    borderRadius: "8px",
                                    background: isSubOpen
                                      ? "#90CAF9"
                                      : "#E3F2FD",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    transition: "all 0.2s ease",
                                  }}
                                >
                                  {isSubOpen ? (
                                    <FolderOpen
                                      size={13}
                                      style={{ color: "#1565C0" }}
                                    />
                                  ) : (
                                    <Folder
                                      size={13}
                                      style={{ color: "#2196F3" }}
                                    />
                                  )}
                                </div>
                                <div className="flex-1" style={{ minWidth: 0 }}>
                                  <p
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "#37474F",
                                    }}
                                    className="truncate"
                                  >
                                    {subTopic}
                                  </p>
                                </div>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    color: "#ffffff",
                                    background: "#90CAF9",
                                    borderRadius: "50px",
                                    padding: "1px 8px",
                                    marginRight: "6px",
                                  }}
                                >
                                  {questions.length}
                                </span>
                                <motion.div
                                  animate={{ rotate: isSubOpen ? 180 : 0 }}
                                  transition={{ duration: 0.18 }}
                                >
                                  <ChevronDown
                                    size={14}
                                    style={{ color: "#90A4AE", flexShrink: 0 }}
                                  />
                                </motion.div>
                              </button>

                              {/* Question cards inside sub-topic */}
                              <AnimatePresence>
                                {isSubOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="overflow-hidden"
                                  >
                                    <div style={{ padding: "0 10px 10px" }}>
                                      {questions.map((q, qi) => (
                                        <button
                                          key={q.id}
                                          type="button"
                                          onClick={() =>
                                            onNavigateToGenerate(q.questionText)
                                          }
                                          data-ocid={`variant.row.${ci + 1}.${si + 1}.${qi + 1}`}
                                          className="w-full text-left transition-all active:scale-[0.98]"
                                          style={{
                                            borderRadius: "14px",
                                            background: "#ffffff",
                                            padding: "12px",
                                            marginBottom:
                                              qi < questions.length - 1
                                                ? "8px"
                                                : "0",
                                            boxShadow:
                                              "0 2px 8px rgba(0,0,0,0.06)",
                                            border: "none",
                                            cursor: "pointer",
                                            display: "block",
                                          }}
                                        >
                                          {/* Question text + navigate hint */}
                                          <div
                                            className="flex items-start justify-between"
                                            style={{
                                              gap: "8px",
                                              marginBottom: "10px",
                                            }}
                                          >
                                            <p
                                              style={{
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                color: "#263238",
                                                lineHeight: 1.5,
                                                flex: 1,
                                              }}
                                            >
                                              {q.questionText}
                                            </p>
                                            <ChevronRight
                                              size={14}
                                              style={{
                                                color: "#90A4AE",
                                                flexShrink: 0,
                                                marginTop: "2px",
                                              }}
                                            />
                                          </div>
                                          {/* Tap hint label */}
                                          <p
                                            style={{
                                              fontSize: "10px",
                                              color: "#90A4AE",
                                              marginBottom: "10px",
                                              fontWeight: 500,
                                            }}
                                          >
                                            Tap to generate variant
                                          </p>
                                          {/* Options */}
                                          <div
                                            className="flex flex-col"
                                            style={{ gap: "5px" }}
                                          >
                                            {q.options.map(
                                              (option: MCQOption) => {
                                                const isCorrect =
                                                  option.label ===
                                                  q.correctLabel;
                                                return (
                                                  <div
                                                    key={option.label}
                                                    className="flex items-center"
                                                    style={{
                                                      height: "34px",
                                                      paddingLeft: "10px",
                                                      paddingRight: "10px",
                                                      borderRadius: "10px",
                                                      border: isCorrect
                                                        ? "1.5px solid #28A745"
                                                        : "1.5px solid #E0E0E0",
                                                      background: isCorrect
                                                        ? "#E8F5E9"
                                                        : "#F8F9FA",
                                                      gap: "8px",
                                                    }}
                                                  >
                                                    <span
                                                      style={{
                                                        fontSize: "11px",
                                                        fontWeight: 700,
                                                        color: isCorrect
                                                          ? "#2E7D32"
                                                          : "#757575",
                                                        minWidth: "16px",
                                                      }}
                                                    >
                                                      {option.label}
                                                    </span>
                                                    <span
                                                      style={{
                                                        fontSize: "11px",
                                                        color: isCorrect
                                                          ? "#2E7D32"
                                                          : "#424242",
                                                        fontWeight: isCorrect
                                                          ? 600
                                                          : 400,
                                                        flex: 1,
                                                      }}
                                                    >
                                                      {option.text}
                                                    </span>
                                                  </div>
                                                );
                                              },
                                            )}
                                          </div>
                                          {/* Mini solution slab */}
                                          {q.solution && (
                                            <div
                                              style={{
                                                marginTop: "8px",
                                                padding: "8px 10px",
                                                borderRadius: "10px",
                                                background:
                                                  "linear-gradient(135deg, #E3F2FD, #F0F4FF)",
                                                border: "1px solid #BBDEFB",
                                                fontSize: "11px",
                                                color: "#37474F",
                                                lineHeight: 1.6,
                                              }}
                                            >
                                              <span
                                                style={{
                                                  fontWeight: 700,
                                                  color: "#1565C0",
                                                  fontSize: "10px",
                                                }}
                                              >
                                                SOLUTION:{" "}
                                              </span>
                                              {q.solution.phase3}
                                            </div>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
