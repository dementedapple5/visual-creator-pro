import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  Sparkles,
  Trash2,
  Type as TypeIcon,
  Crown,
} from "lucide-react";
import { compressAndConvertToJpg } from "@/lib/imageUtils";
import type { Tables } from "@/integrations/supabase/types";

type FontStyle = Tables<"font_styles">;

const FontStyles = () => {
  const navigate = useNavigate();
  const [fontStyles, setFontStyles] = useState<FontStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    checkUser();
    fetchFontStyles();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchFontStyles = async () => {
    // Fetch both system and user font styles
    const { data, error } = await supabase
      .from("font_styles")
      .select("*")
      .order("is_system", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading font styles", error);
      toast.error("Could not load font styles");
      return;
    }

    setFontStyles(data || []);
    setLoading(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !name.trim()) {
      toast.error("Please provide a name and select an image");
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Compress and convert to JPG
      const compressedBlob = await compressAndConvertToJpg(selectedFile);
      const fileName = `${user.id}/${Date.now()}.jpg`;

      // Upload to vizion-fonts bucket
      const { error: uploadError } = await supabase.storage
        .from("vizion-fonts")
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("vizion-fonts")
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase.from("font_styles").insert({
        user_id: user.id,
        name: name.trim(),
        image_url: publicUrl,
        is_system: false,
      });

      if (dbError) throw dbError;

      toast.success("Font style uploaded successfully");
      setName("");
      setPreviewUrl(null);
      setSelectedFile(null);
      fetchFontStyles();
    } catch (error) {
      console.error("Error uploading font style:", error);
      toast.error("Failed to upload font style");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fontStyle: FontStyle) => {
    if (fontStyle.is_system) {
      toast.error("Cannot delete system font styles");
      return;
    }

    try {
      const { error } = await supabase
        .from("font_styles")
        .delete()
        .eq("id", fontStyle.id);

      if (error) throw error;

      // Try to delete from storage (extract path from URL)
      const urlParts = fontStyle.image_url.split("/vizion-fonts/");
      if (urlParts.length > 1) {
        await supabase.storage
          .from("vizion-fonts")
          .remove([urlParts[1]]);
      }

      toast.success("Font style deleted");
      fetchFontStyles();
    } catch (error) {
      console.error("Error deleting font style:", error);
      toast.error("Failed to delete font style");
    }
  };

  const systemStyles = fontStyles.filter((fs) => fs.is_system);
  const userStyles = fontStyles.filter((fs) => !fs.is_system);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading font styles...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-12 pl-20 max-w-6xl space-y-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Library
            </p>
            <h2 className="text-2xl font-semibold leading-tight">Font Styles</h2>
            <p className="text-sm text-muted-foreground">
              Browse and upload font style images to use as references in your thumbnails.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
            <Button onClick={() => navigate("/create")}>
              <Sparkles className="w-4 h-4 mr-2" />
              Create new thumbnail
            </Button>
          </div>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Custom Font Style
            </CardTitle>
            <CardDescription>
              Upload an image showing your desired font/text style. The AI will use it as a visual reference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Neon Glow Style"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Font Style Image</Label>
                  <label className="block">
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                      {previewUrl ? (
                        <div className="space-y-2">
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-full h-32 object-contain rounded-lg"
                          />
                          <p className="text-sm text-muted-foreground">Click to replace</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <TypeIcon className="w-8 h-8" />
                          <p className="text-sm">Click to upload font style image</p>
                          <p className="text-xs">PNG or JPG recommended</p>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="text-center space-y-3 p-6 rounded-lg bg-muted/30">
                  <TypeIcon className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Upload images that clearly show the font style you want. 
                    This could be text rendered in a specific style, a logo, 
                    or any typography reference.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleUpload} 
              disabled={uploading || !selectedFile || !name.trim()}
              className="w-full md:w-auto"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Font Style
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* System Font Styles */}
        {systemStyles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold">Pre-made Font Styles</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {systemStyles.map((fontStyle) => (
                <div
                  key={fontStyle.id}
                  className="group relative rounded-lg border border-border overflow-hidden bg-card hover:border-primary transition-colors"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={fontStyle.image_url}
                      alt={fontStyle.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <Crown className="w-3 h-3 mr-1" />
                        System
                      </Badge>
                    </div>
                    <p className="font-medium text-sm truncate">{fontStyle.name}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => navigate("/create")}
                    >
                      Use in create
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Font Styles */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Your Font Styles</h3>
          {userStyles.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center">
              <TypeIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                No custom font styles yet. Upload one above to get started!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {userStyles.map((fontStyle) => (
                <div
                  key={fontStyle.id}
                  className="group relative rounded-lg border border-border overflow-hidden bg-card hover:border-primary transition-colors"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={fontStyle.image_url}
                      alt={fontStyle.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDelete(fontStyle)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="font-medium text-sm truncate">{fontStyle.name}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(fontStyle.created_at || "").toLocaleDateString()}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => navigate("/create")}
                    >
                      Use in create
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FontStyles;

