import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Plus, Sparkles, X } from "lucide-react";

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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium">{label}</Label>
        {typeof remaining === "number" && (
          <span className="text-xs text-muted-foreground">
            {isAiMode ? "AI mode" : `${selected.length}/${maxSelected}`}
          </span>
        )}
      </div>

      {showAiDecide && (
        <button
          type="button"
          onClick={() => toggle(aiValue)}
          className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
            isAiMode ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isAiMode ? "bg-primary" : "bg-gradient-to-br from-violet-500 to-fuchsia-500"
            }`}
          >
            {isAiMode ? (
              <Check className="w-4 h-4 text-primary-foreground" />
            ) : (
              <Sparkles className="w-4 h-4 text-white" />
            )}
          </div>
          <div className="text-left">
            <div className="font-medium text-sm">{aiLabel}</div>
            <div className="text-xs text-muted-foreground">{aiDescription}</div>
          </div>
        </button>
      )}

      <div className={`${isAiMode ? "opacity-50 pointer-events-none" : ""} space-y-2`}>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            const disabled = !isSelected && typeof remaining === "number" && remaining === 0;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => toggle(opt.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : disabled
                      ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                {opt.label}
              </button>
            );
          })}
        </div>

        {placeholder && <p className="text-xs text-muted-foreground">{placeholder}</p>}

        {allowCustom && (
          <div className="flex gap-2">
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
          <div className="flex flex-wrap gap-2">
            {customSelected.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm"
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


