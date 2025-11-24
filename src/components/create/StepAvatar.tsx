import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreateData } from "@/pages/Create";

interface StepAvatarProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onNext: () => void;
}

interface Avatar {
  id: string;
  image_url: string;
}

export const StepAvatar = ({ data, updateData, onNext }: StepAvatarProps) => {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvatars();
  }, []);

  const fetchAvatars = async () => {
    try {
      const { data: avatarData, error } = await supabase
        .from("avatars")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAvatars(avatarData || []);
    } catch (error) {
      console.error("Error fetching avatars:", error);
      toast.error("Failed to load avatars");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (id: string) => {
    updateData({ avatarId: id });
  };

  const handleSkip = () => {
    updateData({ avatarId: undefined });
    onNext();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Select Your Avatar</h2>
        <p className="text-muted-foreground">
          Choose an avatar to feature in your thumbnail (optional)
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : avatars.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-lg">
          <p className="text-muted-foreground mb-4">No avatars uploaded yet</p>
          <Button variant="outline" onClick={() => window.location.href = "/profile"}>
            Upload Avatars
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {avatars.map((avatar) => (
            <div
              key={avatar.id}
              onClick={() => handleSelect(avatar.id)}
              className={`aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                data.avatarId === avatar.id
                  ? "border-primary ring-4 ring-primary/20"
                  : "border-border hover:border-primary"
              }`}
            >
              <img
                src={avatar.image_url}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-4 pt-8">
        <Button variant="outline" onClick={handleSkip} className="flex-1">
          Skip
        </Button>
        <Button onClick={onNext} disabled={!data.avatarId} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
};
