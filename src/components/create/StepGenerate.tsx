import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { CreateData } from "@/pages/Create";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StepGenerateProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onPrev: () => void;
}

export const StepGenerate = ({ data, updateData, onPrev }: StepGenerateProps) => {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || "16:9");

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      updateData({ aspectRatio });

      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-thumbnail",
        {
          body: { thumbnailData: { ...data, aspectRatio } },
        }
      );

      if (functionError) throw functionError;

      if (!functionData?.imageUrl) {
        throw new Error("No image URL returned");
      }

      setGeneratedImage(functionData.imageUrl);
      toast.success("Thumbnail generated successfully!");
    } catch (error: any) {
      console.error("Error generating thumbnail:", error);
      toast.error(error.message || "Failed to generate thumbnail");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedImage) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase.from("thumbnails").insert({
        user_id: user.id,
        title: data.title,
        subtitle: data.subtitle,
        avatar_id: data.avatarId,
        product_id: data.productId,
        expression: data.expression,
        visual_style: data.visualStyle || "",
        text_style: data.textStyle || "",
        background_type: data.backgroundType || "",
        background_value: data.backgroundValue,
        aspect_ratio: aspectRatio,
        image_url: generatedImage,
      });

      if (error) throw error;

      toast.success("Thumbnail saved!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error saving thumbnail:", error);
      toast.error("Failed to save thumbnail");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Generate Your Thumbnail</h2>
        <p className="text-muted-foreground">
          Review your selections and generate your thumbnail
        </p>
      </div>

      {/* Aspect Ratio Selection */}
      <div className="space-y-4">
        <Label className="text-lg font-semibold">Select Aspect Ratio</Label>
        <RadioGroup value={aspectRatio} onValueChange={setAspectRatio}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="16:9" id="youtube" />
            <Label htmlFor="youtube" className="cursor-pointer">
              YouTube (16:9) - Landscape
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="9:16" id="tiktok" />
            <Label htmlFor="tiktok" className="cursor-pointer">
              TikTok/Instagram (9:16) - Portrait
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Avatar:</span>
            <span className="ml-2">{data.avatarId ? "Selected" : "None"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Product:</span>
            <span className="ml-2">{data.productId ? "Selected" : "None"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Title:</span>
            <span className="ml-2">{data.title || "None"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Expression:</span>
            <span className="ml-2">{data.expression || "Default"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Visual Style:</span>
            <span className="ml-2">{data.visualStyle || "Default"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Text Style:</span>
            <span className="ml-2">{data.textStyle || "Default"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Background:</span>
            <span className="ml-2">{data.backgroundValue || "None"}</span>
          </div>
        </div>
      </div>

      {generatedImage && (
        <div className="aspect-video rounded-lg overflow-hidden border border-border">
          <img
            src={generatedImage}
            alt="Generated thumbnail"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="flex gap-4">
        <Button variant="outline" onClick={onPrev} disabled={generating}>
          Back
        </Button>
        {!generatedImage ? (
          <Button onClick={handleGenerate} disabled={generating} className="flex-1">
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Thumbnail"
            )}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleGenerate} className="flex-1">
              Regenerate
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Save & Finish
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
