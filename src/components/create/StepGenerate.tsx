import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Download, Sparkles, Grid3X3, Check } from "lucide-react";
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
import { DOWNLOAD_SIZES, DownloadSizeKey, downloadImageWithSize, uploadDataUrlToStorage, isDataUrl } from "@/lib/imageUtils";

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

const GRID_SIZE = 3; // 3x3 grid

/**
 * Crops a 3x3 grid image into 9 individual thumbnails
 */
const cropGridToThumbnails = async (gridImageUrl: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const thumbnails: string[] = [];
      const cellWidth = Math.floor(img.width / GRID_SIZE);
      const cellHeight = Math.floor(img.height / GRID_SIZE);

      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          const canvas = document.createElement("canvas");
          canvas.width = cellWidth;
          canvas.height = cellHeight;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          // Crop the cell from the grid image
          ctx.drawImage(
            img,
            col * cellWidth,      // Source X
            row * cellHeight,     // Source Y
            cellWidth,            // Source width
            cellHeight,           // Source height
            0,                    // Destination X
            0,                    // Destination Y
            cellWidth,            // Destination width
            cellHeight            // Destination height
          );

          // Convert to data URL
          const thumbnailUrl = canvas.toDataURL("image/png");
          thumbnails.push(thumbnailUrl);
        }
      }

      resolve(thumbnails);
    };

    img.onerror = () => {
      reject(new Error("Failed to load grid image"));
    };

    img.src = gridImageUrl;
  });
};

export const StepGenerate = ({ data, updateData, onPrev }: StepGenerateProps) => {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [croppingGrid, setCroppingGrid] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || "16:9");
  const [avatarData, setAvatarData] = useState<Avatar | null>(null);
  const [productData, setProductData] = useState<Product[]>([]);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [remixing, setRemixing] = useState(false);
  const [remixDialogOpen, setRemixDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [gridImageUrl, setGridImageUrl] = useState<string | null>(null);

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

      const { data: usageData } = await supabase
        .from("generations")
        .select("credits_used")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("created_at", countStartDate);

      const usedGenerations = usageData?.reduce((acc, curr) => acc + (curr.credits_used || 0), 0) || 0;

      if (usedGenerations >= monthlyLimit) {
        const limitType = getGenerationLimitLabel(subscriptionData || {});
        toast.error(`${limitType} limit reached. ${limitType === "Daily" ? "Free users can create 1 thumbnail per day. Upgrade to create more." : "You've used all your thumbnails for this billing period."}`);
        setGenerating(false);
        return;
      }

      // Prepare thumbnail data with grid mode enabled
      const thumbnailData = {
        ...data,
        aspectRatio,
        gridMode: true, // Enable grid mode for 3x3 generation
      };

      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-thumbnail",
        {
          body: { 
            thumbnailData,
            creditsUsed: 4 // 3x3 grid uses 4 credits
          },
        }
      );

      if (functionError) throw functionError;

      // Handle grid mode response (base64) vs single mode (URL)
      let gridImageSource: string;
      if (functionData?.imageBase64) {
        // Grid mode: convert base64 to data URL for display
        gridImageSource = `data:image/png;base64,${functionData.imageBase64}`;
      } else if (functionData?.imageUrl) {
        // Single mode or legacy: use URL directly
        gridImageSource = functionData.imageUrl;
      } else {
        throw new Error("No image data returned");
      }

      // Store the original grid image
      setGridImageUrl(gridImageSource);

      // Now crop the grid into 9 thumbnails
      setCroppingGrid(true);
      try {
        const croppedThumbnails = await cropGridToThumbnails(gridImageSource);
        setGeneratedImages(croppedThumbnails);
        // Auto-select the first thumbnail for preview
        if (croppedThumbnails.length > 0) {
          setPreviewImage(croppedThumbnails[0]);
        }
        toast.success("9 thumbnail variations generated successfully!");
      } catch (cropError) {
        console.error("Error cropping grid:", cropError);
        // Fallback: use the grid image as a single image
        setGeneratedImages([gridImageSource]);
        setPreviewImage(gridImageSource);
        toast.warning("Generated grid image (cropping failed)");
      } finally {
        setCroppingGrid(false);
      }
    } catch (error: any) {
      console.error("Error generating thumbnail:", error);
      toast.error(error.message || "Failed to generate thumbnail");
    } finally {
      setGenerating(false);
    }
  };

  const handleRemix = async () => {
    if (!previewImage) return;

    try {
      setRemixing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Check subscription and quota before remixing (remix also counts as a generation)
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
            thumbnailData: { ...data, aspectRatio, gridMode: false }, // Single image for remix
            remixImageUrl: previewImage,
            remixPrompt: remixPrompt,
            creditsUsed: 1 // Remix uses 1 credit
          },
        }
      );

      if (functionError) throw functionError;

      if (!functionData?.imageUrl) {
        throw new Error("No image URL returned");
      }

      setGeneratedImages((prev) => [...prev, functionData.imageUrl]);
      setPreviewImage(functionData.imageUrl);
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
    if (!previewImage) return;

    const option = DOWNLOAD_SIZES[size];

    try {
      setDownloading(true);
      await downloadImageWithSize(previewImage, {
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

  const toggleImageSelection = (imageUrl: string) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(imageUrl)) {
      newSelection.delete(imageUrl);
    } else {
      newSelection.add(imageUrl);
    }
    setSelectedImages(newSelection);
  };

  const handleSave = async () => {
    const imagesToSave = selectedImages.size > 0
      ? Array.from(selectedImages)
      : previewImage
        ? [previewImage]
        : [];

    if (imagesToSave.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Upload data URLs to storage and get public URLs
      const uploadedUrls = await Promise.all(
        imagesToSave.map(async (url) => {
          if (isDataUrl(url)) {
            return await uploadDataUrlToStorage(url, supabase, user.id);
          }
          return url;
        })
      );

      // Save all selected thumbnails with uploaded URLs
      const insertPromises = uploadedUrls.map((imageUrl) =>
        supabase.from("thumbnails").insert({
          user_id: user.id,
          title: data.titleMode === 'ai' ? 'AI Generated' : data.title,
          subtitle: data.subtitleMode === 'ai' ? undefined : data.subtitle,
          avatar_id: data.avatarId,
          avatar_position: data.avatarPositions?.join(',') || data.avatarPosition,
          avatar_importance: data.avatarImportance,
          product_id: data.productIds?.[0],
          product_position: data.productPositions?.join(',') || data.productPosition,
          product_importance: data.productImportance,
          text_position: data.textPositions?.join(',') || data.textPosition,
          text_importance: data.textImportance,
          expression: data.expressions?.join(',') || data.expression,
          visual_style: data.visualStyles?.join(',') || data.visualStyle || "",
          text_style: data.textStyle || "",
          background_type: data.backgroundType || "",
          background_value: data.backgroundValue,
          aspect_ratio: aspectRatio,
          image_url: imageUrl,
        })
      );

      const results = await Promise.all(insertPromises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw errors[0].error;
      }

      toast.success(`${imagesToSave.length} thumbnail${imagesToSave.length > 1 ? 's' : ''} saved!`);
      navigate("/dashboard");
    } catch (error) {
      console.error("Error saving thumbnail:", error);
      toast.error("Failed to save thumbnail");
    }
  };

  // Format selection info for display
  const getSelectionSummary = () => {
    const items = [];

    if (data.expressions?.length) {
      items.push(`${data.expressions.includes('ai-decide') ? 'AI' : data.expressions.length} expression${data.expressions.length > 1 ? 's' : ''}`);
    }
    if (data.visualStyles?.length) {
      items.push(`${data.visualStyles.includes('ai-decide') ? 'AI' : data.visualStyles.length} style${data.visualStyles.length > 1 ? 's' : ''}`);
    }
    if (data.titleMode === 'ai') {
      items.push('AI titles');
    }

    return items.length > 0 ? items.join(', ') : 'Default settings';
  };

  const isLoading = generating || croppingGrid;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Generate Your Thumbnails</h2>
        <p className="text-muted-foreground">
          We'll generate 9 variations based on your selections
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

          {/* Elements Preview */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">
              Elements: {productData.length > 0 ? `${productData.length} selected` : "None"}
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
                <span className="text-sm text-muted-foreground">No elements</span>
              </div>
            )}
          </div>
        </div>

        {/* Text Details */}
        <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-border">
          <div>
            <span className="text-muted-foreground">Title:</span>
            <span className="ml-2 font-medium">
              {data.titleMode === 'ai' ? (
                <span className="text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI Generated
                </span>
              ) : (
                data.title || "None"
              )}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Expressions:</span>
            <span className="ml-2 font-medium">
              {data.expressions?.includes('ai-decide') ? (
                <span className="text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI Decides
                </span>
              ) : data.expressions?.length ? (
                data.expressions.join(', ')
              ) : (
                "Default"
              )}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Visual Styles:</span>
            <span className="ml-2 font-medium">
              {data.visualStyles?.includes('ai-decide') ? (
                <span className="text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI Decides
                </span>
              ) : data.visualStyles?.length ? (
                data.visualStyles.join(', ')
              ) : (
                "Default"
              )}
            </span>
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

        {/* Generation Info */}
        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Grid3X3 className="w-5 h-5 text-primary" />
          <span className="text-sm">
            <strong>Grid Generation:</strong> 9 thumbnail variations will be created using {getSelectionSummary()}
          </span>
        </div>
      </div>

      {/* Large Preview Section */}
      {previewImage && (
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Preview</Label>
          <div className="relative group">
            <div className={`${aspectRatio === "16:9" ? "aspect-video" : "aspect-[9/16] max-w-md mx-auto"} rounded-lg overflow-hidden border border-border`}>
              <img
                src={previewImage}
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
                    disabled={!previewImage || downloading}
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

      {/* Generated Thumbnails Grid */}
      {generatedImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-semibold">
              Generated Thumbnails
              {selectedImages.size > 0 && (
                <span className="ml-2 text-sm font-normal text-primary">
                  ({selectedImages.size} selected)
                </span>
              )}
            </Label>
            <p className="text-sm text-muted-foreground">
              Click to select
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {generatedImages.map((imageUrl, index) => {
              const isSelected = selectedImages.has(imageUrl);
              const isPreview = previewImage === imageUrl;

              return (
                <button
                  key={index}
                  onClick={() => {
                    setPreviewImage(imageUrl);
                    toggleImageSelection(imageUrl);
                  }}
                  className={`relative ${aspectRatio === "16:9" ? "aspect-video" : "aspect-[9/16]"} rounded-lg overflow-hidden border-2 transition-all hover:scale-[1.02] ${isPreview
                    ? "border-primary ring-2 ring-primary/20"
                    : isSelected
                      ? "border-green-500 ring-2 ring-green-500/20"
                      : "border-border hover:border-primary/50"
                    }`}
                >
                  <img
                    src={imageUrl}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    #{index + 1}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selection Actions */}
          {generatedImages.length > 1 && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedImages(new Set(generatedImages))}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedImages(new Set())}
              >
                Deselect All
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <Button variant="outline" onClick={onPrev} disabled={isLoading || remixing}>
          Back
        </Button>
        {generatedImages.length === 0 ? (
          <Button onClick={handleGenerate} disabled={isLoading} className="flex-1">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {croppingGrid ? "Processing variations..." : "Generating 9 variations..."}
              </>
            ) : (
              <>
                <Grid3X3 className="w-4 h-4 mr-2" />
                Generate 9 Thumbnails
              </>
            )}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleGenerate} disabled={isLoading || remixing} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {croppingGrid ? "Processing..." : "Generating..."}
                </>
              ) : (
                <>
                  <Grid3X3 className="w-4 h-4 mr-2" />
                  Generate 9 More
                </>
              )}
            </Button>
            <Button
              onClick={handleSave}
              disabled={(!previewImage && selectedImages.size === 0) || isLoading || remixing}
              className="flex-1"
            >
              {selectedImages.size > 0
                ? `Save ${selectedImages.size} Selected`
                : "Save & Finish"
              }
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
