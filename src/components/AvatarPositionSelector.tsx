import { Check } from "lucide-react";

export type PositionOption = { value: string; label: string };

interface AvatarPositionSelectorProps {
  options: PositionOption[];
  value: string[];
  onChange: (next: string[]) => void;
  showAiDecide?: boolean;
  aiValue?: string;
  aiLabel?: string;
  aiDescription?: string;
}

export function AvatarPositionSelector({
  options,
  value,
  onChange,
  showAiDecide = true,
  aiValue = "ai-decide",
  aiLabel = "Let AI Decide",
  aiDescription = "AI will vary avatar positions across the 9 thumbnails.",
}: AvatarPositionSelectorProps) {
  const selected = value ?? [];
  const isAiMode = selected.includes(aiValue);

  // Map positions to grid coordinates (3x3 grid)
  const positionGrid: { [key: string]: { row: number; col: number } } = {
    "top-left": { row: 0, col: 0 },
    "top-center": { row: 0, col: 1 },
    "top-right": { row: 0, col: 2 },
    "center-left": { row: 1, col: 0 },
    "center": { row: 1, col: 1 },
    "center-right": { row: 1, col: 2 },
    "bottom-left": { row: 2, col: 0 },
    "bottom-center": { row: 2, col: 1 },
    "bottom-right": { row: 2, col: 2 },
  };

  const togglePosition = (positionValue: string) => {
    if (positionValue === aiValue) {
      onChange(isAiMode ? [] : [aiValue]);
      return;
    }

    if (isAiMode) {
      onChange([positionValue]);
      return;
    }

    const isSelected = selected.includes(positionValue);
    if (isSelected) {
      onChange(selected.filter((v) => v !== positionValue));
    } else {
      onChange([...selected, positionValue]);
    }
  };

  // Create a 3x3 grid
  const grid = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];

  // Fill grid with positions
  options.forEach((option) => {
    const coords = positionGrid[option.value];
    if (coords) {
      grid[coords.row][coords.col] = option;
    }
  });

  return (
    <div className="space-y-4">
      {showAiDecide && (
        <button
          type="button"
          onClick={() => togglePosition(aiValue)}
          className={`w-full px-4 py-3.5 rounded-[4px] border transition-all duration-200 ease-out flex items-start justify-between gap-3 ${
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
              className={`w-5 h-5 rounded-[2px] border-2 flex items-center justify-center transition-all duration-200 ease-out ${
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

      <div className={`${isAiMode ? "opacity-50 pointer-events-none" : ""} transition-opacity`}>
        {/* Position Grid Container */}
        <div className="relative w-full aspect-[16/9] max-w-[240px] mx-auto border-2 border-border/60 rounded-lg bg-muted/10 overflow-hidden">
          {/* Grid lines */}
          <div className="absolute inset-0">
            {/* Vertical lines */}
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-border/50" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-border/50" />
            {/* Horizontal lines */}
            <div className="absolute top-1/3 left-0 right-0 h-px bg-border/50" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-border/50" />
          </div>

          {/* Position points */}
          <div className="absolute inset-0">
            {grid.map((row, rowIndex) =>
              row.map((position, colIndex) => {
                if (!position) return null;
                
                const isSelected = selected.includes(position.value);
                // Calculate exact center of each cell (1/6, 3/6, 5/6 for columns and rows)
                const xPercent = ((colIndex * 2 + 1) / 6) * 100;
                const yPercent = ((rowIndex * 2 + 1) / 6) * 100;

                return (
                  <button
                    key={position.value}
                    type="button"
                    onClick={() => togglePosition(position.value)}
                    className={`absolute transition-all duration-200 ease-out group ${
                      isSelected
                        ? "z-10"
                        : ""
                    }`}
                    style={{
                      left: `${xPercent}%`,
                      top: `${yPercent}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    title={position.label}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ease-out ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/50"
                          : "bg-background border-border/70 text-muted-foreground group-hover:border-primary/70 group-hover:bg-muted/80 group-hover:text-foreground"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {!isSelected && (
                        <div className="w-1 h-1 rounded-full bg-current opacity-60 group-hover:opacity-100" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
