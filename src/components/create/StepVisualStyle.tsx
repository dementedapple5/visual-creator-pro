import { Button } from "@/components/ui/button";
import { CreateData } from "@/pages/Create";
import { Sparkles, Check } from "lucide-react";

interface StepVisualStyleProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const VISUAL_STYLES = [
  { id: "epic", label: "Epic", description: "Bold and dramatic" },
  { id: "dramatic", label: "Dramatic", description: "High contrast, cinematic" },
  { id: "vibrant", label: "Vibrant", description: "Colorful and energetic" },
  { id: "professional", label: "Professional", description: "Clean and polished" },
  { id: "creative", label: "Creative", description: "Artistic and unique" },
  { id: "minimalist", label: "Minimalist", description: "Simple and elegant" },
];

export const StepVisualStyle = ({ data, updateData, onNext, onPrev }: StepVisualStyleProps) => {
  const selectedStyles = data.visualStyles || [];
  const isAiMode = selectedStyles.includes("ai-decide");

  const handleToggle = (styleId: string) => {
    if (styleId === "ai-decide") {
      // Toggle AI mode - clears other selections
      if (isAiMode) {
        updateData({ visualStyles: [] });
      } else {
        updateData({ visualStyles: ["ai-decide"] });
      }
      return;
    }

    // If AI mode is active, switch to manual selection
    if (isAiMode) {
      updateData({ visualStyles: [styleId] });
      return;
    }

    const isSelected = selectedStyles.includes(styleId);
    
    if (isSelected) {
      updateData({ visualStyles: selectedStyles.filter(s => s !== styleId) });
    } else {
      updateData({ visualStyles: [...selectedStyles, styleId] });
    }
  };

  const canContinue = selectedStyles.length > 0;
  const selectionCount = isAiMode ? 0 : selectedStyles.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Visual Styles</h2>
        <p className="text-muted-foreground">
          Select one or more styles for thumbnail variations
          {selectionCount > 0 && (
            <span className="ml-2 text-primary font-medium">
              {selectionCount} selected
            </span>
          )}
        </p>
      </div>

      {/* AI Decide Option */}
      <button
        onClick={() => handleToggle("ai-decide")}
        className={`w-full p-6 rounded-lg border-2 transition-all hover:border-primary flex items-center gap-4 ${
          isAiMode
            ? "border-primary bg-primary/5"
            : "border-border"
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="text-left flex-1">
          <div className="font-semibold">Let AI Decide</div>
          <div className="text-sm text-muted-foreground">
            AI will choose the best visual styles for each thumbnail variation
          </div>
        </div>
        {isAiMode && (
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or select manually</span>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isAiMode ? "opacity-50 pointer-events-none" : ""}`}>
        {VISUAL_STYLES.map((style) => {
          const isSelected = selectedStyles.includes(style.id);
          
          return (
            <button
              key={style.id}
              onClick={() => handleToggle(style.id)}
              className={`relative p-6 rounded-lg border-2 text-left transition-all hover:border-primary ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div className="font-semibold text-lg mb-1">{style.label}</div>
              <div className="text-sm text-muted-foreground">{style.description}</div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 pt-8">
        <Button variant="outline" onClick={onPrev}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canContinue} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
};
