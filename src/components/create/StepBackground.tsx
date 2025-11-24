import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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

// Helper functions for color conversion
const hslToHex = (h: number, s: number, l: number): string => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 100, l: 50 };
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

export const StepBackground = ({ data, updateData, onNext, onPrev }: StepBackgroundProps) => {
  const [activeTab, setActiveTab] = useState<"preset" | "color" | "custom">("preset");
  const [uploading, setUploading] = useState(false);
  
  // Initialize HSL from existing color or default
  const initialHsl = data.backgroundType === "color" && data.backgroundValue 
    ? hexToHsl(data.backgroundValue) 
    : { h: 313, s: 93, l: 51 };
  
  const [hue, setHue] = useState(initialHsl.h);
  const [saturation, setSaturation] = useState(initialHsl.s);
  const [lightness, setLightness] = useState(initialHsl.l);

  const handleHslChange = (h: number, s: number, l: number) => {
    setHue(h);
    setSaturation(s);
    setLightness(l);
    const hexColor = hslToHex(h, s, l);
    updateData({ backgroundType: "color", backgroundValue: hexColor });
  };

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
    const hsl = hexToHsl(color);
    setHue(hsl.h);
    setSaturation(hsl.s);
    setLightness(hsl.l);
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
        <div className="space-y-6">
          <div className="flex gap-6">
            {/* Color Preview */}
            <div 
              className="w-32 h-32 rounded-lg border-2 border-border flex-shrink-0"
              style={{ backgroundColor: hslToHex(hue, saturation, lightness) }}
            />
            
            {/* HSL Sliders */}
            <div className="flex-1 space-y-6">
              {/* Hue Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Hue</Label>
                  <span className="text-sm font-mono">{hue}</span>
                </div>
                <Slider
                  value={[hue]}
                  onValueChange={([v]) => handleHslChange(v, saturation, lightness)}
                  min={0}
                  max={360}
                  step={1}
                  className="[&>span]:bg-gradient-to-r [&>span]:from-red-500 [&>span]:via-yellow-500 [&>span]:via-green-500 [&>span]:via-cyan-500 [&>span]:via-blue-500 [&>span]:via-purple-500 [&>span]:to-red-500"
                />
              </div>

              {/* Saturation Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Saturation</Label>
                  <span className="text-sm font-mono">{saturation}%</span>
                </div>
                <Slider
                  value={[saturation]}
                  onValueChange={([v]) => handleHslChange(hue, v, lightness)}
                  min={0}
                  max={100}
                  step={1}
                  style={{
                    background: `linear-gradient(to right, hsl(${hue}, 0%, ${lightness}%), hsl(${hue}, 100%, ${lightness}%))`
                  }}
                />
              </div>

              {/* Lightness Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Lightness</Label>
                  <span className="text-sm font-mono">{lightness}%</span>
                </div>
                <Slider
                  value={[lightness]}
                  onValueChange={([v]) => handleHslChange(hue, saturation, v)}
                  min={0}
                  max={100}
                  step={1}
                  style={{
                    background: `linear-gradient(to right, hsl(${hue}, ${saturation}%, 0%), hsl(${hue}, ${saturation}%, 50%), hsl(${hue}, ${saturation}%, 100%))`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Color Values Display */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">HEX</Label>
              <Input
                value={hslToHex(hue, saturation, lightness)}
                onChange={(e) => handleColorSelect(e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">HSLA</Label>
              <Input
                value={`hsla(${hue} ${saturation}% ${lightness}% / 1)`}
                readOnly
                className="font-mono"
              />
            </div>
          </div>
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
