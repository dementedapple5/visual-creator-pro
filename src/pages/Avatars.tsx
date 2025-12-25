import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Video, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { compressAndConvertToJpg, extractStoragePath } from "@/lib/imageUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Avatar {
  id: string;
  image_url: string;
  created_at: string;
}

const Avatars = () => {
  const navigate = useNavigate();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generatingHeadshot, setGeneratingHeadshot] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<{ id: string; url: string } | null>(null);
  const [showHeadshotDialog, setShowHeadshotDialog] = useState(false);
  const [headshotUsage, setHeadshotUsage] = useState(0);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    checkUser();
    fetchAvatars();
    checkSubscription();
  }, []);

  const isFreeAvatarLimited =
    !!subscription && !subscription.subscribed && !subscription.is_super_admin && avatars.length >= 1;

  const checkSubscription = async () => {
    const { data } = await supabase.functions.invoke("check-subscription");
    if (data) {
      setSubscription(data);
      if (data.plan_tier !== "free" || data.is_super_admin) {
        fetchHeadshotUsage(data.billing_period_start);
      }
    }
  };

  const fetchHeadshotUsage = async (billingStart: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const start = billingStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const { count, error } = await supabase
        .from("generations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("mode", "headshot")
        .eq("status", "completed")
        .gte("created_at", start);

      if (!error && count !== null) {
        setHeadshotUsage(count);
      }
    } catch (error) {
      console.error("Error fetching headshot usage:", error);
    }
  };

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchAvatars = async () => {
    try {
      const { data, error } = await supabase
        .from("avatars")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAvatars(data || []);
    } catch (error) {
      console.error("Error fetching avatars:", error);
      toast.error("Failed to load avatars");
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Check free tier limit
      if (isFreeAvatarLimited) {
        toast.error("Free tier users can only upload 1 avatar. Upgrade to add more.");
        setUploading(false);
        return;
      }

      const compressedBlob = await compressAndConvertToJpg(file);
      const fileName = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const { data: insertedAvatar, error: dbError } = await supabase
        .from("avatars")
        .insert({ user_id: user.id, image_url: publicUrl })
        .select("id,image_url")
        .single();

      if (dbError) throw dbError;

      toast.success("Avatar uploaded successfully");
      fetchAvatars();
      
      // Setup headshot prompt
      setPendingAvatar({ id: insertedAvatar?.id || "", url: insertedAvatar?.image_url || publicUrl });
      setShowHeadshotDialog(true);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
  };

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !videoFile) return;

    try {
      setUploading(true);

      // Check free tier limit
      if (isFreeAvatarLimited) {
        toast.error("Free tier users can only upload 1 avatar. Upgrade to add more.");
        setUploading(false);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");
      
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Could not capture frame");

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user found");

        const compressedBlob = await compressAndConvertToJpg(blob);
        const fileName = `${user.id}/${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, compressedBlob, {
            contentType: "image/jpeg",
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        const { data: insertedAvatar, error: dbError } = await supabase
          .from("avatars")
          .insert({ user_id: user.id, image_url: publicUrl })
          .select("id,image_url")
          .single();

        if (dbError) throw dbError;

        toast.success("Avatar captured from video");
        setVideoFile(null);
        setVideoPreview(null);
        fetchAvatars();

        // Setup headshot prompt
        setPendingAvatar({ id: insertedAvatar?.id || "", url: insertedAvatar?.image_url || publicUrl });
        setShowHeadshotDialog(true);
      }, "image/jpeg");
    } catch (error) {
      console.error("Error capturing frame:", error);
      toast.error("Failed to capture frame");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateHeadshot = async () => {
    if (!pendingAvatar) return;

    try {
      setGeneratingHeadshot(true);
      const { data, error } = await supabase.functions.invoke("generate-headshot", {
        body: { imageUrl: pendingAvatar.url, avatarId: pendingAvatar.id }
      });

      if (error) throw error;

      // If the edge function handled the avatar update+cleanup, we can just refresh.
      // Otherwise, fall back to client-side update (requires avatars UPDATE RLS policy).
      if (!data?.avatarUpdated) {
        const { error: updateError } = await supabase
          .from("avatars")
          .update({ image_url: data.imageUrl })
          .eq("id", pendingAvatar.id);

        if (updateError) throw updateError;

        const storagePath = extractStoragePath(pendingAvatar.url, "avatars");
        if (storagePath) {
          await supabase.storage.from("avatars").remove([storagePath]);
        }
      }

      toast.success("Professional headshot generated!");
      fetchAvatars();
      checkSubscription(); // Refresh usage
    } catch (error: any) {
      console.error("Error generating headshot:", error);
      toast.error(error.message || "Failed to generate headshot");
    } finally {
      setGeneratingHeadshot(false);
      setShowHeadshotDialog(false);
      setPendingAvatar(null);
    }
  };

  const handleDelete = async (avatar: Avatar) => {
    try {
      const { error: dbError } = await supabase
        .from("avatars")
        .delete()
        .eq("id", avatar.id);

      if (dbError) throw dbError;

      const storagePath = extractStoragePath(avatar.image_url, "avatars");
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from("avatars")
          .remove([storagePath]);

        if (storageError) {
          console.error("Error deleting from storage:", storageError);
        }
      }

      toast.success("Avatar deleted");
      fetchAvatars();
    } catch (error) {
      console.error("Error deleting avatar:", error);
      toast.error("Failed to delete avatar");
    }
  };

  const getHeadshotLimit = () => {
    if (subscription?.is_super_admin) return 999999;
    const tier = subscription?.plan_tier || "free";
    const limits: Record<string, number> = {
      starter: 10,
      pro: 30,
      enterprise: 100,
      free: 0
    };
    return limits[tier] || 0;
  };

  const limitReached = headshotUsage >= getHeadshotLimit();
  const isFree = subscription?.plan_tier === "free" && !subscription?.is_super_admin;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-4 max-w-6xl">
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Your Avatars</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Upload images or capture frames from videos to use in your thumbnails
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* Image Upload */}
              <label htmlFor="image-upload">
                <div className={`border border-border rounded-lg p-6 text-center ${isFreeAvatarLimited ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-secondary/50'} transition-colors h-full flex flex-col items-center justify-center`}>
                  <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">Upload Image</p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG up to 10MB
                  </p>
                  {isFreeAvatarLimited && (
                    <p className="text-xs text-destructive mt-2">
                      Free tier limit reached
                    </p>
                  )}
                </div>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading || generatingHeadshot || isFreeAvatarLimited}
                  className="hidden"
                />
              </label>

              {/* Video Upload */}
              <label htmlFor="video-upload">
                <div className={`border border-border rounded-lg p-6 text-center ${isFreeAvatarLimited ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-secondary/50'} transition-colors h-full flex flex-col items-center justify-center`}>
                  <Video className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">Upload Video</p>
                  <p className="text-xs text-muted-foreground">
                    MP4, MOV to capture frame
                  </p>
                  {isFreeAvatarLimited && (
                    <p className="text-xs text-destructive mt-2">
                      Free tier limit reached
                    </p>
                  )}
                </div>
                <input
                  id="video-upload"
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  disabled={uploading || generatingHeadshot || isFreeAvatarLimited}
                  className="hidden"
                />
              </label>
            </div>

            {/* Video Preview */}
            {videoPreview && (
              <div className="mb-6 p-4 border border-border rounded-lg bg-card">
                <h3 className="text-sm font-medium mb-3">Select a frame</h3>
                <div className="space-y-3">
                  <video
                    ref={videoRef}
                    src={videoPreview}
                    controls
                    className="w-full rounded-lg"
                  />
                  <div className="flex gap-2">
                    <Button onClick={captureFrame} disabled={uploading || generatingHeadshot} size="sm">
                      Capture Current Frame
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setVideoFile(null);
                        setVideoPreview(null);
                      }}
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {/* Avatars Grid */}
            {avatars.length === 0 ? (
              <div className="text-center py-12 border border-border rounded-lg bg-secondary/20">
                <p className="text-sm text-muted-foreground">No avatars uploaded yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {avatars.map((avatar) => (
                  <div key={avatar.id} className="relative group">
                    <div 
                      className="aspect-square rounded-lg overflow-hidden bg-secondary border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={() => setSelectedAvatarUrl(avatar.image_url)}
                    >
                      <img
                        src={avatar.image_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(avatar);
                      }}
                      disabled={generatingHeadshot}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={!!selectedAvatarUrl} onOpenChange={(open) => !open && setSelectedAvatarUrl(null)}>
        <DialogContent className="max-w-3xl p-1 bg-transparent border-none">
          <DialogTitle className="sr-only">Avatar Preview</DialogTitle>
          <div className="relative aspect-square w-full">
            <img
              src={selectedAvatarUrl || ""}
              alt="Avatar Preview"
              className="w-full h-full object-contain rounded-lg"
              crossOrigin="anonymous"
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showHeadshotDialog} onOpenChange={setShowHeadshotDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Professional Headshot
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFree ? (
                "Professional headshots are only available for paid plans. Upgrade now to transform your avatars into studio-quality headshots!"
              ) : limitReached ? (
                `You've used all your ${getHeadshotLimit()} professional headshots for this month. Upgrade your plan for more!`
              ) : (
                <>
                  Want to turn this avatar into a professional headshot? This will improve face adherence when generating thumbnails further on.
                  <div className="mt-2 text-xs text-muted-foreground">
                    Remaining this month: {getHeadshotLimit() - headshotUsage}
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generatingHeadshot}>
              {isFree || limitReached ? "Close" : "Keep Original"}
            </AlertDialogCancel>
            {isFree ? (
              <AlertDialogAction onClick={() => navigate("/profile")}>
                View Plans
              </AlertDialogAction>
            ) : limitReached ? (
              <AlertDialogAction onClick={() => navigate("/profile")}>
                Upgrade Plan
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleGenerateHeadshot();
                }}
                disabled={generatingHeadshot}
                className="bg-rose-500 hover:bg-rose-600"
              >
                {generatingHeadshot ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Transform to Headshot"
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Avatars;
