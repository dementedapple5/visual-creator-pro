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
import { Loader2, Sparkles, Trash2, Type as TypeIcon, BookmarkPlus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type SavedTitle = Tables<"titles">;

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [textStyle, setTextStyle] = useState<string>("Bold & Large");
  const [customTextStyle, setCustomTextStyle] = useState("");
  const [textPosition, setTextPosition] = useState<string>("top-center");

  useEffect(() => {
    checkUser();
    fetchTitles();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
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
    setLoading(false);
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
        text_style: textStyle,
        custom_text_style: textStyle === "Custom" ? customTextStyle : null,
        text_position: textPosition,
      });

      if (error) throw error;

      toast.success("Title saved");
      setName("");
      setTitle("");
      setSubtitle("");
      setCustomTextStyle("");
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
      <main className="container mx-auto px-6 py-12 pl-20 max-w-6xl space-y-8">
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
                  placeholder="e.g., Product launch hook"
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
                  {titles.map((titleRow) => (
                    <div
                      key={titleRow.id}
                      className="rounded-lg border border-border p-3 bg-card/60 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <TypeIcon className="w-3 h-3" />
                            {titleRow.text_style}
                          </Badge>
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

export default Titles;

