import { cn } from "@/lib/utils";

interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioCardSelectorProps {
  options: RadioCardOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function RadioCardSelector({
  options,
  value,
  onChange,
  className,
}: RadioCardSelectorProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {options.map((option) => {
        const isSelected = value === option.value;
        
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative mx-1 px-2.5 py-2 rounded-[4px] border transition-all text-left flex items-center gap-2",
              isSelected
                ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]"
                : "border-border/60 bg-card/50 hover:border-muted-foreground/50"
            )}
          >
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-medium text-xs leading-tight",
                isSelected ? "text-foreground" : "text-foreground/80"
              )}>
                {option.label}
              </div>
              {option.description && (
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
                  {option.description}
                </div>
              )}
            </div>
            <div
              className={cn(
                "shrink-0 w-3.5 h-3.5 rounded-[2px] border-2 flex items-center justify-center transition-all",
                isSelected
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/40"
              )}
            >
              {isSelected && (
                <div className="w-1.5 h-1.5 rounded-[1px] bg-primary-foreground" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

