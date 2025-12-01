import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, User, Image as ImageIcon, Package } from "lucide-react";
import { toast } from "sonner";

interface Thumbnail {
  id: string;
  title: string | null;
  image_url: string;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    fetchThumbnails();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchThumbnails = async () => {
    try {
      const { data, error } = await supabase
        .from("thumbnails")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setThumbnails(data || []);
    } catch (error) {
      console.error("Error fetching thumbnails:", error);
      toast.error("Failed to load thumbnails");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1">Your Thumbnails</h1>
          <p className="text-sm text-muted-foreground">Browse and manage your creations</p>
        </div>

        {loading ? (
          <div className="flex flex-wrap gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-48 w-80 bg-secondary rounded-lg animate-pulse" />
            ))}
          </div>
        ) : thumbnails.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">No thumbnails yet. Create your first one!</p>
            <Button onClick={() => navigate("/create")} size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Create Thumbnail
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {thumbnails.map((thumbnail) => (
              <div
                key={thumbnail.id}
                className="group cursor-pointer relative"
                onClick={() => navigate(`/thumbnail/${thumbnail.id}`)}
              >
                <div className="relative bg-secondary rounded-lg overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all">
                  <img
                    src={thumbnail.image_url}
                    alt={thumbnail.title || "Thumbnail"}
                    className="h-48 w-auto object-cover"
                  />
                </div>
                {thumbnail.title && (
                  <p className="mt-1.5 text-xs text-muted-foreground truncate max-w-[200px]">
                    {thumbnail.title}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
