import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles, Download, Upload, Plus } from "lucide-react";
import { toast } from "sonner";
import { compressAndConvertToJpg } from "@/lib/imageUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

const VISUAL_STYLES = [
  "Modern & Minimalist",
  "Bold & Dramatic",
  "Playful & Fun",
  "Professional & Clean",
  "Cinematic",
  "3D Rendered",
  "Custom",
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

const EXPRESSIONS = [
  { id: "excited", label: "Excited" },
  { id: "surprised", label: "Surprised" },
  { id: "happy", label: "Happy" },
  { id: "serious", label: "Serious" },
  { id: "confident", label: "Confident" },
  { id: "thinking", label: "Thinking" },
  { id: "custom", label: "Custom" },
];

const CreateNew = () => {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [generatedThumbnails, setGeneratedThumbnails] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [remixing, setRemixing] = useState(false);
  const [remixDialogOpen, setRemixDialogOpen] = useState(false);

  // Data states
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Form states
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [avatarPosition, setAvatarPosition] = useState<string>("center");
  const [expression, setExpression] = useState<string>("happy");
  const [customExpression, setCustomExpression] = useState<string>("");

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  // Store custom uploaded elements
  const [customElements, setCustomElements] = useState<{ id: string, url: string }[]>([]);
  // Store positions for each element (ID or URL -> Position)
  const [elementPositions, setElementPositions] = useState<Record<string, string>>({});

  // Custom avatar upload
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);

  const [title, setTitle] = useState<string>("");
  const [subtitle, setSubtitle] = useState<string>("");
  const [textPosition, setTextPosition] = useState<string>("top-center");
  const [textStyle, setTextStyle] = useState<string>("Bold & Large");
  const [customTextStyle, setCustomTextStyle] = useState<string>("");

  const [visualStyle, setVisualStyle] = useState<string>("Modern & Minimalist");
  const [customVisualStyle, setCustomVisualStyle] = useState<string>("");
  const [backgroundType, setBackgroundType] = useState<string>("gradient");
  const [backgroundValue, setBackgroundValue] = useState<string>("#FF6B9D,#C239B3");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");
  const [customBackgroundPrompt, setCustomBackgroundPrompt] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");

  // Color states for gradient/solid pickers
  const [gradientColor1, setGradientColor1] = useState<string>("#FF6B9D");
  const [gradientColor2, setGradientColor2] = useState<string>("#C239B3");
  const [solidColor, setSolidColor] = useState<string>("#FF6B9D");

  useEffect(() => {
    checkUser();
    fetchAvatars();
    fetchProducts();
  }, []);

  // Update backgroundValue when colors change
  useEffect(() => {
    if (backgroundType === "gradient") {
      setBackgroundValue(`${gradientColor1},${gradientColor2}`);
    } else if (backgroundType === "solid") {
      setBackgroundValue(solidColor);
    }
  }, [backgroundType, gradientColor1, gradientColor2, solidColor]);

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
    }
  };

  const handleBackgroundImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const compressedBlob = await compressAndConvertToJpg(file);
      const fileName = `${user.id}/backgrounds/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(fileName);

      setBackgroundImageUrl(publicUrl);
      setBackgroundValue(publicUrl);
      toast.success("Background image uploaded");
    } catch (error) {
      console.error("Error uploading background:", error);
      toast.error("Failed to upload background image");
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const compressedBlob = await compressAndConvertToJpg(file);
      const fileName = `${user.id}/temp/avatar_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(fileName);

      setCustomAvatarUrl(publicUrl);
      setSelectedAvatar(""); // Clear selected library avatar
      toast.success("Avatar uploaded");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar");
    }
  };

  const handleElementUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const compressedBlob = await compressAndConvertToJpg(file);
      const fileName = `${user.id}/temp/element_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(fileName);

      const newCustomId = `custom-${Date.now()}`;
      const newCustomElement = { id: newCustomId, url: publicUrl };

      setCustomElements(prev => [...prev, newCustomElement]);

      // Auto-select the new custom element if under limit
      if (selectedProducts.length < 3) {
        setSelectedProducts(prev => [...prev, newCustomId]);
        setElementPositions(prev => ({ ...prev, [newCustomId]: "center-right" }));
      }

      toast.success("Element uploaded");
    } catch (error) {
      console.error("Error uploading element:", error);
      toast.error("Failed to upload element");
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          title,
          brand,
          images:product_images(image_url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data as Product[] || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Call edge function to generate thumbnail
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-thumbnail",
        {
          body: {
            thumbnailData: {
              avatarId: selectedAvatar || undefined,
              customAvatarUrl: customAvatarUrl || undefined,
              avatarPosition,
              expression: selectedAvatar ? (expression === "custom" ? customExpression : expression) : undefined,
              // Map selected products to include their specific positions
              elements: selectedProducts.map(id => {
                const customEl = customElements.find(el => el.id === id);
                return {
                  id: customEl ? undefined : id,
                  url: customEl ? customEl.url : undefined,
                  position: elementPositions[id] || "center-right"
                };
              }),
              title: title || undefined,
              subtitle: subtitle || undefined,
              textPosition,
              textStyle: textStyle === "Custom" ? customTextStyle : textStyle,
              visualStyle: visualStyle === "Custom" ? customVisualStyle : visualStyle,
              backgroundType,
              backgroundValue: backgroundType === "custom-prompt" ? customBackgroundPrompt : backgroundValue,
              aspectRatio,
            },
          },
        }
      );

      if (functionError) throw functionError;

      const imageUrl = functionData.imageUrl;

      // Save to database
      const { data: thumbnail, error: insertError } = await supabase
        .from("thumbnails")
        .insert({
          user_id: user.id,
          image_url: imageUrl,
          avatar_id: selectedAvatar || null,
          avatar_position: avatarPosition,
          avatar_importance: null,
          expression: selectedAvatar ? expression : null,
          product_id: selectedProducts.find(id => !id.startsWith("custom-")) || null, // Legacy support: save first product ID
          product_position: Object.values(elementPositions)[0] || "center-right", // Legacy support: save first position
          title: title || null,
          subtitle: subtitle || null,
          text_position: textPosition,
          text_importance: null,
          text_style: textStyle,
          visual_style: visualStyle,
          background_type: backgroundType,
          background_value: backgroundValue,
          aspect_ratio: aspectRatio,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Add to gallery instead of navigating
      setGeneratedThumbnails(prev => [imageUrl, ...prev]);
      setSelectedImage(imageUrl); // Set as selected when generated
      toast.success("Thumbnail generated successfully!");
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      toast.error("Failed to generate thumbnail. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!selectedImage) return;

    const link = document.createElement("a");
    link.href = selectedImage;
    link.download = `thumbnail-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Thumbnail downloaded!");
  };

  const handleRemix = async () => {
    if (!selectedImage) return;

    try {
      setRemixing(true);

      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-thumbnail",
        {
          body: {
            thumbnailData: {
              customAvatarUrl: customAvatarUrl || undefined,
              avatarPosition,
              expression: selectedAvatar ? (expression === "custom" ? customExpression : expression) : undefined,
              elements: selectedProducts.map(id => {
                const customEl = customElements.find(el => el.id === id);
                return {
                  id: customEl ? undefined : id,
                  url: customEl ? customEl.url : undefined,
                  position: elementPositions[id] || "center-right"
                };
              }),
              title: title || undefined,
              subtitle: subtitle || undefined,
              textPosition,
              textStyle: textStyle === "Custom" ? customTextStyle : textStyle,
              visualStyle: visualStyle === "Custom" ? customVisualStyle : visualStyle,
              backgroundType,
              backgroundValue: backgroundType === "custom-prompt" ? customBackgroundPrompt : backgroundValue,
              aspectRatio,
            },
            remixImageUrl: selectedImage,
            remixPrompt: remixPrompt
          },
        }
      );

      if (functionError) throw functionError;

      const imageUrl = functionData.imageUrl;

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("thumbnails")
          .insert({
            user_id: user.id,
            image_url: imageUrl,
            avatar_id: selectedAvatar || null,
            avatar_position: avatarPosition,
            avatar_importance: null,
            expression: selectedAvatar ? expression : null,
            product_id: selectedProducts.find(id => !id.startsWith("custom-")) || null,
            product_position: Object.values(elementPositions)[0] || "center-right",
            product_importance: null,
            title: title || null,
            subtitle: subtitle || null,
            text_position: textPosition,
            text_importance: null,
            text_style: textStyle,
            visual_style: visualStyle,
            background_type: backgroundType,
            background_value: backgroundValue,
            aspect_ratio: aspectRatio,
          });
      }

      setGeneratedThumbnails(prev => [imageUrl, ...prev]);
      setSelectedImage(imageUrl);
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

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <div className={`w-full max-w-4xl aspect-video rounded-lg bg-secondary border border-border flex items-center justify-center overflow-hidden ${generating ? 'animate-pulse' : ''}`}>
          {(selectedImage || generatedThumbnails.length > 0) && !generating ? (
            <img
              src={selectedImage || generatedThumbnails[0]}
              alt="Selected thumbnail"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {generating ? "Generating thumbnail..." : "Preview will appear here"}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {(selectedImage || generatedThumbnails.length > 0) && !generating && (
          <div className="w-full max-w-4xl flex gap-2">
            <Button onClick={handleDownload} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>

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
        )}

        {/* Gallery View */}
        {generatedThumbnails.length > 0 && (
          <div className="w-full max-w-4xl">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Generated Thumbnails</h3>
            <div className="grid grid-cols-4 gap-4">
              {generatedThumbnails.map((url, index) => (
                <button
                  key={index}
                  className={`aspect-video rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${selectedImage === url || (!selectedImage && index === 0)
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50"
                    }`}
                  onClick={() => setSelectedImage(url)}
                >
                  <img
                    src={url}
                    alt={`Generated thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar with Controls */}
      <ScrollArea className="w-96 border-l border-border bg-card">
        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Create Thumbnail</h2>
            <p className="text-sm text-muted-foreground">
              Configure all settings to generate your thumbnail
            </p>
          </div>

          <Separator />

          {/* Avatar Section */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              Avatar
            </h3>

            {avatars.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {/* Upload Placeholder */}
                  <div className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-all flex flex-col items-center justify-center cursor-pointer relative group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    {customAvatarUrl ? (
                      <>
                        <img
                          src={customAvatarUrl}
                          alt="Custom Avatar"
                          className="absolute inset-0 w-full h-full object-cover rounded-lg"
                        />
                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg ${!selectedAvatar ? 'ring-2 ring-primary' : ''}`}>
                          <Upload className="w-6 h-6 text-white" />
                        </div>
                      </>
                    ) : (
                      <>
                        <Plus className="w-8 h-8 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground font-medium">Upload</span>
                      </>
                    )}
                    {customAvatarUrl && !selectedAvatar && (
                      <div className="absolute inset-0 ring-2 ring-primary rounded-lg pointer-events-none" />
                    )}
                  </div>

                  {avatars.slice(0, 5).map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => {
                        setSelectedAvatar(avatar.id);
                        setCustomAvatarUrl(null); // Clear custom avatar when selecting from library
                      }}
                      className={`aspect-square rounded-lg border-2 overflow-hidden transition-all ${selectedAvatar === avatar.id
                        ? "border-primary ring-2 ring-primary/50"
                        : "border-border hover:border-muted-foreground"
                        }`}
                    >
                      <img
                        src={avatar.image_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>

                {(selectedAvatar || customAvatarUrl) && (
                  <div className="space-y-4 transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <Label>Expression</Label>
                      <Select value={expression} onValueChange={setExpression}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPRESSIONS.map((exp) => (
                            <SelectItem key={exp.id} value={exp.id}>
                              {exp.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {expression === "custom" && (
                      <div className="space-y-2">
                        <Label>Custom Expression</Label>
                        <Input
                          placeholder="e.g., thoughtful, energetic, mysterious..."
                          value={customExpression}
                          onChange={(e) => setCustomExpression(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Select value={avatarPosition} onValueChange={setAvatarPosition}>
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
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No avatars available. Upload one in your Profile.
              </p>
            )}
          </div>

          <Separator />

          {/* Elements Section */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
              Elements
            </h3>

            {true ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {/* Upload Placeholder - Only show if less than 3 elements selected */}
                  {selectedProducts.length < 3 && (
                    <div className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent/50 transition-all flex flex-col items-center justify-center cursor-pointer relative group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleElementUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <Plus className="w-8 h-8 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground font-medium">Upload</span>
                    </div>
                  )}

                  {/* Custom Elements */}
                  {customElements.map((customEl) => (
                    <button
                      key={customEl.id}
                      onClick={() => {
                        if (selectedProducts.includes(customEl.id)) {
                          setSelectedProducts(selectedProducts.filter(id => id !== customEl.id));
                        } else {
                          if (selectedProducts.length < 3) {
                            setSelectedProducts([...selectedProducts, customEl.id]);
                            setElementPositions(prev => ({ ...prev, [customEl.id]: "center-right" }));
                          } else {
                            toast.error("Maximum 3 elements allowed");
                          }
                        }
                      }}
                      className={`aspect-square rounded-lg border-2 overflow-hidden transition-all relative ${selectedProducts.includes(customEl.id)
                        ? "border-accent ring-2 ring-accent/50"
                        : "border-border hover:border-muted-foreground"
                        }`}
                    >
                      <img
                        src={customEl.url}
                        alt="Custom Element"
                        className="w-full h-full object-cover"
                      />
                      {selectedProducts.includes(customEl.id) && (
                        <div className="absolute top-1 right-1 bg-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
                          {selectedProducts.indexOf(customEl.id) + 1}
                        </div>
                      )}
                    </button>
                  ))}

                  {/* Library Products */}
                  {products.slice(0, 6).map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        if (selectedProducts.includes(product.id)) {
                          setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                        } else {
                          if (selectedProducts.length < 3) {
                            setSelectedProducts([...selectedProducts, product.id]);
                            setElementPositions(prev => ({ ...prev, [product.id]: "center-right" }));
                          } else {
                            toast.error("Maximum 3 elements allowed");
                          }
                        }
                      }}
                      className={`aspect-square rounded-lg border-2 overflow-hidden transition-all relative ${selectedProducts.includes(product.id)
                        ? "border-accent ring-2 ring-accent/50"
                        : "border-border hover:border-muted-foreground"
                        }`}
                    >
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0].image_url}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-xs">No image</span>
                        </div>
                      )}
                      {selectedProducts.includes(product.id) && (
                        <div className="absolute top-1 right-1 bg-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
                          {selectedProducts.indexOf(product.id) + 1}
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {selectedProducts.length > 0 && (
                  <div className="space-y-4 transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <div className="space-y-4">
                        <Label>Positions</Label>
                        {selectedProducts.map(id => {
                          const customEl = customElements.find(el => el.id === id);
                          const product = products.find(p => p.id === id);
                          const name = customEl ? "Custom Element" : (product?.title || "Element");

                          return (
                            <div key={id} className="space-y-2 p-3 rounded-lg bg-secondary/50 border border-border">
                              <span className="text-xs font-medium text-muted-foreground">{name}</span>
                              <Select
                                value={elementPositions[id] || "center-right"}
                                onValueChange={(val) => setElementPositions(prev => ({ ...prev, [id]: val }))}
                              >
                                <SelectTrigger className="h-8">
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
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No elements available. Create one in Elements or upload one here.
              </p>
            )}
          </div>

          <Separator />

          {/* Text Section */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              Text
            </h3>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Enter title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Textarea
                placeholder="Enter subtitle..."
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Text Style</Label>
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
                <Label>Custom Text Style</Label>
                <Input
                  placeholder="e.g., graffiti style, neon glow, 3D effect..."
                  value={customTextStyle}
                  onChange={(e) => setCustomTextStyle(e.target.value)}
                />
              </div>
            )}

            {(title || subtitle) && (
              <div className="space-y-4 transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label>Position</Label>
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
              </div>
            )}
          </div>

          <Separator />

          {/* Style Section */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
              Style
            </h3>

            <div className="space-y-2">
              <Label>Visual Style</Label>
              <Select value={visualStyle} onValueChange={setVisualStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISUAL_STYLES.map((style) => (
                    <SelectItem key={style} value={style}>
                      {style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {visualStyle === "Custom" && (
              <div className="space-y-2">
                <Label>Custom Visual Style</Label>
                <Input
                  placeholder="e.g., cyberpunk aesthetic, watercolor painting, retro 80s..."
                  value={customVisualStyle}
                  onChange={(e) => setCustomVisualStyle(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Background</Label>
              <Select value={backgroundType} onValueChange={setBackgroundType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gradient">Gradient</SelectItem>
                  <SelectItem value="solid">Solid Color</SelectItem>
                  <SelectItem value="image">Upload Image</SelectItem>
                  <SelectItem value="avatar">From Avatar</SelectItem>
                  <SelectItem value="custom-prompt">Custom Prompt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gradient Color Pickers */}
            {backgroundType === "gradient" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Color 1</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={gradientColor1}
                      onChange={(e) => setGradientColor1(e.target.value)}
                      className="w-12 h-10 rounded border border-border cursor-pointer"
                    />
                    <Input
                      value={gradientColor1}
                      onChange={(e) => setGradientColor1(e.target.value)}
                      placeholder="#FF6B9D"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Color 2</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={gradientColor2}
                      onChange={(e) => setGradientColor2(e.target.value)}
                      className="w-12 h-10 rounded border border-border cursor-pointer"
                    />
                    <Input
                      value={gradientColor2}
                      onChange={(e) => setGradientColor2(e.target.value)}
                      placeholder="#C239B3"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Solid Color Picker */}
            {backgroundType === "solid" && (
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={solidColor}
                    onChange={(e) => setSolidColor(e.target.value)}
                    className="w-12 h-10 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={solidColor}
                    onChange={(e) => setSolidColor(e.target.value)}
                    placeholder="#FF6B9D"
                  />
                </div>
              </div>
            )}

            {/* Upload Image */}
            {backgroundType === "image" && (
              <div className="space-y-2">
                <Label>Upload Background Image</Label>
                <label htmlFor="bg-upload" className="block">
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                    {backgroundImageUrl ? (
                      <div className="space-y-2">
                        <img
                          src={backgroundImageUrl}
                          alt="Background preview"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <p className="text-sm text-muted-foreground">Click to change</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground">Click to upload</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                      </div>
                    )}
                  </div>
                  <input
                    id="bg-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Avatar Background */}
            {backgroundType === "avatar" && selectedAvatar && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Background will be generated from the selected avatar
                </p>
              </div>
            )}

            {backgroundType === "avatar" && !selectedAvatar && (
              <div className="p-3 bg-destructive/10 rounded-lg">
                <p className="text-sm text-destructive">
                  Please select an avatar first to use this option
                </p>
              </div>
            )}

            {/* Custom Prompt */}
            {backgroundType === "custom-prompt" && (
              <div className="space-y-2">
                <Label>Background Description</Label>
                <Textarea
                  placeholder="Describe the background you want... (e.g., 'Futuristic city skyline at sunset')"
                  value={customBackgroundPrompt}
                  onChange={(e) => setCustomBackgroundPrompt(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (YouTube)</SelectItem>
                  <SelectItem value="9:16">9:16 (Stories)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  <SelectItem value="4:3">4:3 (Classic)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generating}
            variant="default"
            className="w-full"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Thumbnail
              </>
            )}
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
};

export default CreateNew;
