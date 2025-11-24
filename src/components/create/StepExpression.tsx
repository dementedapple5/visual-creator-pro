import { Button } from "@/components/ui/button";
import { CreateData } from "@/pages/Create";

interface StepExpressionProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const EXPRESSIONS = [
  { id: "excited", label: "Excited", emoji: "🤩" },
  { id: "surprised", label: "Surprised", emoji: "😮" },
  { id: "happy", label: "Happy", emoji: "😊" },
  { id: "serious", label: "Serious", emoji: "😐" },
  { id: "confident", label: "Confident", emoji: "😎" },
  { id: "thinking", label: "Thinking", emoji: "🤔" },
];

export const StepExpression = ({ data, updateData, onNext, onPrev }: StepExpressionProps) => {
  const handleSelect = (expression: string) => {
    updateData({ expression });
    onNext();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Choose Expression</h2>
        <p className="text-muted-foreground">
          Select the facial expression for your avatar
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {EXPRESSIONS.map((expression) => (
          <button
            key={expression.id}
            onClick={() => handleSelect(expression.id)}
            className={`p-6 rounded-lg border-2 transition-all hover:border-primary ${
              data.expression === expression.id
                ? "border-primary bg-primary/5"
                : "border-border"
            }`}
          >
            <div className="text-4xl mb-2">{expression.emoji}</div>
            <div className="font-medium">{expression.label}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-4 pt-8">
        <Button variant="outline" onClick={onPrev}>
          Back
        </Button>
      </div>
    </div>
  );
};
