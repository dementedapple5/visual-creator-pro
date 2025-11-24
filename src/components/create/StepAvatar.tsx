import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreateData } from "@/pages/Create";
import { Video, Camera } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { compressAndConvertToJpg } from "@/lib/imageUtils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StepAvatarProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
}

interface Avatar {
  id: string;
  image_url: string;
}

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
          <div className="space-y-4">
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
              <div className="border-2 border-primary rounded-lg overflow-hidden max-w-xs">
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
        <div className="space-y-6 p-6 bg-card border border-border rounded-lg">
          <h3 className="text-lg font-semibold">Avatar Customization</h3>
          
          <div>
            <Label htmlFor="avatar-position">Position</Label>
            <Select 
              value={data.avatarPosition || "center"} 
              onValueChange={(value) => updateData({ avatarPosition: value })}
            >
              <SelectTrigger id="avatar-position">
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
