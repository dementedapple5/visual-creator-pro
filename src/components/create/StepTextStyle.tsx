import { Button } from "@/components/ui/button";
import { CreateData } from "@/pages/Create";

interface StepTextStyleProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const TEXT_STYLES = [
  { id: "bold", label: "Bold & Impactful", description: "Large, bold text with strong contrast" },
  { id: "modern", label: "Modern & Clean", description: "Sleek fonts with minimal styling" },
  { id: "playful", label: "Playful & Fun", description: "Colorful and energetic typography" },
  { id: "professional", label: "Professional", description: "Clean, business-appropriate text" },
  { id: "neon", label: "Neon Glow", description: "Glowing text effects" },
  { id: "3d", label: "3D Effect", description: "Dimensional text with depth" },
];

export const StepTextStyle = ({ data, updateData, onNext, onPrev }: StepTextStyleProps) => {
  const handleSelect = (style: string) => {
    updateData({ textStyle: style });
    onNext();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Text Style</h2>
        <p className="text-muted-foreground">
          Choose how your title and subtitle will appear
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEXT_STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => handleSelect(style.id)}
            className={`p-6 rounded-lg border-2 text-left transition-all hover:border-primary ${
              data.textStyle === style.id
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
