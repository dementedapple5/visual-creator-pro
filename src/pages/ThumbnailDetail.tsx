import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Trash2, Bot, Palette, Type, Image as ImageIcon, Smile, Monitor, CalendarDays, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { DOWNLOAD_SIZES, DownloadSizeKey, downloadImageWithSize, extractStoragePath } from "@/lib/imageUtils";
import { getGenerationLimitLabel, getGenerationWindowStart } from "@/lib/generationLimits";
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
  product_ids?: string[];
  visual_style: string;
  text_style: string;
  background_type: string;
  background_value: string | null;
  expression: string | null;
  aspect_ratio: string;
  created_at: string;
}

interface ThumbnailVersion {
  id: string;
  image_url: string;
  created_at: string;
  prompt?: string;
}

interface Avatar {
  id: string;
  image_url: string;
}

interface Product {
  id: string;
  title: string;
  brand: string;
  images: { image_url: string }[];
}

const ThumbnailDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [thumbnail, setThumbnail] = useState<Thumbnail | null>(null);
  const [versions, setVersions] = useState<ThumbnailVersion[]>([]);
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [iterating, setIterating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ThumbnailVersion | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkUser();
    fetchThumbnail();
  }, [id]);

  useEffect(() => {
    // Scroll to bottom when new versions are added
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [versions.length]);

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

      // Fetch versions
      try {
        const { data: versionsData, error: versionsError } = await supabase
          .from("thumbnail_versions")
          .select("*")
          .eq("thumbnail_id", id)
          .order("created_at", { ascending: true });

        // Always include the original thumbnail image as the first version
        const originalVersion: ThumbnailVersion = {
          id: "original",
          image_url: data.image_url,
          created_at: data.created_at,
          prompt: "Original generation"
        };

        if (!versionsError && versionsData && versionsData.length > 0) {
          const originalAlreadyExists = versionsData.some(
            (v) => v.image_url === data.image_url
          );

          if (originalAlreadyExists) {
            setVersions(versionsData);
            setSelectedVersion(versionsData[versionsData.length - 1]);
          } else {
            setVersions([originalVersion, ...versionsData]);
            setSelectedVersion(versionsData[versionsData.length - 1]);
          }
        } else {
          setVersions([originalVersion]);
          setSelectedVersion(originalVersion);
        }
      } catch (vError) {
        console.warn("Could not fetch versions, defaulting to single image", vError);
        const originalVersion = {
          id: "original",
          image_url: data.image_url,
          created_at: data.created_at,
          prompt: "Original generation"
        };
        setVersions([originalVersion]);
        setSelectedVersion(originalVersion);
      }

      // Fetch avatar if exists
      if (data.avatar_id) {
        const { data: avatarData, error: avatarError } = await supabase
          .from("avatars")
          .select("id, image_url")
          .eq("id", data.avatar_id)
          .single();

        if (!avatarError && avatarData) {
          setAvatar(avatarData);
        }
      }

      // Fetch products if they exist (supports multiple)
      const productIds: string[] =
        Array.isArray((data as any).product_ids) && (data as any).product_ids.length > 0
          ? (data as any).product_ids
          : data.product_id
            ? [data.product_id]
            : [];

      if (productIds.length > 0) {
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select(`
            id,
            title,
            brand,
            images:product_images(image_url)
          `)
          .in("id", productIds);

        if (!productsError && productsData) {
          const orderedProducts = productIds
            .map((pid) => productsData.find((p) => p.id === pid))
            .filter((p): p is Product => Boolean(p));
          setProducts(orderedProducts);
        }
      } else {
        setProducts([]);
      }
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data: subscriptionData } = await supabase.functions.invoke("check-subscription");
      const monthlyLimit = subscriptionData?.monthly_limit || 1;
      const countStartDate = getGenerationWindowStart(subscriptionData || {});

      const { data: usageData } = await supabase
        .from("generations")
        .select("credits_used")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("created_at", countStartDate);

      const usedGenerations = usageData?.reduce((acc, curr) => acc + (curr.credits_used || 0), 0) || 0;
      
      const isSuperAdmin = subscriptionData?.is_super_admin === true;

      if (!isSuperAdmin && usedGenerations >= monthlyLimit) {
        const limitType = getGenerationLimitLabel(subscriptionData || {});
        toast.error(`${limitType} limit reached. ${limitType === "Daily" ? "Free users get 1 credit per day. Upgrade to create more." : "You've used all your credits for this billing period."}`);
        setIterating(false);
        return;
      }

      // Get the currently selected version's image URL to use as reference
      const currentVersionImageUrl = selectedVersion?.image_url || thumbnail.image_url;

      // Generate a new version based on the current image and the prompt
      const { data: result, error } = await supabase.functions.invoke("generate-thumbnail", {
        body: {
          thumbnailId: id,
          iterationImageUrl: currentVersionImageUrl,
          iterationPrompt: prompt,
          thumbnailData: {
            aspectRatio: thumbnail.aspect_ratio,
          },
          creditsUsed: 1 // Iteration uses 1 credit
        },
      });

      if (error) throw error;

      // Insert new version to thumbnail_versions
      const { data: newVersion, error: versionError } = await supabase
        .from("thumbnail_versions")
        .insert({
          thumbnail_id: id,
          image_url: result.imageUrl,
          prompt: prompt
        })
        .select()
        .single();

      if (versionError) {
        console.error("Error saving version:", versionError);
        const tempVersion: ThumbnailVersion = {
          id: `temp-${Date.now()}`,
          image_url: result.imageUrl,
          created_at: new Date().toISOString(),
          prompt: prompt
        };
        setVersions(prev => [...prev, tempVersion]);
        setSelectedVersion(tempVersion);
      } else {
        setVersions(prev => [...prev, newVersion]);
        setSelectedVersion(newVersion);
      }

      setThumbnail({ ...thumbnail, image_url: result.imageUrl });
      setPrompt("");

      toast.success("New version generated!");
    } catch (error) {
      console.error("Error iterating thumbnail:", error);
      toast.error("Failed to generate new version");
    } finally {
      setIterating(false);
    }
  };

  const handleDownload = async (size: DownloadSizeKey) => {
    if (!selectedVersion) return;

    const option = DOWNLOAD_SIZES[size];

    try {
      setDownloading(true);
      await downloadImageWithSize(selectedVersion.image_url, {
        width: option.width,
        height: option.height,
        fileName: `${thumbnail?.title || "thumbnail"}-${option.width}x${option.height}.png`,
      });
      toast.success(`${option.label} download started`);
    } catch (error) {
      console.error("Error downloading thumbnail:", error);
      toast.error("Failed to download thumbnail");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!thumbnail) return;

    try {
      const { error: dbError } = await supabase
        .from("thumbnails")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleIterate();
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="hidden sm:block">
              <h1 className="text-sm font-medium text-foreground truncate max-w-[200px]">
                {thumbnail.title || "Untitled"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {versions.length} version{versions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleDownload("youtube")}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-4"
              disabled={downloading}
            >
              <Download className="w-4 h-4 mr-2" />
              {downloading ? "..." : "Download"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Summary - Visible only on mobile */}
      <div className="lg:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {avatar && (
            <div className="w-7 h-7 rounded-full overflow-hidden border border-border">
              <img src={avatar.image_url} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-border text-muted-foreground">
              {thumbnail.aspect_ratio}
            </Badge>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-border text-muted-foreground">
              {thumbnail.visual_style}
            </Badge>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider">
          {versions.length} versions
        </span>
      </div>

      {/* Main Content - Chat Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Scrollable Chat */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Versions as Chat Messages */}
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className={`group animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Prompt/Label */}
                  {version.prompt && (
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-relaxed">
                          {version.prompt}
                        </p>
                        <span className="text-xs text-muted-foreground mt-1 block">
                          {formatTime(version.created_at)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Image */}
                  <div
                    className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${selectedVersion?.id === version.id
                      ? "border-rose-500/50 shadow-lg shadow-rose-500/10"
                      : "border-border hover:border-border/80"
                      }`}
                    onClick={() => setSelectedVersion(version)}
                  >
                    <div
                      className="bg-muted"
                      style={{ aspectRatio: thumbnail.aspect_ratio.replace(":", "/") }}
                    >
                      <img
                        src={version.image_url}
                        alt={`Version ${index + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Selection indicator */}
                    {selectedVersion?.id === version.id && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-background rounded border border-border text-xs font-medium text-foreground">
                        Selected
                      </div>
                    )}

                    {/* Version number */}
                    <div className="absolute bottom-3 left-3 px-2 py-1 bg-background/60 backdrop-blur-sm rounded-lg text-xs text-foreground/70">
                      v{index + 1}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator for new generation */}
              {iterating && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center flex-shrink-0 animate-pulse">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{prompt}</p>
                    </div>
                  </div>
                  <div
                    className="rounded-xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center"
                    style={{ aspectRatio: thumbnail.aspect_ratio.replace(":", "/") }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-muted-foreground">Generating...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="border-t border-border bg-background p-4">
            <div className="max-w-3xl mx-auto">
              <div className="relative bg-muted/50 rounded-xl border border-border focus-within:border-primary/50 transition-colors flex items-center">
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe changes to generate a new version..."
                  rows={1}
                  disabled={iterating}
                  className="flex-1 bg-transparent text-foreground placeholder-muted-foreground/50 px-4 py-3 pr-14 resize-none focus:outline-none text-sm leading-relaxed min-h-[44px] max-h-[120px]"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />

                {/* Action buttons */}
                <div className="pr-2 flex items-center gap-1">
                  <Button
                    size="sm"
                    onClick={handleIterate}
                    disabled={!prompt.trim() || iterating}
                    className={`rounded-full w-9 h-9 p-0 transition-all ${prompt.trim() && !iterating
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-muted-foreground"
                      }`}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>

        {/* Preview Panel - Desktop only */}
        <div className="hidden lg:block w-80 border-l border-border bg-card p-4 overflow-y-auto">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Selected Version
          </h3>

          {selectedVersion && (
            <div className="space-y-4">
              <div
                className="rounded-[8px] overflow-hidden border border-border"
                style={{ aspectRatio: thumbnail.aspect_ratio.replace(":", "/") }}
              >
                <img
                  src={selectedVersion.image_url}
                  alt="Selected version"
                  className="w-full h-full object-contain bg-muted"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-foreground">
                    {new Date(selectedVersion.created_at).toLocaleDateString()}
                  </span>
                </div>
                {selectedVersion.prompt && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground block mb-1">Prompt</span>
                    <p className="text-xs text-foreground leading-relaxed">
                      {selectedVersion.prompt}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Title and Versions - First */}
          <div className="mt-6 pt-4 border-t border-border">
            <div className="space-y-3">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Title</span>
                <p className="text-xs text-foreground leading-relaxed line-clamp-2">
                  {thumbnail.title || "Untitled"}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Versions</span>
                <span className="text-xs text-foreground">{versions.length}</span>
              </div>
            </div>
          </div>

          {/* Generation Settings - Compact badges */}
          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Generation Settings
            </h3>
            <div className="flex flex-wrap gap-1.5 mb-4">
              <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 border-border rounded-[4px]">
                <Palette className="w-2.5 h-2.5 mr-2 text-purple-400" />
                {thumbnail.visual_style}
              </Badge>
              <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 border-border rounded-[4px]">
                <Type className="w-2.5 h-2.5 mr-2 text-blue-400" />
                {thumbnail.text_style}
              </Badge>
              <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 border-border rounded-[4px]">
                <ImageIcon className="w-2.5 h-2.5 mr-2 text-pink-400" />
                {thumbnail.background_type}
              </Badge>
              {thumbnail.expression && (
                <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 border-border rounded-[4px]">
                  <Smile className="w-2.5 h-2.5 mr-2 text-green-400" />
                  {thumbnail.expression}
                </Badge>
              )}
              <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 border-border rounded-[4px]">
                <Monitor className="w-2.5 h-2.5 mr-2 text-orange-400" />
                {thumbnail.aspect_ratio}
              </Badge>
            </div>

            {/* Assets row */}
            {(avatar || products.length > 0) && (
              <div className="flex items-center gap-2">
                {avatar && (
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-border">
                    <img src={avatar.image_url} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                )}
                {products.map((product) => (
                  product.images?.[0] && (
                    <div
                      key={product.id}
                      className="w-8 h-8 rounded-lg overflow-hidden border border-border cursor-pointer hover:border-border/30"
                      onClick={() => navigate(`/products/${product.id}`)}
                    >
                      <img src={product.images[0].image_url} alt={product.title} className="w-full h-full object-cover" />
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone. This will permanently delete your thumbnail and all versions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground border-border hover:bg-secondary/80">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ThumbnailDetail;
