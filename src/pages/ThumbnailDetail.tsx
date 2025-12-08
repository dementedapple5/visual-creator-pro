import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Trash2, Wand2, Palette, Type, Image as ImageIcon, Smile, Monitor } from "lucide-react";
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [iterating, setIterating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    checkUser();
    fetchThumbnail();
  }, [id]);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    const onSelect = () => {
      setCurrentVersionIndex(carouselApi.selectedScrollSnap());
      const currentVersion = versions[carouselApi.selectedScrollSnap()];
      if (currentVersion && thumbnail) {
         // Update the displayed image url in thumbnail state so download works for the visible version
         setThumbnail(prev => prev ? ({ ...prev, image_url: currentVersion.image_url }) : null);
      }
    };

    carouselApi.on("select", onSelect);
    
    // Set initial selection to last item
    if (versions.length > 0) {
       carouselApi.scrollTo(versions.length - 1);
    }
    
    return () => {
        carouselApi.off("select", onSelect);
    };

  }, [carouselApi, versions.length]); // removed thumbnail dependency to avoid loop, handled inside

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
          created_at: data.created_at 
        };

        if (!versionsError && versionsData && versionsData.length > 0) {
          // Check if the original image is already in the versions (to avoid duplicates)
          const originalAlreadyExists = versionsData.some(
            (v) => v.image_url === data.image_url
          );

          if (originalAlreadyExists) {
            // Just use the versions from the table
            setVersions(versionsData);
          } else {
            // Prepend the original image as the first version
            setVersions([originalVersion, ...versionsData]);
          }
          setCurrentVersionIndex(versionsData.length - (originalAlreadyExists ? 1 : 0));
        } else {
          // No versions in table, use just the original thumbnail image
          setVersions([originalVersion]);
          setCurrentVersionIndex(0);
        }
      } catch (vError) {
         console.warn("Could not fetch versions, defaulting to single image", vError);
         setVersions([{ 
            id: "original", 
            image_url: data.image_url, 
            created_at: data.created_at 
         }]);
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

      const { count } = await supabase
        .from("generations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("created_at", countStartDate);

      const usedGenerations = count || 0;
      if (usedGenerations >= monthlyLimit) {
        const limitType = getGenerationLimitLabel(subscriptionData || {});
        toast.error(`${limitType} limit reached. ${limitType === "Daily" ? "Free users can create 1 thumbnail per day. Upgrade to create more." : "You've used all your thumbnails for this billing period."}`);
        setIterating(false);
        return;
      }

      // Get the currently selected version's image URL to use as reference
      const currentVersionImageUrl = versions[currentVersionIndex]?.image_url || thumbnail.image_url;

      // Generate a new version based on the current image and the prompt
      const { data: result, error } = await supabase.functions.invoke("generate-thumbnail", {
        body: {
          thumbnailId: id, // Pass the thumbnail ID to link the generation for dashboard loading state
          // Send the current version's image as the base for iteration
          iterationImageUrl: currentVersionImageUrl,
          iterationPrompt: prompt,
          thumbnailData: {
            aspectRatio: thumbnail.aspect_ratio,
          },
        },
      });

      if (error) throw error;

      // Insert new version to thumbnail_versions (don't update thumbnail.image_url)
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
        // Fallback to just updating state without version ID if save failed
        const tempVersion: ThumbnailVersion = {
          id: `temp-${Date.now()}`,
          image_url: result.imageUrl,
          created_at: new Date().toISOString(),
          prompt: prompt
        };
        setVersions(prev => [...prev, tempVersion]);
      } else {
        setVersions(prev => [...prev, newVersion]);
      }

      // Update local state to show the new version (for immediate UI feedback)
      setThumbnail({ ...thumbnail, image_url: result.imageUrl });
      setPrompt("");
      
      // Scroll to new version
      setTimeout(() => {
        if (carouselApi) {
           carouselApi.scrollTo(versions.length + 1); // +1 because we just added one
        }
      }, 100);

      toast.success("Thumbnail updated successfully!");
    } catch (error) {
      console.error("Error iterating thumbnail:", error);
      toast.error("Failed to update thumbnail");
    } finally {
      setIterating(false);
    }
  };

  const handleDownload = async (size: DownloadSizeKey) => {
    if (!thumbnail) return;

    const option = DOWNLOAD_SIZES[size];

    try {
      setDownloading(true);
      await downloadImageWithSize(thumbnail.image_url, {
        width: option.width,
        height: option.height,
        fileName: `${thumbnail.title || "thumbnail"}-${option.width}x${option.height}.png`,
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
      // Delete from database first
      const { error: dbError } = await supabase
        .from("thumbnails")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      // Extract storage path and delete from storage
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
    <div className="min-h-screen relative">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-float-delayed" />
      </div>

      <main className="container mx-auto px-6 py-12 pl-20 relative z-10">
        <div className="mb-8 flex justify-between items-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/dashboard")}
            className="glass-button rounded-full px-4 py-2 hover:bg-white/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  className="glass-button rounded-full px-5 py-2 hover:bg-white/20 transition-all text-white"
                  disabled={downloading}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {downloading ? "Downloading..." : "Download"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Select size</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => handleDownload("youtube")}
                  disabled={downloading}
                >
                  {DOWNLOAD_SIZES.youtube.label}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDownload("full")}
                  disabled={downloading}
                >
                  {DOWNLOAD_SIZES.full.label}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteDialog(true)}
              className="rounded-full px-5 py-2 hover:bg-destructive/90 transition-all"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Preview */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
                {thumbnail.title || "Untitled"}
              </h1>
              <p className="text-muted-foreground text-lg">
                {thumbnail.subtitle || "No description"}
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                Created: {new Date(thumbnail.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="glass-panel rounded-3xl p-6">
              <div 
                className={`rounded-2xl overflow-hidden border border-white/10 bg-black/20 relative group ${
                  thumbnail.aspect_ratio === "9:16" ? "max-w-md mx-auto" : ""
                }`}
                style={{ aspectRatio: thumbnail.aspect_ratio.replace(":", "/") }}
              >
                <Carousel setApi={setCarouselApi} className="w-full h-full">
                  <CarouselContent className="h-full -ml-0">
                    {versions.length > 0 ? (
                      versions.map((version) => (
                        <CarouselItem key={version.id} className="pl-0 h-full">
                          <img
                            src={version.image_url}
                            alt={thumbnail.title || "Thumbnail"}
                            className="w-full h-full object-cover"
                          />
                        </CarouselItem>
                      ))
                    ) : (
                      <CarouselItem className="pl-0 h-full">
                         <img
                            src={thumbnail.image_url}
                            alt={thumbnail.title || "Thumbnail"}
                            className="w-full h-full object-cover"
                          />
                      </CarouselItem>
                    )}
                  </CarouselContent>
                  {versions.length > 1 && (
                    <>
                      <CarouselPrevious className="left-4 bg-black/50 border-white/20 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CarouselNext className="right-4 bg-black/50 border-white/20 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </>
                  )}
                </Carousel>
              </div>
              {versions.length > 1 && (
                <div className="mt-4 flex justify-center">
                   <span className="text-sm text-muted-foreground bg-black/20 px-3 py-1 rounded-full border border-white/10">
                    Version {currentVersionIndex + 1} of {versions.length}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Iteration Panel */}
          <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-6 space-y-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">Iterate & Improve</h2>
                <p className="text-muted-foreground">
                  Describe what changes you'd like to make to this thumbnail
                </p>
              </div>

              <div className="space-y-4">
                <Textarea
                  placeholder="E.g., Make the background more vibrant, add a gradient effect, change the text color to blue..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  className="resize-none bg-white/5 border-white/10 backdrop-blur-sm focus:bg-white/10 focus:border-white/20 transition-all"
                />
                <Button
                  onClick={handleIterate}
                  disabled={!prompt.trim() || iterating}
                  className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 border-0 text-white font-semibold shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  size="lg"
                >
                  <Wand2 className="w-5 h-5 mr-2" />
                  {iterating ? "Generating..." : "Generate New Version"}
                </Button>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6 space-y-6">
              <h3 className="font-semibold text-lg">Current Settings</h3>
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 text-sm backdrop-blur-sm">
                  <Palette className="w-4 h-4 text-purple-400" />
                  <span className="font-medium text-white">{thumbnail.visual_style}</span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-500/30 text-sm backdrop-blur-sm">
                  <Type className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-white">{thumbnail.text_style}</span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/20 border border-pink-500/30 text-sm backdrop-blur-sm">
                  <ImageIcon className="w-4 h-4 text-pink-400" />
                  <span className="font-medium text-white">{thumbnail.background_type}</span>
                </div>
                {thumbnail.expression && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30 text-sm backdrop-blur-sm">
                    <Smile className="w-4 h-4 text-green-400" />
                    <span className="font-medium text-white">{thumbnail.expression}</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/20 border border-orange-500/30 text-sm backdrop-blur-sm">
                  <Monitor className="w-4 h-4 text-orange-400" />
                  <span className="font-medium text-white">{thumbnail.aspect_ratio}</span>
                </div>
              </div>

              {/* Avatar Section */}
              {avatar && (
                <div className="pt-6 border-t border-white/10">
                  <h4 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">Avatar Used</h4>
                  <div className="w-24 h-24 rounded-full overflow-hidden border border-white/10">
                    <img
                      src={avatar.image_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Element Section */}
              {products.length > 0 && (
                <div className="pt-6 border-t border-white/10">
                  <h4 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">Elements Used</h4>
                  <div className="flex justify-start">
                    <div className="flex -space-x-6">
                      {products.map((product, index) => (
                        product.images?.[0] && (
                          <button
                            key={product.id}
                            onClick={() => navigate(`/products/${product.id}`)}
                            className="group relative"
                            style={{ zIndex: products.length - index }}
                          >
                            <div className="w-24 h-24 rounded-full overflow-hidden border border-white/10 flex-shrink-0 group-hover:border-white/20 transition-colors shadow-lg">
                              <img
                                src={product.images[0].image_url}
                                alt={product.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="glass-panel border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone. This will permanently delete your thumbnail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass-button rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
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
