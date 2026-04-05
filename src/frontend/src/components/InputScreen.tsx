import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Settings } from "@/lib/variantEngine";
import { CheckSquare, ClipboardPaste, Settings2 } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

interface InputScreenProps {
  onGenerate: (question: string, settings: Settings) => void;
}

export function InputScreen({ onGenerate }: InputScreenProps) {
  const [question, setQuestion] = useState(
    "If a car travels at 60 km/h, how long does it take to travel 120 km?",
  );
  const [integerOnly, setIntegerOnly] = useState(false);
  const [decimalPrecision, setDecimalPrecision] = useState(2);
  const [fractionMode, setFractionMode] = useState(false);
  const [quantity, setQuantity] = useState<3 | 4 | 5>(3);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setQuestion(text);
    } catch {
      // Clipboard read failed — silently ignore
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

  const decimalsDisabled = integerOnly;
  const fractionDisabled = integerOnly;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-5"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-foreground bg-transparent shrink-0"
          aria-hidden="true"
        >
          <CheckSquare className="h-5 w-5 text-foreground" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground leading-none">
            VARIANT
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Question Generator
          </p>
        </div>
      </div>

      {/* ── Question Input ── */}
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="self-start gap-1.5 h-8 text-xs font-medium border-border"
          onClick={handlePaste}
          data-ocid="input.upload_button"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Paste Question
        </Button>
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Paste your math question here..."
          className="dashed-input min-h-[112px] resize-none text-sm font-medium text-foreground placeholder:text-muted-foreground bg-white focus-visible:ring-primary"
          data-ocid="input.textarea"
        />
      </div>

      {/* ── Settings ── */}
      <div className="flex flex-col gap-3">
        {/* Integer Only */}
        <div
          className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3 gap-4"
          data-ocid="settings.panel"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              Integer Only
            </span>
            <span className="text-xs text-muted-foreground">
              Generate variants with integer answers
            </span>
          </div>
          <Switch
            checked={integerOnly}
            onCheckedChange={setIntegerOnly}
            data-ocid="settings.integer_only.toggle"
            aria-label="Integer Only"
          />
        </div>

        {/* Decimal Precision */}
        <div
          className={`flex flex-col gap-3 rounded-xl px-4 py-3 border border-border ${
            decimalsDisabled ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-foreground">
              Decimal Precision
            </Label>
            <span className="text-xs font-semibold text-primary">
              {decimalPrecision} decimal{decimalPrecision !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Ruler-style slider with tick marks */}
          <div className="flex flex-col gap-1">
            <Slider
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
            <div className="flex justify-between px-1">
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={`tick-${i + 1}`}
                  className={`text-[10px] ${
                    i + 1 === decimalPrecision
                      ? "text-primary font-bold"
                      : "text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Fraction Mode */}
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 border border-border gap-4 ${
            fractionDisabled ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              Fraction Mode
            </span>
            {fractionMode && !fractionDisabled && (
              <span className="text-xs text-primary">
                Overrides decimal mode
              </span>
            )}
            {!fractionMode && (
              <span className="text-xs text-muted-foreground">
                Output answers as fractions
              </span>
            )}
          </div>
          <Switch
            checked={fractionMode && !fractionDisabled}
            onCheckedChange={setFractionMode}
            disabled={fractionDisabled}
            data-ocid="settings.fraction_mode.toggle"
            aria-label="Fraction Mode"
          />
        </div>

        {/* Quantity */}
        <div className="flex flex-col gap-2.5">
          <Label className="text-sm font-semibold text-foreground">
            Quantity
          </Label>
          <div className="flex gap-2">
            {([3, 4, 5] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuantity(q)}
                data-ocid="settings.quantity.button"
                aria-pressed={quantity === q}
                className={`h-9 w-9 rounded-lg text-sm font-semibold border-2 transition-all duration-150 ${
                  quantity === q
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-white text-foreground hover:border-primary/60"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <Button
        onClick={handleGenerate}
        size="lg"
        className="w-full h-12 text-base font-semibold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-card-sm"
        data-ocid="input.primary_button"
      >
        <Settings2 className="h-5 w-5" />
        Generate Variants
      </Button>
    </motion.div>
  );
}
