import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreateData } from "@/pages/Create";
import { Video, Camera, Check, X, Sparkles, Plus } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { compressAndConvertToJpg } from "@/lib/imageUtils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface StepAvatarProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
}

interface Avatar {
  id: string;
  image_url: string;
}

const POSITIONS = [
  { id: "top-left", label: "Top Left" },
  { id: "top-center", label: "Top Center" },
  { id: "top-right", label: "Top Right" },
  { id: "center-left", label: "Center Left" },
  { id: "center", label: "Center" },
  { id: "center-right", label: "Center Right" },
  { id: "bottom-left", label: "Bottom Left" },
  { id: "bottom-center", label: "Bottom Center" },
  { id: "bottom-right", label: "Bottom Right" },
];

const AvatarCustomization = ({ data, updateData }: { data: CreateData; updateData: (updates: Partial<CreateData>) => void }) => {
  const [customPosition, setCustomPosition] = useState("");
  const selectedPositions = data.avatarPositions || [];
  const isAiMode = selectedPositions.includes("ai-decide");

  const handlePositionToggle = (positionId: string) => {
    if (positionId === "ai-decide") {
      // Toggle AI mode - clears other selections
      if (isAiMode) {
        updateData({ avatarPositions: [] });
      } else {
        updateData({ avatarPositions: ["ai-decide"] });
      }
      return;
    }

    // If AI mode is active, switch to manual selection
    if (isAiMode) {
      updateData({ avatarPositions: [positionId] });
      return;
    }

    const isSelected = selectedPositions.includes(positionId);
    
    if (isSelected) {
      updateData({ avatarPositions: selectedPositions.filter(p => p !== positionId) });
    } else {
      updateData({ avatarPositions: [...selectedPositions, positionId] });
    }
  };

  const addCustomPosition = () => {
    if (customPosition.trim() && !selectedPositions.includes(customPosition.trim())) {
      if (isAiMode) {
        updateData({ avatarPositions: [customPosition.trim()] });
      } else {
        updateData({ avatarPositions: [...selectedPositions, customPosition.trim()] });
      }
      setCustomPosition("");
    }
  };

  const removePosition = (positionId: string) => {
    updateData({ avatarPositions: selectedPositions.filter(p => p !== positionId) });
  };

  return (
    <div className="space-y-6 p-6 bg-card border border-border rounded-lg transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2">
      <h3 className="text-lg font-semibold">Avatar Customization</h3>
      
      <div className="space-y-3">
        <Label>Positions (select multiple for variations)</Label>
        
        {/* AI Decide Option */}
        <button
          onClick={() => handlePositionToggle("ai-decide")}
          className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
            isAiMode
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isAiMode ? "bg-primary" : "bg-gradient-to-br from-violet-500 to-fuchsia-500"
          }`}>
            {isAiMode ? <Check className="w-4 h-4 text-primary-foreground" /> : <Sparkles className="w-4 h-4 text-white" />}
          </div>
          <div className="text-left">
            <div className="font-medium text-sm">Let AI Decide</div>
            <div className="text-xs text-muted-foreground">AI will choose optimal positions</div>
          </div>
        </button>

        {/* Position Chips */}
        <div className={`flex flex-wrap gap-2 ${isAiMode ? "opacity-50 pointer-events-none" : ""}`}>
          {POSITIONS.map((position) => {
            const isSelected = selectedPositions.includes(position.id);
            return (
              <button
                key={position.id}
                onClick={() => handlePositionToggle(position.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                {position.label}
              </button>
            );
          })}
        </div>

        {/* Custom Position Input */}
        <div className={`flex gap-2 ${isAiMode ? "opacity-50 pointer-events-none" : ""}`}>
          <Input
            placeholder="Add custom position..."
            value={customPosition}
            onChange={(e) => setCustomPosition(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomPosition()}
            className="flex-1"
          />
          <Button 
            variant="outline" 
            size="icon"
            onClick={addCustomPosition}
            disabled={!customPosition.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Selected Custom Positions */}
        {selectedPositions.filter(p => p !== "ai-decide" && !POSITIONS.find(pos => pos.id === p)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedPositions
              .filter(p => p !== "ai-decide" && !POSITIONS.find(pos => pos.id === p))
              .map((posId) => (
                <span
                  key={posId}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm"
                >
                  {posId}
                  <button onClick={() => removePosition(posId)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="avatar-importance">
          Importance Level: {data.avatarImportance || 3}
        </Label>
        <Slider
          id="avatar-importance"
          min={1}
          max={5}
          step={1}
          value={[data.avatarImportance || 3]}
          onValueChange={([value]) => updateData({ avatarImportance: value })}
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Higher importance = more space in the thumbnail
        </p>
      </div>
    </div>
  );
};

export const StepAvatar = ({ data, updateData, onNext }: StepAvatarProps) => {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [capturedFrame, setCapturedFrame] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAvatars();
  }, []);

  const fetchAvatars = async () => {
    try {
      const { data: avatarData, error } = await supabase
        .from("avatars")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAvatars(avatarData || []);
    } catch (error) {
      console.error("Error fetching avatars:", error);
      toast.error("Failed to load avatars");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (id: string) => {
    updateData({ avatarId: id });
  };

  const handleSkip = () => {
    updateData({ 
      avatarId: undefined,
      avatarPosition: undefined,
      avatarImportance: undefined
    });
    onNext();
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        toast.error("Please upload a video file");
        return;
      }
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setCapturedFrame("");
      updateData({ avatarId: undefined });
    }
  };

  const handleCaptureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const frameUrl = canvas.toDataURL("image/png");
    setCapturedFrame(frameUrl);

    try {
      // Convert dataURL to blob
      const response = await fetch(frameUrl);
      const blob = await response.blob();

      // Compress and convert to JPG
      const compressedBlob = await compressAndConvertToJpg(blob);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Upload to storage
      const fileName = `avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(`${user.id}/${fileName}`, compressedBlob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(`${user.id}/${fileName}`);

      // Save to database
      const { data: avatarData, error: dbError } = await supabase
        .from("avatars")
        .insert({
          user_id: user.id,
          image_url: publicUrl,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Update state and data with new avatar
      updateData({ avatarId: avatarData.id });
      await fetchAvatars(); // Refresh avatar list
      toast.success("Frame saved as avatar!");
    } catch (error) {
      console.error("Error saving frame:", error);
      toast.error("Failed to save frame as avatar");
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = (value[0] / 100) * videoRef.current.duration;
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Select Your Avatar</h2>
        <p className="text-muted-foreground">
          Choose an avatar or extract a frame from a video (optional)
        </p>
      </div>

      {/* Video Upload Section */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Video className="w-5 h-5" />
            Extract Frame from Video
          </h3>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            size="sm"
          >
            Upload Video
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="hidden"
          />
        </div>

        {videoUrl && (
          <div className="space-y-4 transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={togglePlayPause}
                  className="flex-1"
                >
                  {isPlaying ? "Pause" : "Play"}
                </Button>
                <Button
                  variant="default"
                  onClick={handleCaptureFrame}
                  className="flex-1"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capture Frame
                </Button>
              </div>
              <Slider
                min={0}
                max={100}
                step={0.1}
                onValueChange={handleSeek}
                className="w-full"
              />
            </div>

            {capturedFrame && (
              <div className="border-2 border-primary rounded-lg overflow-hidden max-w-xs transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2">
                <img
                  src={capturedFrame}
                  alt="Captured frame"
                  className="w-full h-auto max-h-48 object-cover"
                />
                <div className="bg-primary/10 px-4 py-2 text-center text-sm font-medium">
                  Frame saved as avatar
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Existing Avatars Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Or Choose from Your Avatars</h3>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : avatars.length === 0 ? (
          <div className="text-center py-8 border border-border rounded-lg">
            <p className="text-muted-foreground text-sm">No avatars uploaded yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {avatars.map((avatar) => (
              <div
                key={avatar.id}
                onClick={() => {
                  handleSelect(avatar.id);
                  setCapturedFrame("");
                }}
                className={`aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                  data.avatarId === avatar.id && !capturedFrame
                    ? "border-primary ring-4 ring-primary/20"
                    : "border-border hover:border-primary"
                }`}
              >
                <img
                  src={avatar.image_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {data.avatarId && (
        <AvatarCustomization data={data} updateData={updateData} />
      )}

      <div className="flex gap-4 pt-8">
        <Button variant="outline" onClick={handleSkip} className="flex-1">
          Skip
        </Button>
        <Button onClick={onNext} disabled={!data.avatarId} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
};
