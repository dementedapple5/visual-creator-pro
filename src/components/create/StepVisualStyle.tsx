import { Button } from "@/components/ui/button";
import { CreateData } from "@/pages/Create";

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
  const handleSelect = (style: string) => {
    updateData({ visualStyle: style });
    onNext();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Visual Style</h2>
        <p className="text-muted-foreground">
          Choose the overall aesthetic for your thumbnail
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {VISUAL_STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => handleSelect(style.id)}
            className={`p-6 rounded-lg border-2 text-left transition-all hover:border-primary ${
              data.visualStyle === style.id
                ? "border-primary bg-primary/5"
                : "border-border"
            }`}
          >
            <div className="font-semibold text-lg mb-1">{style.label}</div>
            <div className="text-sm text-muted-foreground">{style.description}</div>
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
