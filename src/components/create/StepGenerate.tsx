import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Download, Sparkles } from "lucide-react";
import { CreateData } from "@/pages/Create";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getGenerationLimitLabel, getGenerationWindowStart } from "@/lib/generationLimits";
import { DOWNLOAD_SIZES, DownloadSizeKey, downloadImageWithSize } from "@/lib/imageUtils";

interface Avatar {
  id: string;
  image_url: string;
}

interface ProductImage {
  id: string;
  image_url: string;
}

interface Product {
  id: string;
  title: string;
  brand: string;
  images: ProductImage[];
}

interface StepGenerateProps {
  data: CreateData;
  updateData: (updates: Partial<CreateData>) => void;
  onPrev: () => void;
}

export const StepGenerate = ({ data, updateData, onPrev }: StepGenerateProps) => {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || "16:9");
  const [avatarData, setAvatarData] = useState<Avatar | null>(null);
  const [productData, setProductData] = useState<Product[]>([]);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [remixing, setRemixing] = useState(false);
  const [remixDialogOpen, setRemixDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch avatar if selected
        if (data.avatarId && data.avatarId !== "video-frame") {
          const { data: avatar, error } = await supabase
            .from("avatars")
            .select("*")
            .eq("id", data.avatarId)
            .single();
          
          if (!error && avatar) {
            setAvatarData(avatar);
          }
        }

        // Fetch products if selected
        if (data.productIds && data.productIds.length > 0) {
          const { data: products, error } = await supabase
            .from("products")
            .select(`
              *,
              images:product_images(id, image_url)
            `)
            .in("id", data.productIds);
          
          if (!error && products) {
            setProductData(products);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [data.avatarId, data.productIds]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      updateData({ aspectRatio });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Check subscription and quota before generating
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
        setGenerating(false);
        return;
      }

      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-thumbnail",
        {
          body: { thumbnailData: { ...data, aspectRatio } },
        }
      );

      if (functionError) throw functionError;

      if (!functionData?.imageUrl) {
        throw new Error("No image URL returned");
      }

      setGeneratedImages((prev) => [...prev, functionData.imageUrl]);
      setSelectedImage(functionData.imageUrl);
      toast.success("Thumbnail generated successfully!");
    } catch (error: any) {
      console.error("Error generating thumbnail:", error);
      toast.error(error.message || "Failed to generate thumbnail");
    } finally {
      setGenerating(false);
    }
  };

  const handleRemix = async () => {
    if (!selectedImage) return;

    try {
      setRemixing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Check subscription and quota before remixing (remix also counts as a generation)
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
        setRemixing(false);
        return;
      }

      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-thumbnail",
        {
          body: { 
            thumbnailData: { ...data, aspectRatio },
            remixImageUrl: selectedImage,
            remixPrompt: remixPrompt
          },
        }
      );

      if (functionError) throw functionError;

      if (!functionData?.imageUrl) {
        throw new Error("No image URL returned");
      }

      setGeneratedImages((prev) => [...prev, functionData.imageUrl]);
      setSelectedImage(functionData.imageUrl);
      setRemixDialogOpen(false);
      setRemixPrompt("");
      toast.success("Remix generated successfully!");
    } catch (error: any) {
      console.error("Error remixing thumbnail:", error);
      toast.error(error.message || "Failed to remix thumbnail");
    } finally {
      setRemixing(false);
    }
  };

  const handleDownload = async (size: DownloadSizeKey) => {
    if (!selectedImage) return;

    const option = DOWNLOAD_SIZES[size];

    try {
      setDownloading(true);
      await downloadImageWithSize(selectedImage, {
        width: option.width,
        height: option.height,
        fileName: `thumbnail-${option.width}x${option.height}.png`,
      });
      toast.success(`${option.label} download started`);
    } catch (error: any) {
      console.error("Error downloading thumbnail:", error);
      toast.error(error?.message || "Failed to download thumbnail");
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedImage) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase.from("thumbnails").insert({
        user_id: user.id,
        title: data.title,
        subtitle: data.subtitle,
        avatar_id: data.avatarId,
        avatar_position: data.avatarPosition,
        avatar_importance: data.avatarImportance,
        product_id: data.productIds?.[0],
        product_position: data.productPosition,
        product_importance: data.productImportance,
        text_position: data.textPosition,
        text_importance: data.textImportance,
        expression: data.expression,
        visual_style: data.visualStyle || "",
        text_style: data.textStyle || "",
        background_type: data.backgroundType || "",
        background_value: data.backgroundValue,
        aspect_ratio: aspectRatio,
        image_url: selectedImage,
      });

      if (error) throw error;

      toast.success("Thumbnail saved!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error saving thumbnail:", error);
      toast.error("Failed to save thumbnail");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Generate Your Thumbnail</h2>
        <p className="text-muted-foreground">
          Review your selections and generate your thumbnail
        </p>
      </div>

      {/* Aspect Ratio Selection */}
      <div className="space-y-4">
        <Label className="text-lg font-semibold">Select Aspect Ratio</Label>
        <RadioGroup value={aspectRatio} onValueChange={setAspectRatio}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="16:9" id="youtube" />
            <Label htmlFor="youtube" className="cursor-pointer">
              YouTube (16:9) - Landscape
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="9:16" id="tiktok" />
            <Label htmlFor="tiktok" className="cursor-pointer">
              TikTok/Instagram (9:16) - Portrait
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        {/* Images Section */}
        <div className="grid grid-cols-2 gap-6">
          {/* Avatar Preview */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Avatar:</span>
            {avatarData ? (
              <div className="aspect-square rounded-lg overflow-hidden border border-border">
                <img
                  src={avatarData.image_url}
                  alt="Selected avatar"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="aspect-square rounded-lg overflow-hidden border border-dashed border-border bg-muted flex items-center justify-center">
                <span className="text-sm text-muted-foreground">No avatar</span>
              </div>
            )}
          </div>

          {/* Products Preview */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">
              Products: {productData.length > 0 ? `${productData.length} selected` : "None"}
            </span>
            {productData.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {productData.map((product) => (
                  <div key={product.id} className="space-y-1">
                    <div className="aspect-square rounded-lg overflow-hidden border border-border">
                      <img
                        src={product.images[0]?.image_url || "/placeholder.svg"}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs font-medium truncate">{product.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="aspect-square rounded-lg overflow-hidden border border-dashed border-border bg-muted flex items-center justify-center">
                <span className="text-sm text-muted-foreground">No products</span>
              </div>
            )}
          </div>
        </div>

        {/* Text Details */}
        <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-border">
          <div>
            <span className="text-muted-foreground">Title:</span>
            <span className="ml-2 font-medium">{data.title || "None"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Expression:</span>
            <span className="ml-2 font-medium">{data.expression || "Default"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Visual Style:</span>
            <span className="ml-2 font-medium">{data.visualStyle || "Default"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Text Style:</span>
            <span className="ml-2 font-medium">{data.textStyle || "Default"}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Background:</span>
            <span className="ml-2 font-medium">{data.backgroundValue || "None"}</span>
          </div>
        </div>
      </div>

      {/* Large Preview Section */}
      {selectedImage && (
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Preview</Label>
          <div className="relative group">
            <div className={`${aspectRatio === "16:9" ? "aspect-video" : "aspect-[9/16] max-w-md mx-auto"} rounded-lg overflow-hidden border border-border`}>
              <img
                src={selectedImage}
                alt="Selected thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={!selectedImage || downloading}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {downloading ? "Downloading..." : "Download"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
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
              
              <Dialog open={remixDialogOpen} onOpenChange={setRemixDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Remix
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Remix Thumbnail</DialogTitle>
                    <DialogDescription>
                      Add custom instructions to create a variation of this thumbnail
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Textarea
                      placeholder="E.g., Make the background more vibrant, change text color to blue, add motion blur effect..."
                      value={remixPrompt}
                      onChange={(e) => setRemixPrompt(e.target.value)}
                      rows={4}
                    />
                    <Button 
                      onClick={handleRemix} 
                      disabled={remixing || !remixPrompt.trim()}
                      className="w-full"
                    >
                      {remixing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating Remix...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Remix
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      )}

      {/* Generated Thumbnails List */}
      {generatedImages.length > 0 && (
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Generated Thumbnails</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {generatedImages.map((imageUrl, index) => (
              <button
                key={index}
                onClick={() => setSelectedImage(imageUrl)}
                className={`${aspectRatio === "16:9" ? "aspect-video" : "aspect-[9/16]"} rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                  selectedImage === imageUrl 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                <img
                  src={imageUrl}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <Button variant="outline" onClick={onPrev} disabled={generating || remixing}>
          Back
        </Button>
        {generatedImages.length === 0 ? (
          <Button onClick={handleGenerate} disabled={generating} className="flex-1">
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Thumbnail"
            )}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleGenerate} disabled={generating || remixing} className="flex-1">
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Another"
              )}
            </Button>
            <Button onClick={handleSave} disabled={!selectedImage || generating || remixing} className="flex-1">
              Save & Finish
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
