import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Image as ImageIcon,
  Palette,
  Sparkles,
  Trash2,
} from "lucide-react";
import { compressAndConvertToJpg, extractStoragePath } from "@/lib/imageUtils";
import type { Tables } from "@/integrations/supabase/types";

type SavedBackground = Tables<"backgrounds">;
type Avatar = Tables<"avatars">;
type BackgroundType = "gradient" | "solid" | "image" | "avatar" | "custom-prompt";

const Backgrounds = () => {
  const navigate = useNavigate();
  const [backgrounds, setBackgrounds] = useState<SavedBackground[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<BackgroundType>("gradient");
  const [color1, setColor1] = useState("#FF6B9D");
  const [color2, setColor2] = useState("#C239B3");
  const [solidColor, setSolidColor] = useState("#FF6B9D");
  const [prompt, setPrompt] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    checkUser();
    fetchData();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchData = async () => {
    await Promise.all([fetchBackgrounds(), fetchAvatars()]);
    setLoading(false);
  };

  const fetchBackgrounds = async () => {
    const { data, error } = await supabase
      .from("backgrounds")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading backgrounds", error);
      toast.error("Could not load backgrounds");
      return;
    }

    setBackgrounds(data || []);
  };

  const fetchAvatars = async () => {
    const { data, error } = await supabase
      .from("avatars")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading avatars", error);
      return;
    }

    setAvatars(data || []);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const compressedBlob = await compressAndConvertToJpg(file);
      const fileName = `${user.id}/backgrounds/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(fileName);

      setImageUrl(publicUrl);
      toast.success("Background image uploaded");
    } catch (error) {
      console.error("Error uploading background image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!name.trim()) {
        toast.error("Please add a name for this background");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      let value: string | null = null;
      let metadata: Record<string, any> = {};

      switch (type) {
        case "gradient": {
          value = `${color1},${color2}`;
          metadata = { color1, color2 };
          break;
        }
        case "solid": {
          value = solidColor;
          metadata = { color: solidColor };
          break;
        }
        case "image": {
          if (!imageUrl) {
            toast.error("Upload an image before saving");
            return;
          }
          value = imageUrl;
          metadata = { imageUrl };
          break;
        }
        case "avatar": {
          if (!avatarId) {
            toast.error("Select an avatar to base this background on");
            return;
          }
          value = avatarId;
          metadata = { avatarId };
          break;
        }
        case "custom-prompt": {
          if (!prompt.trim()) {
            toast.error("Add a description for this background");
            return;
          }
          value = prompt;
          metadata = { prompt };
          break;
        }
        default:
          break;
      }

      setSaving(true);

      const { error } = await supabase.from("backgrounds").insert({
        user_id: user.id,
        name,
        type,
        value,
        metadata,
      });

      if (error) throw error;

      toast.success("Background saved");
      setName("");
      setPrompt("");
      setAvatarId("");
      setImageUrl("");
      await fetchBackgrounds();
    } catch (error) {
      console.error("Error saving background:", error);
      toast.error("Failed to save background");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (background: SavedBackground) => {
    try {
      const { error } = await supabase
        .from("backgrounds")
        .delete()
        .eq("id", background.id);

      if (error) throw error;

      if (background.type === "image" && background.value) {
        const storagePath = extractStoragePath(background.value, "thumbnails");
        if (storagePath) {
          const { error: storageError } = await supabase.storage
            .from("thumbnails")
            .remove([storagePath]);

          if (storageError) {
            console.error("Error removing background image from storage", storageError);
          }
        }
      }

      toast.success("Background deleted");
      fetchBackgrounds();
    } catch (error) {
      console.error("Error deleting background:", error);
      toast.error("Failed to delete background");
    }
  };

  const renderPreview = (background: SavedBackground) => {
    const meta = (background.metadata as Record<string, any>) || {};

    if (background.type === "gradient") {
      const [first, second] = background.value?.split(",") || [meta.color1, meta.color2];
      const start = first || meta.color1 || "#FF6B9D";
      const end = second || meta.color2 || "#C239B3";
      return (
        <div
          className="aspect-video w-full rounded-lg border border-border"
          style={{ background: `linear-gradient(135deg, ${start}, ${end})` }}
        />
      );
    }

    if (background.type === "solid") {
      const color = background.value || meta.color || "#FF6B9D";
      return (
        <div
          className="aspect-video w-full rounded-lg border border-border"
          style={{ background: color }}
        />
      );
    }

    if (background.type === "image") {
      const url = background.value || meta.imageUrl;
      return (
        <div className="aspect-video w-full rounded-lg border border-border overflow-hidden bg-secondary">
          {url ? (
            <img
              src={url}
              alt={background.name}
              className="h-full w-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
              No image
            </div>
          )}
        </div>
      );
    }

    if (background.type === "avatar") {
      const avatar = avatars.find((a) => a.id === (background.value || meta.avatarId));
      return (
        <div className="aspect-video w-full rounded-lg border border-border overflow-hidden bg-secondary flex items-center justify-center">
          {avatar ? (
            <img
              src={avatar.image_url}
              alt="Avatar"
              className="h-full w-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="text-xs text-muted-foreground">Avatar not found</div>
          )}
        </div>
      );
    }

    return (
      <div className="aspect-video w-full rounded-lg border border-border bg-secondary/50 p-3 text-sm text-muted-foreground overflow-hidden">
        {background.value || (meta.prompt as string) || "Custom prompt background"}
      </div>
    );
  };

  const typeLabel = (value: BackgroundType) => {
    switch (value) {
      case "gradient":
        return "Gradient";
      case "solid":
        return "Solid color";
      case "image":
        return "Image";
      case "avatar":
        return "From avatar";
      case "custom-prompt":
        return "Prompt";
      default:
        return value;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading backgrounds...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-4 max-w-6xl space-y-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Library
            </p>
            <h2 className="text-2xl font-semibold leading-tight">Backgrounds</h2>
            <p className="text-sm text-muted-foreground">
              Save gradients, colors, prompts, or images to reuse in new thumbnails.
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

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Save a background</CardTitle>
              <CardDescription>
                Capture the settings you like and apply them later in the create flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Neon gradient"
                />
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(val) => setType(val as BackgroundType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gradient">Gradient</SelectItem>
                    <SelectItem value="solid">Solid color</SelectItem>
                    <SelectItem value="image">Image upload</SelectItem>
                    <SelectItem value="avatar">From avatar</SelectItem>
                    <SelectItem value="custom-prompt">Custom prompt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {type === "gradient" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Color 1</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={color1}
                        onChange={(e) => setColor1(e.target.value)}
                        className="w-12 h-10 rounded border border-border cursor-pointer"
                      />
                      <Input value={color1} onChange={(e) => setColor1(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Color 2</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={color2}
                        onChange={(e) => setColor2(e.target.value)}
                        className="w-12 h-10 rounded border border-border cursor-pointer"
                      />
                      <Input value={color2} onChange={(e) => setColor2(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {type === "solid" && (
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={solidColor}
                      onChange={(e) => setSolidColor(e.target.value)}
                      className="w-12 h-10 rounded border border-border cursor-pointer"
                    />
                    <Input
                      value={solidColor}
                      onChange={(e) => setSolidColor(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {type === "image" && (
                <div className="space-y-2">
                  <Label>Upload background image</Label>
                  <label className="block">
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                      {imageUrl ? (
                        <div className="space-y-2">
                          <img
                            src={imageUrl}
                            alt="Background preview"
                            className="w-full h-32 object-cover rounded-lg"
                            crossOrigin="anonymous"
                          />
                          <p className="text-sm text-muted-foreground">Click to replace</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ImageIcon className="w-6 h-6" />
                          <p className="text-sm">Click to upload</p>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              )}

              {type === "avatar" && (
                <div className="space-y-2">
                  <Label>Choose avatar</Label>
                  <Select value={avatarId} onValueChange={setAvatarId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an avatar" />
                    </SelectTrigger>
                    <SelectContent>
                      {avatars.map((avatar) => (
                        <SelectItem key={avatar.id} value={avatar.id}>
                          {avatar.id.slice(0, 6)}...
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {avatars.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No avatars yet. Upload one in the Avatars screen.
                    </p>
                  )}
                </div>
              )}

              {type === "custom-prompt" && (
                <div className="space-y-2">
                  <Label>Background prompt</Label>
                  <Textarea
                    placeholder="e.g., Futuristic city skyline at dusk"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSave} disabled={saving || uploading} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Palette className="w-4 h-4 mr-2" />
                    Save background
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Saved backgrounds</CardTitle>
              <CardDescription>
                Apply these quickly when creating or editing thumbnails.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {backgrounds.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                  No backgrounds saved yet.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {backgrounds.map((bg) => (
                    <div
                      key={bg.id}
                      className="rounded-lg border border-border p-3 space-y-3 bg-card/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{typeLabel(bg.type as BackgroundType)}</Badge>
                          <p className="font-medium truncate max-w-[140px]">{bg.name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(bg)}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                      {renderPreview(bg)}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(bg.created_at || "").toLocaleDateString()}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate("/create")}
                          className="h-7 px-3 text-xs"
                        >
                          Use in create
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Backgrounds;

