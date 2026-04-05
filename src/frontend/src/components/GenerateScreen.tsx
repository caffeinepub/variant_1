import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { GeneratedVariant, Settings } from "@/lib/variantEngine";
import { formatExport } from "@/lib/variantEngine";
import { ClipboardPaste, Copy, Download, Share2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

interface GenerateScreenProps {
  onGenerate: (question: string, settings: Settings) => void;
  currentQuestion: string;
  variants: GeneratedVariant[];
}

export function GenerateScreen({
  onGenerate,
  currentQuestion,
  variants,
}: GenerateScreenProps) {
  const [question, setQuestion] = useState(
    "If a car travels at 60 km/h, how long does it take to travel 120 km?",
  );
  const [integerOnly, setIntegerOnly] = useState(false);
  const [decimalPrecision, setDecimalPrecision] = useState(2);
  const [fractionMode, setFractionMode] = useState(false);
  const [quantity, setQuantity] = useState<3 | 4 | 5>(3);
  const [exportOpen, setExportOpen] = useState(false);

  const decimalsDisabled = integerOnly;
  const fractionDisabled = integerOnly;

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setQuestion(text);
    } catch {
      // Clipboard read failed — silent
    }
  }

  function handleGenerate() {
    onGenerate(question.trim(), {
      integerOnly,
      decimalPrecision,
      fractionMode,
      quantity,
    });
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

  return (
    <div
      className="flex flex-col px-4 pt-8"
      style={{ backgroundColor: "transparent", gap: "20px" }}
    >
      {/* ── Header ── */}
      <div className="text-center" style={{ marginBottom: "0px" }}>
        <h1
          className="font-extrabold tracking-tight leading-none"
          style={{
            fontSize: "32px",
            color: "#2196F3",
            letterSpacing: "-0.5px",
          }}
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
          Question Generator
        </p>
      </div>

      {/* ── Input Area ── */}
      <div className="flex flex-col" style={{ gap: "12px" }}>
        {/* Paste button: top-left, 40px height */}
        <button
          type="button"
          onClick={handlePaste}
          data-ocid="input.paste_button"
          className="inline-flex items-center gap-1.5 self-start font-semibold transition-colors"
          style={{
            height: "40px",
            paddingLeft: "12px",
            paddingRight: "12px",
            borderRadius: "12px",
            border: "1.5px solid #2196F3",
            color: "#2196F3",
            background: "transparent",
            fontSize: "13px",
          }}
        >
          <ClipboardPaste size={14} />
          Paste Question
        </button>

        {/* Textarea: dashed border, 16px radius */}
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Paste your math question here..."
          data-ocid="input.textarea"
          className="w-full resize-none outline-none focus:ring-2 focus:ring-blue-300"
          style={{
            minHeight: "120px",
            border: "1px dashed #CCCCCC",
            borderRadius: "16px",
            padding: "16px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#212121",
            backgroundColor: "#ffffff",
            lineHeight: "1.5",
            verticalAlign: "top",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* ── Output Format Section ── */}
      <div className="flex flex-col" style={{ gap: "12px" }}>
        <p className="font-bold" style={{ fontSize: "14px", color: "#424242" }}>
          Output Format
        </p>

        {/* Integer Only row */}
        <div className="flex items-center justify-between">
          <Label
            htmlFor="integer-only-switch"
            style={{
              fontSize: "14px",
              color: "#424242",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Integer Only
          </Label>
          <Switch
            id="integer-only-switch"
            checked={integerOnly}
            onCheckedChange={setIntegerOnly}
            data-ocid="settings.integer_only.toggle"
            aria-label="Integer Only"
            style={{
              backgroundColor: integerOnly ? "#2196F3" : undefined,
            }}
          />
        </div>

        {/* Decimal Precision */}
        <div
          className="flex flex-col"
          style={{
            gap: "8px",
            opacity: decimalsDisabled ? 0.4 : 1,
            pointerEvents: decimalsDisabled ? "none" : "auto",
            transition: "opacity 0.2s",
          }}
        >
          {/* Row 1: label + current value */}
          <div className="flex items-center justify-between">
            <Label
              htmlFor="decimal-slider"
              style={{ fontSize: "14px", color: "#424242", fontWeight: 600 }}
            >
              Decimal Precision
            </Label>
            <span
              className="font-bold"
              style={{ fontSize: "12px", color: "#2196F3" }}
            >
              {decimalPrecision} decimal{decimalPrecision !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Row 2: slider */}
          <Slider
            id="decimal-slider"
            min={1}
            max={10}
            step={1}
            value={[decimalPrecision]}
            onValueChange={([v]) => setDecimalPrecision(v)}
            disabled={decimalsDisabled}
            className="w-full"
            data-ocid="settings.decimal_slider"
            aria-label="Decimal precision"
          />

          {/* Row 3: ruler ticks */}
          <div
            className="flex justify-between"
            style={{ paddingLeft: "2px", paddingRight: "2px" }}
          >
            {Array.from({ length: 10 }, (_, i) => {
              const val = i + 1;
              const isActive = val === decimalPrecision;
              return (
                <div
                  key={`tick-${val}`}
                  className="flex flex-col items-center"
                  style={{ width: "10%" }}
                >
                  <div
                    style={{
                      width: "1.5px",
                      height: i === 0 || i === 4 || i === 9 ? "9px" : "5px",
                      backgroundColor: isActive ? "#2196F3" : "#CCCCCC",
                      marginBottom: "3px",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? "#2196F3" : "#BDBDBD",
                      lineHeight: 1,
                    }}
                  >
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fraction Mode row */}
        <div
          className="flex items-center justify-between"
          style={{
            opacity: fractionDisabled ? 0.4 : 1,
            pointerEvents: fractionDisabled ? "none" : "auto",
            transition: "opacity 0.2s",
          }}
        >
          <Label
            htmlFor="fraction-mode-switch"
            style={{
              fontSize: "14px",
              color: "#424242",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Fraction Mode
          </Label>
          <Switch
            id="fraction-mode-switch"
            checked={fractionMode && !fractionDisabled}
            onCheckedChange={setFractionMode}
            disabled={fractionDisabled}
            data-ocid="settings.fraction_mode.toggle"
            aria-label="Fraction Mode"
            style={{
              backgroundColor:
                fractionMode && !fractionDisabled ? "#2196F3" : undefined,
            }}
          />
        </div>
      </div>

      {/* ── Quantity Bubbles ── */}
      <div>
        <p
          className="font-bold"
          style={{ fontSize: "14px", color: "#424242", marginBottom: "12px" }}
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
              className="flex items-center justify-center font-bold transition-all"
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: quantity === q ? "#2196F3" : "#E0E0E0",
                color: quantity === q ? "#ffffff" : "#757575",
                fontSize: "15px",
                border: "none",
                cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── Generate Variants Button ── */}
      <button
        type="button"
        onClick={handleGenerate}
        data-ocid="input.primary_button"
        className="w-full font-bold uppercase transition-all active:scale-[0.98]"
        style={{
          height: "54px",
          borderRadius: "27px",
          background: "#2196F3",
          color: "#ffffff",
          fontSize: "15px",
          letterSpacing: "1.5px",
          border: "none",
          boxShadow: "0 2px 8px rgba(33,150,243,0.2)",
          cursor: "pointer",
        }}
      >
        GENERATE VARIANTS
      </button>

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
            {/* Section header + export */}
            <div className="flex items-center justify-between">
              <p
                className="font-bold"
                style={{ fontSize: "14px", color: "#424242" }}
              >
                Generated Variants ({variants.length})
              </p>
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                data-ocid="results.open_modal_button"
                className="inline-flex items-center font-semibold"
                style={{
                  gap: "6px",
                  paddingLeft: "12px",
                  paddingRight: "12px",
                  height: "32px",
                  borderRadius: "16px",
                  background: "#2196F3",
                  color: "#ffffff",
                  fontSize: "12px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Share2 size={12} />
                Export
              </button>
            </div>

            {/* Variant cards */}
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
                  style={{
                    fontSize: "14px",
                    color: "#212121",
                    marginBottom: "12px",
                  }}
                >
                  {variant.questionText}
                </p>
                <div className="flex flex-col" style={{ gap: "8px" }}>
                  {variant.options.map((option) => (
                    <div
                      key={option.label}
                      className="flex items-center"
                      data-ocid="results.row"
                      style={{ gap: "10px" }}
                    >
                      <span
                        className="flex items-center justify-center shrink-0 font-bold"
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background: "#F5F7FA",
                          border: "1px solid #E0E0E0",
                          color: "#616161",
                          fontSize: "12px",
                        }}
                      >
                        {option.label}
                      </span>
                      <span style={{ fontSize: "13px", color: "#424242" }}>
                        {option.text}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Export Dialog ── */}
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
          <div
            className="flex flex-col"
            style={{ gap: "10px", paddingTop: "4px" }}
          >
            <button
              type="button"
              onClick={handleCopy}
              data-ocid="results.secondary_button"
              className="flex items-center w-full font-medium transition-colors hover:bg-gray-50"
              style={{
                gap: "12px",
                height: "48px",
                paddingLeft: "16px",
                paddingRight: "16px",
                borderRadius: "12px",
                border: "1.5px solid #E0E0E0",
                color: "#424242",
                background: "#fff",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              <Copy size={16} style={{ color: "#2196F3", flexShrink: 0 }} />
              Copy All Text
            </button>
            <button
              type="button"
              onClick={handleDownload}
              data-ocid="results.save_button"
              className="flex items-center w-full font-medium transition-colors hover:bg-gray-50"
              style={{
                gap: "12px",
                height: "48px",
                paddingLeft: "16px",
                paddingRight: "16px",
                borderRadius: "12px",
                border: "1.5px solid #E0E0E0",
                color: "#424242",
                background: "#fff",
                cursor: "pointer",
                fontSize: "14px",
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
            className="w-full text-sm font-medium transition-colors hover:bg-gray-50"
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
        <p style={{ fontSize: "11px", color: "#BDBDBD" }}>
          © {new Date().getFullYear()}. Built with{" "}
          <span style={{ color: "#F44336" }}>♥</span> using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#9E9E9E" }}
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
