import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, User, Image as ImageIcon } from "lucide-react";
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
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">ThumbnailCraft</h1>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate("/profile")}>
                <User className="w-4 h-4 mr-2" />
                Profile
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Your Thumbnails</h2>
            <p className="text-muted-foreground">Create and manage your thumbnail designs</p>
          </div>
          <Button size="lg" onClick={() => navigate("/create")}>
            <Plus className="w-5 h-5 mr-2" />
            Create New
          </Button>
        </div>

        {/* Thumbnails Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-video bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : thumbnails.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No thumbnails yet</h3>
            <p className="text-muted-foreground mb-6">Create your first thumbnail to get started</p>
            <Button onClick={() => navigate("/create")}>
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Thumbnail
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {thumbnails.map((thumbnail) => (
              <div key={thumbnail.id} className="group cursor-pointer">
                <div className="aspect-video rounded-lg overflow-hidden border border-border hover:border-primary transition-colors">
                  <img
                    src={thumbnail.image_url}
                    alt={thumbnail.title || "Thumbnail"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-2">
                  <p className="font-medium truncate">{thumbnail.title || "Untitled"}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(thumbnail.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
