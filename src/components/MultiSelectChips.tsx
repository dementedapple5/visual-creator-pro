import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Plus, X } from "lucide-react";

export type ChipOption = { value: string; label: string };

interface MultiSelectChipsProps {
  label: string;
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  customPlaceholder?: string;
  maxSelected?: number;
  showAiDecide?: boolean;
  aiValue?: string; // default "ai-decide"
  aiLabel?: string;
  aiDescription?: string;
  allowCustom?: boolean;
}

export function MultiSelectChips({
  label,
  options,
  value,
  onChange,
  placeholder,
  customPlaceholder = "Add custom option...",
  maxSelected,
  showAiDecide = true,
  aiValue = "ai-decide",
  aiLabel = "Let AI Decide",
  aiDescription = "AI will choose the best options for variations",
  allowCustom = true,
}: MultiSelectChipsProps) {
  const [custom, setCustom] = useState("");

  const selected = value ?? [];
  const isAiMode = selected.includes(aiValue);

  const optionMap = useMemo(() => {
    const map = new Map<string, ChipOption>();
    for (const opt of options) map.set(opt.value, opt);
    return map;
  }, [options]);

  const knownValues = options.map((o) => o.value);
  const customSelected = selected.filter((v) => v !== aiValue && !knownValues.includes(v));

  const toggle = (nextValue: string) => {
    if (nextValue === aiValue) {
      onChange(isAiMode ? [] : [aiValue]);
      return;
    }

    if (isAiMode) {
      onChange([nextValue]);
      return;
    }

    const isSelected = selected.includes(nextValue);
    if (isSelected) {
      onChange(selected.filter((v) => v !== nextValue));
      return;
    }

    if (typeof maxSelected === "number" && maxSelected > 0 && selected.length >= maxSelected) {
      return;
    }

    onChange([...selected, nextValue]);
  };

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (selected.includes(v)) {
      setCustom("");
      return;
    }

    if (isAiMode) {
      onChange([v]);
    } else {
      if (typeof maxSelected === "number" && maxSelected > 0 && selected.length >= maxSelected) return;
      onChange([...selected, v]);
    }
    setCustom("");
  };

  const remove = (v: string) => {
    onChange(selected.filter((x) => x !== v));
  };

  const remaining = typeof maxSelected === "number" ? Math.max(0, maxSelected - (isAiMode ? 0 : selected.length)) : null;

  return (
    <div className="space-y-3">
      {(label || typeof remaining === "number") && (
        <div className="flex items-center justify-between gap-3">
          {label && <Label className="text-sm font-medium">{label}</Label>}
          {typeof remaining === "number" && (
            <span className={`text-xs text-muted-foreground ${!label ? "ml-auto" : ""}`}>
              {isAiMode ? "AI mode" : `${selected.length}/${maxSelected}`}
            </span>
          )}
        </div>
      )}

      {showAiDecide && (
        <button
          type="button"
          onClick={() => toggle(aiValue)}
          className={`w-full px-4 py-3.5 rounded-2xl border transition-all duration-200 ease-out flex items-start justify-between gap-3 ${
            isAiMode 
              ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]" 
              : "border-border/60 bg-card/40 hover:bg-card/60 hover:border-muted-foreground/50"
          }`}
        >
          <div className="text-left space-y-0.5">
            <div className="font-semibold text-sm">{aiLabel}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{aiDescription}</div>
          </div>
          <div className="mt-0.5 flex-shrink-0">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ease-out ${
                isAiMode
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-muted-foreground/40 bg-transparent"
              }`}
            >
              <Check className={`w-3.5 h-3.5 transition-all duration-200 ${isAiMode ? "opacity-100 scale-100" : "opacity-0 scale-75"}`} />
            </div>
          </div>
        </button>
      )}

      <div className={`${isAiMode ? "opacity-50 pointer-events-none" : ""} space-y-4 ${showAiDecide ? "mt-1" : ""}`}>
        <div className="flex flex-wrap gap-x-2 gap-y-3">
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            const disabled = !isSelected && typeof remaining === "number" && remaining === 0;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => toggle(opt.value)}
                className={`inline-flex items-center rounded-full border text-sm font-medium shadow-sm select-none outline-none transition-all duration-200 ease-out ${
                  isSelected
                    ? "bg-primary/10 border-primary text-foreground shadow-[0_0_0_1px_hsl(var(--primary))] px-2 py-1.5"
                    : disabled
                      ? "bg-muted/30 border-border/40 text-muted-foreground opacity-50 cursor-not-allowed px-3.5 py-1.5"
                      : "bg-muted/40 border-border/60 text-foreground hover:bg-muted/60 hover:border-muted-foreground/50 px-3.5 py-1.5"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center rounded-full border-2 overflow-hidden transition-all duration-200 ease-out ${
                    isSelected
                      ? "w-5 h-5 me-2.5 bg-primary border-primary text-primary-foreground opacity-100"
                      : "w-0 h-5 mr-0 bg-transparent border-transparent opacity-0"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>

        {placeholder && <p className="text-xs text-muted-foreground">{placeholder}</p>}

        {allowCustom && (
          <div className="flex gap-2 pt-1">
            <Input
              placeholder={customPlaceholder}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustom();
              }}
            />
            <Button variant="outline" size="icon" type="button" onClick={addCustom} disabled={!custom.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}

        {customSelected.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {customSelected.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1.5 text-sm shadow-sm"
              >
                {optionMap.get(v)?.label ?? v}
                <button type="button" onClick={() => remove(v)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


