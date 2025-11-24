import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateData } from "@/pages/Create";

interface StepTextProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const StepText = ({ data, updateData, onNext, onPrev }: StepTextProps) => {
  const handleSkip = () => {
    updateData({ title: undefined, subtitle: undefined });
    onNext();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Add Title & Subtitle</h2>
        <p className="text-muted-foreground">
          Add text to your thumbnail (optional)
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Enter title..."
            value={data.title || ""}
            onChange={(e) => updateData({ title: e.target.value })}
            className="text-lg"
          />
        </div>

        <div>
          <Label htmlFor="subtitle">Subtitle</Label>
          <Input
            id="subtitle"
            placeholder="Enter subtitle..."
            value={data.subtitle || ""}
            onChange={(e) => updateData({ subtitle: e.target.value })}
          />
        </div>
      </div>

      <div className="flex gap-4 pt-8">
        <Button variant="outline" onClick={onPrev}>
          Back
        </Button>
        <Button variant="outline" onClick={handleSkip} className="flex-1">
          Skip
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
};
