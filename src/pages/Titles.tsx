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
import { Loader2, Sparkles, Trash2, Type as TypeIcon, BookmarkPlus, Image as ImageIcon } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type SavedTitle = Tables<"titles">;
type FontStyle = Tables<"font_styles">;

const POSITIONS = [
  { value: "top-left", label: "Top Left" },
  { value: "top-center", label: "Top Center" },
  { value: "top-right", label: "Top Right" },
  { value: "center-left", label: "Center Left" },
  { value: "center", label: "Center" },
  { value: "center-right", label: "Center Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-center", label: "Bottom Center" },
  { value: "bottom-right", label: "Bottom Right" },
];

const TEXT_STYLES = [
  "Bold & Large",
  "Elegant Script",
  "Modern Sans",
  "Handwritten",
  "Futuristic",
  "Classic Serif",
  "Custom",
];

const Titles = () => {
  const navigate = useNavigate();
  const [titles, setTitles] = useState<SavedTitle[]>([]);
  const [fontStyles, setFontStyles] = useState<FontStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [textStyle, setTextStyle] = useState<string>("Bold & Large");
  const [customTextStyle, setCustomTextStyle] = useState("");
  const [textPosition, setTextPosition] = useState<string>("top-center");
  const [fontStyleId, setFontStyleId] = useState<string>("");
  const [useImageStyle, setUseImageStyle] = useState(false);

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
    await Promise.all([fetchTitles(), fetchFontStyles()]);
    setLoading(false);
  };

  const fetchTitles = async () => {
    const { data, error } = await supabase
      .from("titles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading titles", error);
      toast.error("Could not load titles");
      return;
    }

    setTitles(data || []);
  };

  const fetchFontStyles = async () => {
    const { data, error } = await supabase
      .from("font_styles")
      .select("*")
      .order("is_system", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading font styles", error);
      return;
    }

    setFontStyles(data || []);
  };

  const handleSave = async () => {
    try {
      if (!name.trim() || !title.trim()) {
        toast.error("Name and title are required");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      setSaving(true);

      const { error } = await supabase.from("titles").insert({
        user_id: user.id,
        name,
        title,
        subtitle: subtitle || null,
        text_style: useImageStyle ? "Image Reference" : textStyle,
        custom_text_style: textStyle === "Custom" ? customTextStyle : null,
        text_position: textPosition,
        font_style_id: useImageStyle && fontStyleId ? fontStyleId : null,
      });

      if (error) throw error;

      toast.success("Title saved");
      setName("");
      setTitle("");
      setSubtitle("");
      setCustomTextStyle("");
      setFontStyleId("");
      setUseImageStyle(false);
      fetchTitles();
    } catch (error) {
      console.error("Error saving title:", error);
      toast.error("Failed to save title");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (titleRow: SavedTitle) => {
    try {
      const { error } = await supabase.from("titles").delete().eq("id", titleRow.id);
      if (error) throw error;

      toast.success("Title deleted");
      fetchTitles();
    } catch (error) {
      console.error("Error deleting title:", error);
      toast.error("Failed to delete title");
    }
  };

  const getFontStyleForTitle = (titleRow: SavedTitle) => {
    if (!titleRow.font_style_id) return null;
    return fontStyles.find(fs => fs.id === titleRow.font_style_id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading titles...
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
            <h2 className="text-2xl font-semibold leading-tight">Titles</h2>
            <p className="text-sm text-muted-foreground">
              Save your favorite title and subtitle pairs to reuse later.
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

        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Save a title</CardTitle>
              <CardDescription>
                Keep title ideas, copy, and text styling handy for future thumbnails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Element launch hook"
                />
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter your main headline"
                />
              </div>

              <div className="space-y-2">
                <Label>Subtitle</Label>
                <Textarea
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  rows={2}
                  placeholder="Optional supporting text"
                />
              </div>

              {/* Style Type Toggle */}
              <div className="space-y-2">
                <Label>Text style source</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={!useImageStyle ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseImageStyle(false)}
                    className="flex-1"
                  >
                    <TypeIcon className="w-4 h-4 mr-2" />
                    Preset Style
                  </Button>
                  <Button
                    type="button"
                    variant={useImageStyle ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseImageStyle(true)}
                    className="flex-1"
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Image Reference
                  </Button>
                </div>
              </div>

              {!useImageStyle ? (
                <>
                  <div className="space-y-2">
                    <Label>Text style</Label>
                    <Select value={textStyle} onValueChange={setTextStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEXT_STYLES.map((style) => (
                          <SelectItem key={style} value={style}>
                            {style}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {textStyle === "Custom" && (
                    <div className="space-y-2">
                      <Label>Custom style description</Label>
                      <Input
                        value={customTextStyle}
                        onChange={(e) => setCustomTextStyle(e.target.value)}
                        placeholder="e.g., neon glow with shadow, brush lettering"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Font style image</Label>
                  {fontStyles.length === 0 ? (
                    <div className="border border-dashed border-border rounded-lg p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        No font styles available yet.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/font-styles")}
                      >
                        Upload Font Styles
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                      {fontStyles.map((fs) => (
                        <button
                          key={fs.id}
                          type="button"
                          onClick={() => setFontStyleId(fs.id)}
                          className={`relative rounded-lg border-2 overflow-hidden transition-all ${
                            fontStyleId === fs.id
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="aspect-[4/3]">
                            <img
                              src={fs.image_url}
                              alt={fs.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                            <p className="text-[10px] text-white truncate">{fs.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs"
                      onClick={() => navigate("/font-styles")}
                    >
                      Manage font styles →
                    </Button>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Text position</Label>
                <Select value={textPosition} onValueChange={setTextPosition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos.value} value={pos.value}>
                        {pos.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-4 h-4 mr-2" />
                    Save title
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Saved titles</CardTitle>
              <CardDescription>
                Reuse these in the create flow and iterate without retyping.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {titles.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                  No titles saved yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {titles.map((titleRow) => {
                    const linkedFontStyle = getFontStyleForTitle(titleRow);
                    return (
                      <div
                        key={titleRow.id}
                        className="rounded-lg border border-border p-3 bg-card/60 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {linkedFontStyle ? (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                Image Style
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <TypeIcon className="w-3 h-3" />
                                {titleRow.text_style}
                              </Badge>
                            )}
                            <p className="font-medium truncate max-w-[180px]">{titleRow.name}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(titleRow)}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                        {linkedFontStyle && (
                          <div className="flex items-center gap-2">
                            <img
                              src={linkedFontStyle.image_url}
                              alt={linkedFontStyle.name}
                              className="w-12 h-9 object-cover rounded border border-border"
                            />
                            <span className="text-xs text-muted-foreground">
                              {linkedFontStyle.name}
                            </span>
                          </div>
                        )}
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{titleRow.title}</p>
                          {titleRow.subtitle && (
                            <p className="text-xs text-muted-foreground">{titleRow.subtitle}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{new Date(titleRow.created_at || "").toLocaleDateString()}</span>
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
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Titles;
