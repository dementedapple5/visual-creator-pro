import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { extractStoragePath } from "@/lib/imageUtils";
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

interface Thumbnail {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  avatar_id: string | null;
  product_id: string | null;
  visual_style: string;
  text_style: string;
  background_type: string;
  background_value: string | null;
  expression: string | null;
  aspect_ratio: string;
  created_at: string;
}

const ThumbnailDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [thumbnail, setThumbnail] = useState<Thumbnail | null>(null);
  const [loading, setLoading] = useState(true);
  const [iterating, setIterating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    checkUser();
    fetchThumbnail();
  }, [id]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchThumbnail = async () => {
    try {
      const { data, error } = await supabase
        .from("thumbnails")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setThumbnail(data);
    } catch (error) {
      console.error("Error fetching thumbnail:", error);
      toast.error("Failed to load thumbnail");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleIterate = async () => {
    if (!prompt.trim() || !thumbnail) return;

    setIterating(true);
    try {
      // Generate a new version based on the prompt
      const { data: result, error } = await supabase.functions.invoke("generate-thumbnail", {
        body: {
          avatarId: thumbnail.avatar_id,
          productId: thumbnail.product_id,
          title: thumbnail.title,
          subtitle: thumbnail.subtitle,
          expression: thumbnail.expression,
          visualStyle: thumbnail.visual_style,
          textStyle: thumbnail.text_style,
          backgroundType: thumbnail.background_type,
          backgroundValue: thumbnail.background_value,
          aspectRatio: thumbnail.aspect_ratio,
          iterationPrompt: prompt, // Additional prompt for iteration
        },
      });

      if (error) throw error;

      // Update the thumbnail with the new image
      const { error: updateError } = await supabase
        .from("thumbnails")
        .update({ image_url: result.imageUrl })
        .eq("id", id);

      if (updateError) throw updateError;

      setThumbnail({ ...thumbnail, image_url: result.imageUrl });
      setPrompt("");
      toast.success("Thumbnail updated successfully!");
    } catch (error) {
      console.error("Error iterating thumbnail:", error);
      toast.error("Failed to update thumbnail");
    } finally {
      setIterating(false);
    }
  };

  const handleDownload = async () => {
    if (!thumbnail) return;

    try {
      const response = await fetch(thumbnail.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${thumbnail.title || "thumbnail"}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Download started!");
    } catch (error) {
      console.error("Error downloading thumbnail:", error);
      toast.error("Failed to download thumbnail");
    }
  };

  const handleDelete = async () => {
    if (!thumbnail) return;

    try {
      // Delete from database first
      const { error: dbError } = await supabase
        .from("thumbnails")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      // Extract storage path and delete from storage
      const storagePath = extractStoragePath(thumbnail.image_url, "thumbnails");
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from("thumbnails")
          .remove([storagePath]);

        if (storageError) {
          console.error("Error deleting from storage:", storageError);
        }
      }

      toast.success("Thumbnail deleted successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error deleting thumbnail:", error);
      toast.error("Failed to delete thumbnail");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!thumbnail) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Preview */}
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{thumbnail.title || "Untitled"}</h1>
              <p className="text-muted-foreground">
                {thumbnail.subtitle || "No description"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Aspect Ratio: {thumbnail.aspect_ratio} • Created: {new Date(thumbnail.created_at).toLocaleDateString()}
              </p>
            </div>
            <div 
              className={`rounded-lg overflow-hidden border border-border bg-muted ${
                thumbnail.aspect_ratio === "9:16" ? "max-w-md mx-auto" : ""
              }`}
              style={{ aspectRatio: thumbnail.aspect_ratio.replace(":", "/") }}
            >
              <img
                src={thumbnail.image_url}
                alt={thumbnail.title || "Thumbnail"}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Iteration Panel */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Iterate & Improve</h2>
              <p className="text-muted-foreground">
                Describe what changes you'd like to make to this thumbnail
              </p>
            </div>

            <div className="space-y-4">
              <Textarea
                placeholder="E.g., Make the background more vibrant, add a gradient effect, change the text color to blue..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <Button
                onClick={handleIterate}
                disabled={!prompt.trim() || iterating}
                className="w-full"
                size="lg"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                {iterating ? "Generating..." : "Generate New Version"}
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 space-y-2">
              <h3 className="font-semibold">Current Settings</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><span className="font-medium">Visual Style:</span> {thumbnail.visual_style}</p>
                <p><span className="font-medium">Text Style:</span> {thumbnail.text_style}</p>
                <p><span className="font-medium">Background:</span> {thumbnail.background_type}</p>
                {thumbnail.expression && (
                  <p><span className="font-medium">Expression:</span> {thumbnail.expression}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your thumbnail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ThumbnailDetail;
