import { useActor } from "@/hooks/useActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  FolderOpen,
  LogIn,
  RefreshCw,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Session } from "../backend.d";

export function VariantScreen() {
  const { identity, login } = useInternetIdentity();
  const { actor, isFetching } = useActor();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: sessions,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Session[]>({
    queryKey: ["sessions", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor || !identity) return [];
      return actor.getAllSessions();
    },
    enabled: !!actor && !!identity && !isFetching,
  });

  const isLoggedIn = !!identity;

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
          Saved Variants
        </p>
      </div>

      {!isLoggedIn ? (
        <div
          className="flex flex-col items-center justify-center text-center"
          data-ocid="variant.empty_state"
          style={{ paddingTop: "40px", paddingBottom: "40px", gap: "20px" }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 64, height: 64, background: "#E3F2FD" }}
          >
            <FolderOpen size={28} style={{ color: "#2196F3" }} />
          </div>
          <div>
            <p
              className="font-bold"
              style={{ fontSize: "16px", color: "#212121" }}
            >
              Cloud Variants
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
              Log in to view and sync your saved variants across devices
            </p>
          </div>
          <button
            type="button"
            onClick={login}
            data-ocid="variant.open_modal_button"
            className="font-bold flex items-center"
            style={{
              gap: "8px",
              paddingLeft: "24px",
              paddingRight: "24px",
              height: "48px",
              borderRadius: "24px",
              background: "#2196F3",
              color: "#ffffff",
              fontSize: "14px",
              border: "none",
              boxShadow: "0 2px 8px rgba(33,150,243,0.2)",
              cursor: "pointer",
            }}
          >
            <LogIn size={16} />
            Sign In
          </button>
        </div>
      ) : (
        <>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: "16px" }}
          >
            <p
              className="font-bold"
              style={{ fontSize: "14px", color: "#424242" }}
            >
              {sessions?.length ?? 0} saved session
              {sessions?.length !== 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              data-ocid="variant.refresh_button"
              className="inline-flex items-center font-semibold transition-all"
              style={{
                gap: "6px",
                paddingLeft: "12px",
                paddingRight: "12px",
                height: "32px",
                borderRadius: "16px",
                background: "#ffffff",
                color: "#2196F3",
                border: "1.5px solid #2196F3",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              <RefreshCw
                size={12}
                className={isRefetching ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {(isLoading || isRefetching) && (
            <div
              className="flex flex-col"
              data-ocid="variant.loading_state"
              style={{ gap: "12px" }}
            >
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white animate-pulse"
                  style={{
                    height: 80,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                />
              ))}
            </div>
          )}

          {!isLoading && sessions?.length === 0 && (
            <div
              className="text-center"
              data-ocid="variant.empty_state"
              style={{ paddingTop: "60px", paddingBottom: "60px" }}
            >
              <FolderOpen
                size={40}
                style={{ color: "#BDBDBD", margin: "0 auto 12px" }}
              />
              <p
                className="font-bold"
                style={{ color: "#9E9E9E", fontSize: "15px" }}
              >
                No saved variants yet
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "#BDBDBD",
                  marginTop: "6px",
                }}
              >
                Generate questions to save them here
              </p>
            </div>
          )}

          <div className="flex flex-col" style={{ gap: "12px" }}>
            {sessions?.map((session, idx) => {
              const isExpanded = expandedId === session.id;
              const ts = new Date(
                Number(session.timestamp / BigInt(1_000_000)),
              );
              const dateStr = ts.toLocaleDateString();

              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.2 }}
                  data-ocid={`variant.item.${idx + 1}`}
                  className="rounded-2xl bg-white overflow-hidden"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : session.id)
                    }
                    className="w-full text-left flex items-start justify-between"
                    style={{ padding: "16px", gap: "12px" }}
                  >
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <p
                        className="font-semibold truncate"
                        style={{ fontSize: "13px", color: "#212121" }}
                      >
                        {session.originalQuestion}
                      </p>
                      <div
                        className="flex"
                        style={{ gap: "12px", marginTop: "4px" }}
                      >
                        <span style={{ fontSize: "11px", color: "#9E9E9E" }}>
                          {dateStr}
                        </span>
                        <span
                          className="font-semibold"
                          style={{ fontSize: "11px", color: "#2196F3" }}
                        >
                          {session.variants.length} variant
                          {session.variants.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp
                        size={16}
                        style={{
                          color: "#9E9E9E",
                          marginTop: "2px",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <ChevronDown
                        size={16}
                        style={{
                          color: "#9E9E9E",
                          marginTop: "2px",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div
                          className="flex flex-col"
                          style={{
                            padding: "0 16px 16px",
                            gap: "12px",
                            borderTop: "1px solid #F5F7FA",
                          }}
                        >
                          {session.variants.map((v, vi) => (
                            <div
                              key={`${session.id}-v-${vi}`}
                              style={{ paddingTop: "12px" }}
                            >
                              <span
                                className="font-bold uppercase tracking-widest"
                                style={{ fontSize: "10px", color: "#2196F3" }}
                              >
                                VARIANT #{vi + 1}
                              </span>
                              <p
                                className="font-medium"
                                style={{
                                  fontSize: "13px",
                                  color: "#424242",
                                  marginTop: "4px",
                                }}
                              >
                                {v.questionText}
                              </p>
                              <div
                                className="flex flex-col"
                                style={{ gap: "4px", marginTop: "8px" }}
                              >
                                {["A", "B", "C"].map((label) => {
                                  const text =
                                    label === "A"
                                      ? v.optionA
                                      : label === "B"
                                        ? v.optionB
                                        : v.optionC;
                                  const isCorrect = v.correctOption === label;
                                  return (
                                    <div
                                      key={label}
                                      className="flex items-center"
                                      style={{ gap: "8px" }}
                                    >
                                      <span
                                        className="flex items-center justify-center shrink-0 font-bold"
                                        style={{
                                          width: "24px",
                                          height: "24px",
                                          borderRadius: "50%",
                                          background: isCorrect
                                            ? "#E8F5E9"
                                            : "#F5F7FA",
                                          color: isCorrect
                                            ? "#388E3C"
                                            : "#757575",
                                          border: isCorrect
                                            ? "1px solid #A5D6A7"
                                            : "1px solid #E0E0E0",
                                          fontSize: "10px",
                                        }}
                                      >
                                        {label}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "12px",
                                          color: isCorrect
                                            ? "#388E3C"
                                            : "#616161",
                                          fontWeight: isCorrect ? 600 : 400,
                                        }}
                                      >
                                        {text}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
