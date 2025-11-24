import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateData } from "@/pages/Create";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface StepTextProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const StepText = ({ data, updateData, onNext, onPrev }: StepTextProps) => {
  const handleSkip = () => {
    updateData({ 
      title: undefined, 
      subtitle: undefined,
      textPosition: undefined,
      textImportance: undefined
    });
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

      {(data.title || data.subtitle) && (
        <div className="space-y-6 p-6 bg-card border border-border rounded-lg transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2">
          <h3 className="text-lg font-semibold">Text Customization</h3>
          
          <div>
            <Label htmlFor="text-position">Position</Label>
            <Select 
              value={data.textPosition || "center"} 
              onValueChange={(value) => updateData({ textPosition: value })}
            >
              <SelectTrigger id="text-position">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-center">Top Center</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="center-left">Center Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="center-right">Center Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-center">Bottom Center</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="text-importance">
              Importance Level: {data.textImportance || 3}
            </Label>
            <Slider
              id="text-importance"
              min={1}
              max={5}
              step={1}
              value={[data.textImportance || 3]}
              onValueChange={([value]) => updateData({ textImportance: value })}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Higher importance = more space in the thumbnail
            </p>
          </div>
        </div>
      )}

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
