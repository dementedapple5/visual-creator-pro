import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  Plus,
  Trash2,
  Edit2,
  Copy,
  Calendar,
} from "lucide-react";
import { extractStoragePath } from "@/lib/imageUtils";

interface Sketch {
  id: string;
  user_id: string;
  name: string;
  data: any;
  preview_url: string;
  created_at: string;
  updated_at: string;
}

const Sketches = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    fetchSketches();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchSketches = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("sketches")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading sketches", error);
      toast.error(t("sketches.errors.failedLoad") || "Could not load sketches");
      setLoading(false);
      return;
    }

    setSketches(data || []);
    setLoading(false);
  };

  const handleDelete = async (sketch: Sketch) => {
    if (!window.confirm(t("sketches.deleteConfirm"))) return;

    try {
      const { error } = await (supabase as any)
        .from("sketches")
        .delete()
        .eq("id", sketch.id);

      if (error) throw error;

      if (sketch.preview_url) {
        const storagePath = extractStoragePath(sketch.preview_url, "sketches");
        if (storagePath) {
          await supabase.storage.from("sketches").remove([storagePath]);
        }
      }

      toast.success(t("sketches.deleted"));
      fetchSketches();
    } catch (error) {
      console.error("Error deleting sketch:", error);
      toast.error(t("sketches.deleteError"));
    }
  };

  const handleDuplicate = async (sketch: Sketch) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await (supabase as any).from("sketches").insert({
        user_id: user.id,
        name: `${sketch.name} (${t("common.copy") || "Copy"})`,
        data: sketch.data,
        preview_url: sketch.preview_url, // Reuse same preview for now or null
      });

      if (error) throw error;

      toast.success(t("sketches.duplicateSuccess"));
      fetchSketches();
    } catch (error) {
      console.error("Error duplicating sketch:", error);
      toast.error(t("sketches.duplicateError"));
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("sketches.title")}</h1>
            <p className="text-muted-foreground">
              {t("sketches.subtitle")}
            </p>
          </div>
          <Button onClick={() => navigate("/sketch")} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            {t("sketches.newSketch")}
          </Button>
        </div>

        {sketches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed border-border text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Edit2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">{t("sketches.noSketches")}</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                {t("sketches.noSketchesDesc")}
              </p>
            </div>
            <Button onClick={() => navigate("/sketch")} variant="outline">
              {t("sketches.startNow")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sketches.map((sketch) => (
              <Card key={sketch.id} className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50">
                <div 
                  className="aspect-video relative cursor-pointer overflow-hidden bg-muted"
                  onClick={() => navigate(`/sketch?id=${sketch.id}`)}
                >
                  {sketch.preview_url ? (
                    <img
                      src={sketch.preview_url}
                      alt={sketch.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Edit2 className="w-8 h-8 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/sketch?id=${sketch.id}`);
                      }}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </div>
                <CardHeader className="p-4 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold truncate leading-tight">
                      {sketch.name}
                    </CardTitle>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleDuplicate(sketch)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(sketch)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(sketch.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sketches;
