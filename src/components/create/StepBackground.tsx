import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { CreateData } from "@/pages/Create";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StepBackgroundProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const PRESET_BACKGROUNDS = [
  { id: "studio", label: "Studio" },
  { id: "city", label: "City" },
  { id: "nature", label: "Nature" },
  { id: "mountains", label: "Mountains" },
  { id: "beach", label: "Beach" },
  { id: "abstract", label: "Abstract" },
];

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", 
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788"
];

export const StepBackground = ({ data, updateData, onNext, onPrev }: StepBackgroundProps) => {
  const [activeTab, setActiveTab] = useState<"preset" | "color" | "custom">("preset");
  const [uploading, setUploading] = useState(false);

  const handlePresetSelect = (preset: string) => {
    updateData({ backgroundType: "preset", backgroundValue: preset });
  };

  const handleCustomPrompt = (prompt: string) => {
    updateData({ backgroundType: "prompt", backgroundValue: prompt });
  };

  const handleUseAvatarBackground = () => {
    updateData({ backgroundType: "avatar-bg", backgroundValue: "Use avatar's background" });
  };

  const handleColorSelect = (color: string) => {
    updateData({ backgroundType: "color", backgroundValue: color });
  };

  const handleCustomUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/backgrounds/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(fileName);

      updateData({ backgroundType: "custom", backgroundValue: publicUrl });
      toast.success("Background uploaded");
    } catch (error) {
      console.error("Error uploading background:", error);
      toast.error("Failed to upload background");
    } finally {
      setUploading(false);
    }
  };

  const canContinue = data.backgroundType && data.backgroundValue;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Choose Background</h2>
        <p className="text-muted-foreground">
          Select a background for your thumbnail
        </p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("preset")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "preset"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab("color")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "color"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Colors
        </button>
        <button
          onClick={() => setActiveTab("custom")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "custom"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Custom
        </button>
      </div>

      {activeTab === "preset" && (
        <div className="space-y-6">
          {/* Use Avatar Background Option */}
          {data.avatarId && (
            <div>
              <h3 className="text-sm font-medium mb-3">Avatar Background</h3>
              <button
                onClick={handleUseAvatarBackground}
                className={`w-full p-4 rounded-lg border-2 transition-all hover:border-primary text-left ${
                  data.backgroundType === "avatar-bg"
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <div className="font-medium">Use Avatar's Background</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Keep the original background from your avatar image
                </div>
              </button>
            </div>
          )}

          {/* Custom Prompt */}
          <div>
            <h3 className="text-sm font-medium mb-3">Custom Background Prompt</h3>
            <Input
              placeholder="Describe your custom background..."
              value={data.backgroundType === "prompt" ? data.backgroundValue : ""}
              onChange={(e) => handleCustomPrompt(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Example: "Futuristic neon city at night" or "Tropical paradise with palm trees"
            </p>
          </div>

          {/* Preset Backgrounds */}
          <div>
            <h3 className="text-sm font-medium mb-3">Preset Backgrounds</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {PRESET_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => handlePresetSelect(bg.id)}
                  className={`p-8 rounded-lg border-2 transition-all hover:border-primary ${
                    data.backgroundType === "preset" && data.backgroundValue === bg.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="font-medium">{bg.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "color" && (
        <div className="grid grid-cols-5 gap-4">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorSelect(color)}
              className={`aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                data.backgroundType === "color" && data.backgroundValue === color
                  ? "border-primary ring-4 ring-primary/20"
                  : "border-border"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      {activeTab === "custom" && (
        <div>
          <label htmlFor="bg-upload">
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors">
              <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to upload custom background
              </p>
            </div>
            <input
              id="bg-upload"
              type="file"
              accept="image/*"
              onChange={handleCustomUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      )}

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
