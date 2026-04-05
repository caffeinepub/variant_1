import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GeneratedVariant } from "@/lib/variantEngine";
import { formatExport } from "@/lib/variantEngine";
import type { Settings } from "@/lib/variantEngine";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Share2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

const OPTION_STYLE = "bg-[#F3F4F6] border-[#D1D5DB] text-foreground";

interface ResultsScreenProps {
  originalQuestion: string;
  variants: GeneratedVariant[];
  settings: Settings;
  onBack: () => void;
}

export function ResultsScreen({
  originalQuestion,
  variants,
  settings,
  onBack,
}: ResultsScreenProps) {
  const [originalExpanded, setOriginalExpanded] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const exportText = formatExport(originalQuestion, variants, settings);

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

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col h-full"
    >
      {/* ── Nav Bar ── */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-9 w-9 rounded-lg hover:bg-secondary"
          data-ocid="results.link"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-bold text-foreground">
          Generated Variants ({variants.length})
        </h2>
      </div>

      {/* ── Original Question Collapsible ── */}
      <button
        type="button"
        onClick={() => setOriginalExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3 mb-4 text-left transition-colors hover:bg-accent"
        data-ocid="results.panel"
        aria-expanded={originalExpanded}
      >
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-0.5">
            Original Question
          </span>
          <AnimatePresence initial={false}>
            {originalExpanded ? (
              <motion.p
                key="expanded"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="text-sm text-foreground font-medium"
              >
                {originalQuestion}
              </motion.p>
            ) : (
              <p className="text-sm text-foreground font-medium truncate">
                {originalQuestion}
              </p>
            )}
          </AnimatePresence>
        </div>
        <div className="ml-3 shrink-0 text-muted-foreground">
          {originalExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* ── Variant Cards ── */}
      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-3 pb-16">
          {variants.map((variant, idx) => (
            <motion.div
              key={variant.questionText}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: idx * 0.06,
                duration: 0.28,
                ease: "easeOut",
              }}
              data-ocid={`results.item.${idx + 1}`}
              className="rounded-2xl border border-border bg-white p-4 shadow-card-sm"
            >
              {/* Variant label */}
              <span className="text-xs font-bold text-primary uppercase tracking-widest mb-2 block">
                Variant #{idx + 1}
              </span>

              {/* Question text */}
              <p className="text-sm font-semibold text-foreground mb-3 leading-relaxed">
                {variant.questionText}
              </p>

              {/* MCQ Options */}
              <div className="flex flex-col gap-2">
                {variant.options.map((option) => (
                  <div
                    key={option.label}
                    className="flex items-center gap-3"
                    data-ocid="results.row"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${OPTION_STYLE}`}
                    >
                      {option.label}
                    </span>
                    <span className="text-sm text-foreground">
                      {option.text}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>

      {/* ── Export Floating Button ── */}
      <div className="absolute bottom-6 right-6 z-10">
        <Button
          onClick={() => setExportOpen(true)}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-card font-semibold px-5 h-11"
          data-ocid="results.open_modal_button"
        >
          <Share2 className="h-4 w-4" />
          Export Results
        </Button>
      </div>

      {/* ── Export Modal ── */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent
          className="max-w-sm rounded-2xl"
          data-ocid="results.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Export Results
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <Button
              variant="outline"
              className="justify-start gap-3 h-12 rounded-xl font-medium"
              onClick={handleCopy}
              data-ocid="results.secondary_button"
            >
              <Copy className="h-4 w-4 text-primary" />
              Copy All Text
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-3 h-12 rounded-xl font-medium"
              onClick={handleDownload}
              data-ocid="results.save_button"
            >
              <Download className="h-4 w-4 text-primary" />
              Download .txt
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 text-muted-foreground"
            onClick={() => setExportOpen(false)}
            data-ocid="results.cancel_button"
          >
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
