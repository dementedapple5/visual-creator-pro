import { Button } from "@/components/ui/button";
import { CreateData } from "@/pages/Create";
import { Sparkles, Check } from "lucide-react";

interface StepExpressionProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const MAX_EXPRESSIONS = 3;

const EXPRESSIONS = [
  { id: "excited", label: "Excited", emoji: "🤩" },
  { id: "surprised", label: "Surprised", emoji: "😮" },
  { id: "happy", label: "Happy", emoji: "😊" },
  { id: "serious", label: "Serious", emoji: "😐" },
  { id: "confident", label: "Confident", emoji: "😎" },
  { id: "thinking", label: "Thinking", emoji: "🤔" },
];

export const StepExpression = ({ data, updateData, onNext, onPrev }: StepExpressionProps) => {
  const selectedExpressions = data.expressions || [];
  const isAiMode = selectedExpressions.includes("ai-decide");

  const handleToggle = (expressionId: string) => {
    if (expressionId === "ai-decide") {
      // Toggle AI mode - clears other selections
      if (isAiMode) {
        updateData({ expressions: [] });
      } else {
        updateData({ expressions: ["ai-decide"] });
      }
      return;
    }

    // If AI mode is active, switch to manual selection
    if (isAiMode) {
      updateData({ expressions: [expressionId] });
      return;
    }

    const isSelected = selectedExpressions.includes(expressionId);
    
    if (isSelected) {
      updateData({ expressions: selectedExpressions.filter(e => e !== expressionId) });
    } else if (selectedExpressions.length < MAX_EXPRESSIONS) {
      updateData({ expressions: [...selectedExpressions, expressionId] });
    }
  };

  const canContinue = selectedExpressions.length > 0;
  const selectionCount = isAiMode ? 0 : selectedExpressions.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Choose Expressions</h2>
        <p className="text-muted-foreground">
          Select up to {MAX_EXPRESSIONS} expressions for thumbnail variations
          {selectionCount > 0 && (
            <span className="ml-2 text-primary font-medium">
              {selectionCount}/{MAX_EXPRESSIONS} selected
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
            AI will choose the best expressions for each thumbnail variation
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

      <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${isAiMode ? "opacity-50 pointer-events-none" : ""}`}>
        {EXPRESSIONS.map((expression) => {
          const isSelected = selectedExpressions.includes(expression.id);
          const isDisabled = !isSelected && selectionCount >= MAX_EXPRESSIONS;
          
          return (
            <button
              key={expression.id}
              onClick={() => handleToggle(expression.id)}
              disabled={isDisabled}
              className={`relative p-6 rounded-lg border-2 transition-all ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : isDisabled
                    ? "border-border opacity-50 cursor-not-allowed"
                    : "border-border hover:border-primary"
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div className="text-4xl mb-2">{expression.emoji}</div>
              <div className="font-medium">{expression.label}</div>
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
