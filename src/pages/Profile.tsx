import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { compressAndConvertToJpg, extractStoragePath } from "@/lib/imageUtils";

interface Avatar {
  id: string;
  image_url: string;
  created_at: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    checkUser();
    fetchAvatars();
  }, []);

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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Compress and convert to JPG
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

      const { error: dbError } = await supabase
        .from("avatars")
        .insert({ user_id: user.id, image_url: publicUrl });

      if (dbError) throw dbError;

      toast.success("Avatar uploaded successfully");
      fetchAvatars();
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (avatar: Avatar) => {
    try {
      // Delete from database first
      const { error: dbError } = await supabase
        .from("avatars")
        .delete()
        .eq("id", avatar.id);

      if (dbError) throw dbError;

      // Extract storage path and delete from storage
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

  return (
    <div className="min-h-screen">
      {/* Main Content */}
      <main className="container mx-auto px-6 py-12 pl-20 max-w-4xl">
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-2">Your Avatars</h2>
            <p className="text-muted-foreground mb-6">
              Upload high-quality headshots to use in your thumbnails
            </p>

            <div className="mb-6">
              <label htmlFor="avatar-upload">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG up to 10MB
                  </p>
                </div>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {avatars.length === 0 ? (
              <div className="text-center py-12 border border-border rounded-lg">
                <p className="text-muted-foreground">No avatars uploaded yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {avatars.map((avatar) => (
                  <div key={avatar.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden border border-border">
                      <img
                        src={avatar.image_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(avatar)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
