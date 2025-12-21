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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Download, Upload, Plus, Type as TypeIcon, Image as ImageIcon, Crown, Grid3X3, Check, ChevronDown, Bot, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { compressAndConvertToJpg, DOWNLOAD_SIZES, DownloadSizeKey, downloadImageWithSize, uploadDataUrlToStorage, isDataUrl } from "@/lib/imageUtils";
import type { Tables } from "@/integrations/supabase/types";
import { MultiSelectChips } from "@/components/MultiSelectChips";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { RadioCardSelector } from "@/components/RadioCardSelector";
import { useSubscription } from "@/hooks/use-subscription";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getGenerationLimitLabel, getGenerationWindowStart } from "@/lib/generationLimits";
import { GeneratingMessages } from "@/components/ui/GeneratingMessages";

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

type SavedBackground = Tables<"backgrounds">;
type SavedTitle = Tables<"titles">;
type FontStyle = Tables<"font_styles">;

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

const POSITION_OPTIONS = POSITIONS.map((p) => ({ value: p.value, label: p.label }));

const VISUAL_STYLES = [
  "Modern & Minimalist",
  "Bold & Dramatic",
  "Playful & Fun",
  "Professional & Clean",
  "Cinematic",
  "3D Rendered",
  "Custom",
];

const VISUAL_STYLE_OPTIONS = VISUAL_STYLES
  .filter((s) => s !== "Custom")
  .map((s) => ({ value: s, label: s }));

const TEXT_STYLES = [
  "Bold & Large",
  "Elegant Script",
  "Modern Sans",
  "Handwritten",
  "Futuristic",
  "Classic Serif",
  "Custom",
];

const TEXT_STYLE_OPTIONS = TEXT_STYLES
  .filter((s) => s !== "Custom")
  .map((s) => ({ value: s, label: s }));

const EXPRESSIONS = [
  { id: "excited", label: "Excited" },
  { id: "surprised", label: "Surprised" },
  { id: "happy", label: "Happy" },
  { id: "serious", label: "Serious" },
  { id: "confident", label: "Confident" },
  { id: "thinking", label: "Thinking" },
];

const EXPRESSION_OPTIONS = EXPRESSIONS.map((e) => ({ value: e.id, label: e.label }));

const GENERATION_MODES = [
  { value: "1", label: "1 Thumbnail", thumbnailCount: 1, gridSize: 1, credits: 1 },
  { value: "4", label: "4 Thumbnails", thumbnailCount: 4, gridSize: 2, credits: 2 },
  { value: "9", label: "9 Thumbnails", thumbnailCount: 9, gridSize: 3, credits: 4 },
] as const;

const GRID_SIZE = 3;

const cropGridToThumbnails = async (gridImageUrl: string, gridSize: number = 3): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const thumbnails: string[] = [];
      const cellWidth = Math.floor(img.width / gridSize);
      const cellHeight = Math.floor(img.height / gridSize);

      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const canvas = document.createElement("canvas");
          canvas.width = cellWidth;
          canvas.height = cellHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          ctx.drawImage(
            img,
            col * cellWidth,
            row * cellHeight,
            cellWidth,
            cellHeight,
            0,
            0,
            cellWidth,
            cellHeight
          );

          thumbnails.push(canvas.toDataURL("image/png"));
        }
      }

      resolve(thumbnails);
    };

    img.onerror = () => reject(new Error("Failed to load grid image"));
    img.src = gridImageUrl;
  });
};

const CreateNew = () => {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [croppingGrid, setCroppingGrid] = useState(false);
  const [generatedThumbnails, setGeneratedThumbnails] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [gridImageUrl, setGridImageUrl] = useState<string | null>(null);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [remixing, setRemixing] = useState(false);
  const [remixDialogOpen, setRemixDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);

  // Persistence logic - Load from sessionStorage on mount
  useEffect(() => {
    const savedThumbnails = sessionStorage.getItem("generated_thumbnails");
    const savedSelectedImage = sessionStorage.getItem("selected_image");
    const savedSelectedImages = sessionStorage.getItem("selected_images");
    const savedGridImageUrl = sessionStorage.getItem("grid_image_url");
    const savedGenerationId = sessionStorage.getItem("current_generation_id");

    if (savedThumbnails) {
      try {
        const parsed = JSON.parse(savedThumbnails);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setGeneratedThumbnails(parsed);
          if (savedSelectedImage) setSelectedImage(savedSelectedImage);
          if (savedSelectedImages) setSelectedImages(new Set(JSON.parse(savedSelectedImages)));
          if (savedGridImageUrl) setGridImageUrl(savedGridImageUrl);
          if (savedGenerationId) setCurrentGenerationId(savedGenerationId);
        }
      } catch (e) {
        console.error("Error loading persisted thumbnails:", e);
      }
    }
  }, []);

  // Persistence logic - Save to sessionStorage when state changes
  useEffect(() => {
    try {
      if (generatedThumbnails.length > 0) {
        sessionStorage.setItem("generated_thumbnails", JSON.stringify(generatedThumbnails));
      } else {
        sessionStorage.removeItem("generated_thumbnails");
      }
    } catch (e) {
      console.warn("Session storage quota exceeded for thumbnails");
    }
  }, [generatedThumbnails]);

  useEffect(() => {
    if (selectedImage) {
      try {
        sessionStorage.setItem("selected_image", selectedImage);
      } catch (e) {
        console.warn("Session storage quota exceeded for selected image");
      }
    } else {
      sessionStorage.removeItem("selected_image");
    }
  }, [selectedImage]);

  useEffect(() => {
    try {
      sessionStorage.setItem("selected_images", JSON.stringify(Array.from(selectedImages)));
    } catch (e) {
      console.warn("Session storage quota exceeded for selected images set");
    }
  }, [selectedImages]);

  useEffect(() => {
    if (gridImageUrl) {
      try {
        sessionStorage.setItem("grid_image_url", gridImageUrl);
      } catch (e) {
        console.warn("Session storage quota exceeded for grid image");
      }
    } else {
      sessionStorage.removeItem("grid_image_url");
    }
  }, [gridImageUrl]);

  useEffect(() => {
    if (currentGenerationId) {
      sessionStorage.setItem("current_generation_id", currentGenerationId);
    } else {
      sessionStorage.removeItem("current_generation_id");
    }
  }, [currentGenerationId]);

  const { isFree } = useSubscription();

  // Data states
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  // Saved presets
  const [savedBackgrounds, setSavedBackgrounds] = useState<SavedBackground[]>([]);
  const [savedTitles, setSavedTitles] = useState<SavedTitle[]>([]);
  const [fontStyles, setFontStyles] = useState<FontStyle[]>([]);

  // Form states
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [avatarPositions, setAvatarPositions] = useState<string[]>([]);
  const [expressions, setExpressions] = useState<string[]>([]);

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  // Store custom uploaded elements
  const [customElements, setCustomElements] = useState<{ id: string, url: string }[]>([]);
  // Store positions for each element (ID or URL -> Position)
  const [elementPositions, setElementPositions] = useState<Record<string, string[]>>({});

  // Custom text elements
  const [textElements, setTextElements] = useState<string[]>([]);
  const [currentTextElement, setCurrentTextElement] = useState("");

  // Custom avatar upload
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);

  const [titleMode, setTitleMode] = useState<"custom" | "ai">("custom");
  const [subtitleMode, setSubtitleMode] = useState<"custom" | "ai">("custom");
  const [title, setTitle] = useState<string>("");
  const [subtitle, setSubtitle] = useState<string>("");
  const [textPositions, setTextPositions] = useState<string[]>([]);
  const [textStyles, setTextStyles] = useState<string[]>([]);
  const [customTextStyle, setCustomTextStyle] = useState<string>("");
  const [useImageFontStyle, setUseImageFontStyle] = useState<boolean>(false);
  const [selectedFontStyleId, setSelectedFontStyleId] = useState<string>("");

  const [visualStyles, setVisualStyles] = useState<string[]>([]);
  const [backgroundAiDecide, setBackgroundAiDecide] = useState<boolean>(false);
  const [backgroundType, setBackgroundType] = useState<string>("gradient");
  const [backgroundValue, setBackgroundValue] = useState<string>("#FF6B9D,#C239B3");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");
  const [customBackgroundPrompt, setCustomBackgroundPrompt] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");

  // Color states for gradient/solid pickers
  const [gradientColor1, setGradientColor1] = useState<string>("#FF6B9D");
  const [gradientColor2, setGradientColor2] = useState<string>("#C239B3");
  const [solidColor, setSolidColor] = useState<string>("#FF6B9D");

  const [activeTab, setActiveTab] = useState<string>("avatar");
  const [generationMode, setGenerationMode] = useState<string>("1");

  // Ensure generation mode is "1" for free tier users
  useEffect(() => {
    if (isFree && generationMode !== "1") {
      setGenerationMode("1");
    }
  }, [isFree, generationMode]);

  const hasGeneratedImage = Boolean(selectedImage || generatedThumbnails.length > 0);
  const previewImage = selectedImage || generatedThumbnails[0] || null;
  const isLoading = generating || croppingGrid;

  useEffect(() => {
    checkUser();
    fetchAvatars();
    fetchProducts();
    fetchSavedBackgrounds();
    fetchSavedTitles();
    fetchFontStyles();
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
        setElementPositions(prev => ({ ...prev, [newCustomId]: ["center-right"] }));
      }

      toast.success("Element uploaded");
    } catch (error) {
      console.error("Error uploading element:", error);
      toast.error("Failed to upload element");
    }
  };

  const handleAddTextElement = () => {
    if (!currentTextElement.trim()) return;

    if (textElements.includes(currentTextElement.trim())) {
      toast.error("Element already added");
      return;
    }

    if (textElements.length >= 10) {
      toast.error("Maximum 10 text elements allowed");
      return;
    }

    setTextElements([...textElements, currentTextElement.trim()]);
    setCurrentTextElement("");
  };

  const handleRemoveTextElement = (element: string) => {
    setTextElements(textElements.filter(e => e !== element));
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

  const fetchSavedBackgrounds = async () => {
    try {
      const { data, error } = await supabase
        .from("backgrounds")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSavedBackgrounds((data as SavedBackground[]) || []);
    } catch (error) {
      console.error("Error fetching backgrounds:", error);
    }
  };

  const fetchSavedTitles = async () => {
    try {
      const { data, error } = await supabase
        .from("titles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSavedTitles((data as SavedTitle[]) || []);
    } catch (error) {
      console.error("Error fetching titles:", error);
    }
  };

  const fetchFontStyles = async () => {
    try {
      const { data, error } = await supabase
        .from("font_styles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFontStyles((data as FontStyle[]) || []);
    } catch (error) {
      console.error("Error fetching font styles:", error);
    }
  };

  const applySavedBackground = (background: SavedBackground) => {
    const meta = (background.metadata as Record<string, any>) || {};

    setBackgroundType(background.type);
    setActiveTab("background");

    if (background.type === "gradient") {
      const [first, second] = (background.value || "").split(",");
      const start = meta.color1 || first || "#FF6B9D";
      const end = meta.color2 || second || "#C239B3";
      setGradientColor1(start);
      setGradientColor2(end);
      setBackgroundValue(`${start},${end}`);
      setBackgroundImageUrl("");
      setCustomBackgroundPrompt("");
    } else if (background.type === "solid") {
      const color = meta.color || background.value || "#FF6B9D";
      setSolidColor(color);
      setBackgroundValue(color);
      setBackgroundImageUrl("");
      setCustomBackgroundPrompt("");
    } else if (background.type === "image") {
      const url = meta.imageUrl || background.value || "";
      setBackgroundImageUrl(url);
      setBackgroundValue(url);
      setCustomBackgroundPrompt("");
    } else if (background.type === "avatar") {
      const avatarValue = meta.avatarId || background.value || "";
      setSelectedAvatar(avatarValue);
      setCustomAvatarUrl(null);
      setBackgroundValue(avatarValue);
      setBackgroundImageUrl("");
      setCustomBackgroundPrompt("");
    } else if (background.type === "custom-prompt") {
      const promptVal = meta.prompt || background.value || "";
      setCustomBackgroundPrompt(promptVal);
      setBackgroundValue(promptVal);
      setBackgroundImageUrl("");
    }

    toast.success("Background applied");
  };

  const applySavedTitle = (savedTitle: SavedTitle) => {
    setTitle(savedTitle.title);
    setSubtitle(savedTitle.subtitle || "");
    setTextPositions(savedTitle.text_position ? [savedTitle.text_position] : []);
    setActiveTab("title");

    // Check if this title uses an image-based font style
    if (savedTitle.font_style_id) {
      setUseImageFontStyle(true);
      setSelectedFontStyleId(savedTitle.font_style_id);
      setTextStyles([]); // Reset text styles since we're using image
      setCustomTextStyle("");
    } else {
      setUseImageFontStyle(false);
      setSelectedFontStyleId("");
      // text_style could be comma-separated if multiple styles were saved
      setTextStyles(savedTitle.text_style ? savedTitle.text_style.split(",").map(s => s.trim()) : []);
      setCustomTextStyle(savedTitle.custom_text_style || "");
    }

    toast.success("Title applied");
  };

  const renderSavedBackgroundPreview = (background: SavedBackground) => {
    const meta = (background.metadata as Record<string, any>) || {};

    if (background.type === "gradient") {
      const [first, second] = (background.value || "").split(",");
      const start = meta.color1 || first || "#FF6B9D";
      const end = meta.color2 || second || "#C239B3";
      return (
        <div
          className="h-16 w-full rounded-md border border-border"
          style={{ background: `linear-gradient(135deg, ${start}, ${end})` }}
        />
      );
    }

    if (background.type === "solid") {
      const color = meta.color || background.value || "#FF6B9D";
      return (
        <div
          className="h-16 w-full rounded-md border border-border"
          style={{ background: color }}
        />
      );
    }

    if (background.type === "image") {
      const url = meta.imageUrl || background.value;
      return (
        <div className="h-16 w-full rounded-md border border-border overflow-hidden bg-secondary">
          {url ? (
            <img src={url} alt={background.name} className="  w-full object-cover" />
          ) : (
            <div className="  w-full flex items-center justify-center text-xs text-muted-foreground">
              No image
            </div>
          )}
        </div>
      );
    }

    if (background.type === "avatar") {
      const avatar = avatars.find((a) => a.id === (background.value || meta.avatarId));
      return (
        <div className="h-16 w-full rounded-md border border-border overflow-hidden bg-secondary flex items-center justify-center">
          {avatar ? (
            <img src={avatar.image_url} alt="Avatar" className="  w-full object-cover" />
          ) : (
            <div className="text-xs text-muted-foreground">Avatar not found</div>
          )}
        </div>
      );
    }

    return (
      <div className="h-16 w-full rounded-md border border-border bg-secondary/60 p-2 text-xs text-muted-foreground overflow-hidden">
        {background.value || (meta.prompt as string) || "Custom prompt"}
      </div>
    );
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Check subscription and quota before generating
      const { data: subscriptionData } = await supabase.functions.invoke("check-subscription");
      const monthlyLimit = subscriptionData?.monthly_limit || 1;
      const countStartDate = getGenerationWindowStart(subscriptionData || {});

      const { data: usageData } = await supabase
        .from("generations")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("created_at", countStartDate);

      const usedGenerations = usageData?.reduce((acc, curr) => acc + (curr.credits_used || 0), 0) || 0;
      const selectedMode = GENERATION_MODES.find(m => m.value === generationMode) || GENERATION_MODES[0];
      const requiredCredits = selectedMode.credits;
      const isGridMode = selectedMode.thumbnailCount > 1;

      const isSuperAdmin = subscriptionData?.is_super_admin === true;

      if (!isSuperAdmin && usedGenerations + requiredCredits > monthlyLimit) {
        const limitType = getGenerationLimitLabel(subscriptionData || {});
        toast.error(`${limitType} limit reached. ${limitType === "Daily" ? "Free users get 1 credit per day. Upgrade to create more." : "You've used all your credits for this billing period."}`);
        setGenerating(false);
        return;
      }

      // Get font style image URL if using image-based font style
      const fontStyleImageUrl = useImageFontStyle && selectedFontStyleId
        ? fontStyles.find(fs => fs.id === selectedFontStyleId)?.image_url
        : undefined;

      const safeAvatarPositions = avatarPositions.length ? avatarPositions : ["ai-decide"];
      const safeTextPositions = textPositions.length ? textPositions : ["ai-decide"];
      const safeExpressions = expressions.length ? expressions : ["ai-decide"];
      const safeVisualStyles = visualStyles.length ? visualStyles : ["ai-decide"];

      // Collapse element positions into a single list for variation instructions
      const productPositions = Array.from(
        new Set(
          Object.values(elementPositions)
            .flat()
            .filter(Boolean)
        )
      );

      // Log the generation parameters
      console.log("Generation mode:", generationMode, "Thumbnails:", selectedMode.thumbnailCount, "Credits:", requiredCredits);

      // Call edge function to generate thumbnail
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-thumbnail",
        {
          body: {
            thumbnailData: {
              avatarId: selectedAvatar || undefined,
              customAvatarUrl: customAvatarUrl || undefined,
              avatarPositions: selectedAvatar || customAvatarUrl ? safeAvatarPositions : undefined,
              expressions: selectedAvatar || customAvatarUrl ? safeExpressions : undefined,
              // Map selected products to include their specific positions, names and brands
              elements: selectedProducts.map(id => {
                const customEl = customElements.find(el => el.id === id);
                const product = products.find(p => p.id === id);
                return {
                  id: customEl ? undefined : id,
                  url: customEl ? customEl.url : undefined,
                  position: (elementPositions[id]?.[0] || "center-right"),
                  name: product?.title || undefined,
                  brand: product?.brand || undefined,
                };
              }),
              userElements: textElements.length > 0 ? textElements.join(",") : undefined,
              productPositions: productPositions.length ? productPositions : ["ai-decide"],
              title: titleMode === "custom" ? (title || undefined) : undefined,
              subtitle: subtitleMode === "custom" ? (subtitle || undefined) : undefined,
              titleMode,
              subtitleMode,
              textPositions: safeTextPositions,
              textStyles: useImageFontStyle ? ["Image Reference"] : (textStyles.length ? textStyles : ["ai-decide"]),
              fontStyleImageUrl,
              visualStyles: safeVisualStyles,
              backgroundType: backgroundAiDecide ? "ai-decide" : backgroundType,
              backgroundValue: backgroundAiDecide ? undefined : (backgroundType === "custom-prompt" ? customBackgroundPrompt : backgroundValue),
              aspectRatio,
              gridMode: isGridMode,
              gridCount: selectedMode.thumbnailCount,
            },
            creditsUsed: requiredCredits,
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

      const generationId = functionData.generationId as string | undefined;

      // Handle single thumbnail mode
      if (selectedMode.thumbnailCount === 1) {
        setGeneratedThumbnails([gridImageSource]);
        setSelectedImage(gridImageSource);
        setSelectedImages(new Set());
        toast.success("Thumbnail generated!");
      } else {
        // Store grid + crop into thumbnails on client
        setGridImageUrl(gridImageSource);
        setCroppingGrid(true);
        try {
          const cropped = await cropGridToThumbnails(gridImageSource, selectedMode.gridSize);
          setGeneratedThumbnails(cropped);
          setSelectedImage(cropped[0] || null);
          setSelectedImages(new Set());
          toast.success(`${selectedMode.thumbnailCount} thumbnail variations generated!`);
        } catch (e) {
          console.warn("Grid cropping failed, falling back to grid image", e);
          setGeneratedThumbnails([gridImageSource]);
          setSelectedImage(gridImageSource);
          toast.warning("Generated grid image (cropping failed)");
        } finally {
          setCroppingGrid(false);
        }
      }

      // Store generationId to link back when user saves thumbnails
      if (generationId) {
        setCurrentGenerationId(generationId);
        console.log("Generation completed:", generationId);
      }
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      toast.error("Failed to generate thumbnail. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (size: DownloadSizeKey) => {
    const imageToDownload = selectedImage || generatedThumbnails[0];
    if (!imageToDownload) return;

    const option = DOWNLOAD_SIZES[size];

    try {
      setDownloading(true);
      await downloadImageWithSize(imageToDownload, {
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

  const toggleSelect = (url: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const saveSelected = async () => {
    const urls = selectedImages.size > 0 ? Array.from(selectedImages) : selectedImage ? [selectedImage] : [];
    if (urls.length === 0) {
      toast.error("No thumbnails selected to save");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      console.log(`Saving ${urls.length} thumbnails...`);

      // Upload data URLs to storage and get public URLs
      const uploadedUrls = await Promise.all(
        urls.map(async (url, index) => {
          if (isDataUrl(url)) {
            console.log(`Uploading thumbnail ${index + 1}/${urls.length}...`);
            try {
              const publicUrl = await uploadDataUrlToStorage(url, supabase, user.id);
              console.log(`Thumbnail ${index + 1} uploaded successfully`);
              return publicUrl;
            } catch (uploadError: any) {
              console.error(`Failed to upload thumbnail ${index + 1}:`, uploadError);
              throw uploadError;
            }
          }
          return url;
        })
      );

      const insertPromises = uploadedUrls.map((image_url) => {
        const payload = {
          user_id: user.id,
          image_url,
          avatar_id: selectedAvatar || null,
          avatar_position: (avatarPositions.length ? avatarPositions.join(",") : ""),
          avatar_importance: null,
          expression: (expressions.length ? expressions.join(",") : ""),
          product_id: selectedProducts.find(id => !id.startsWith("custom-")) || null,
          product_position: (Object.values(elementPositions).flat().join(",") || ""),
          product_importance: null,
          title: titleMode === "custom" ? (title || "") : "",
          subtitle: subtitleMode === "custom" ? (subtitle || "") : "",
          text_position: (textPositions.length ? textPositions.join(",") : ""),
          text_importance: null,
          text_style: (textStyles.length ? textStyles.join(",") : ""),
          visual_style: (visualStyles.length ? visualStyles.join(",") : ""),
          background_type: backgroundType || "",
          background_value: backgroundValue || "",
          aspect_ratio: aspectRatio,
        };
        return supabase.from("thumbnails").insert(payload);
      });

      const results = await Promise.all(insertPromises);
      const anyError = results.find((r) => r.error);
      if (anyError?.error) {
        throw anyError.error;
      }

      // Update the generation record with the first saved thumbnail's image URL
      // This ensures the thumbnail appears in the Generations history
      if (currentGenerationId && uploadedUrls.length > 0) {
        const { error: genUpdateError } = await supabase
          .from("generations")
          .update({ image_url: uploadedUrls[0] })
          .eq("id", currentGenerationId);
        
        if (genUpdateError) {
          console.warn("Could not update generation record", genUpdateError);
        }
      }

      toast.success(`Saved ${urls.length} thumbnail${urls.length > 1 ? "s" : ""}!`);
    } catch (e) {
      console.error("Error saving thumbnails:", e);
      toast.error("Failed to save thumbnails");
    } finally {
      setSaving(false);
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

      const { data: usageData } = await supabase
        .from("generations")
        .select("credits_used")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("created_at", countStartDate);

      const usedGenerations = usageData?.reduce((acc, curr) => acc + (curr.credits_used || 0), 0) || 0;
      const remixCredits = 1; // Remix uses 1 credit

      const isSuperAdmin = subscriptionData?.is_super_admin === true;

      if (!isSuperAdmin && usedGenerations + remixCredits > monthlyLimit) {
        const limitType = getGenerationLimitLabel(subscriptionData || {});
        toast.error(`${limitType} limit reached. ${limitType === "Daily" ? "Free users can create 1 thumbnail per day. Upgrade to create more." : "You've used all your thumbnails for this billing period."}`);
        setRemixing(false);
        return;
      }

      // Get font style image URL for remix if using image-based font style
      const remixFontStyleImageUrl = useImageFontStyle && selectedFontStyleId
        ? fontStyles.find(fs => fs.id === selectedFontStyleId)?.image_url
        : undefined;

      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "generate-thumbnail",
        {
          body: {
            thumbnailData: {
              customAvatarUrl: customAvatarUrl || undefined,
              // Remix stays single-image for now
              elements: selectedProducts.map(id => {
                const customEl = customElements.find(el => el.id === id);
                const product = products.find(p => p.id === id);
                return {
                  id: customEl ? undefined : id,
                  url: customEl ? customEl.url : undefined,
                  position: (elementPositions[id]?.[0] || "center-right"),
                  name: product?.title || undefined,
                  brand: product?.brand || undefined,
                };
              }),
              title: titleMode === "custom" ? (title || undefined) : undefined,
              subtitle: subtitleMode === "custom" ? (subtitle || undefined) : undefined,
              titleMode,
              subtitleMode,
              textStyles: useImageFontStyle ? ["Image Reference"] : (textStyles.length ? textStyles : ["ai-decide"]),
              fontStyleImageUrl: remixFontStyleImageUrl,
              visualStyles: visualStyles.length ? visualStyles : ["ai-decide"],
              backgroundType: backgroundAiDecide ? "ai-decide" : backgroundType,
              backgroundValue: backgroundAiDecide ? undefined : (backgroundType === "custom-prompt" ? customBackgroundPrompt : backgroundValue),
              aspectRatio,
              gridMode: false,
            },
            remixImageUrl: selectedImage,
            remixPrompt: remixPrompt,
            creditsUsed: remixCredits
          },
        }
      );

      if (functionError) throw functionError;

      const imageUrl = functionData.imageUrl;
      const generationId = functionData.generationId as string | undefined;

      // Update the generation record with the image URL
      if (generationId && imageUrl) {
        await supabase
          .from("generations")
          .update({ image_url: imageUrl })
          .eq("id", generationId);
      }

      // Save to database
      if (user) {
        await supabase
          .from("thumbnails")
          .insert({
            user_id: user.id,
            image_url: imageUrl,
            avatar_id: selectedAvatar || null,
            avatar_position: avatarPositions.length ? avatarPositions.join(",") : "",
            avatar_importance: null,
            expression: expressions.length ? expressions.join(",") : "",
            product_id: selectedProducts.find(id => !id.startsWith("custom-")) || null,
            product_position: Object.values(elementPositions).flat().join(",") || "",
            product_importance: null,
            title: titleMode === "custom" ? (title || "") : "",
            subtitle: subtitleMode === "custom" ? (subtitle || "") : "",
            text_position: textPositions.length ? textPositions.join(",") : "",
            text_importance: null,
            text_style: textStyles.length ? textStyles.join(",") : "",
            visual_style: visualStyles.length ? visualStyles.join(",") : "",
            background_type: backgroundType || "",
            background_value: backgroundValue || "",
            aspect_ratio: aspectRatio || "16:9",
          } as any);
      }

      if (generationId) {
        const { data: newThumbnail, error: fetchError } = await supabase
          .from("thumbnails")
          .select("id")
          .eq("image_url", imageUrl)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!fetchError && newThumbnail?.id) {
          const { error: generationUpdateError } = await supabase
            .from("generations")
            .update({ thumbnail_id: newThumbnail.id })
            .eq("id", generationId);

          if (generationUpdateError) {
            console.warn("Could not attach remix thumbnail to generation record", generationUpdateError);
          }
        }
      }

      setGeneratedThumbnails(prev => [imageUrl, ...prev]);
      setSelectedImage(imageUrl);
      setSelectedImages(new Set());
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
    <div className="min-h-screen bg-background">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Playground</p>
            <h2 className="text-2xl font-semibold leading-tight">Create Thumbnail</h2>
            <p className="text-sm text-muted-foreground">
              Move through the stages to craft your thumbnail without losing context.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              Back to dashboard
            </Button>
          </div>
        </div>

        <Dialog open={remixDialogOpen} onOpenChange={setRemixDialogOpen}>
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

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card/60 shadow-sm backdrop-blur">
              <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Live preview</p>
                  <p className="font-semibold">Canvas</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("avatar")}>
                  Start with avatar
                </Button>
              </div>

              <div className="p-4 space-y-4">
                <div className="relative w-full aspect-video rounded-lg bg-secondary border border-border flex items-center justify-center overflow-hidden">
                  {/* Faded grid background pattern */}
                  <div
                    className={`absolute inset-0 transition-opacity duration-500 ${previewImage ? 'opacity-0' : 'opacity-100'}`}
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, hsl(var(--border) / 0.3) 1px, transparent 1px),
                        linear-gradient(to bottom, hsl(var(--border) / 0.3) 1px, transparent 1px)
                      `,
                      backgroundSize: '40px 40px',
                    }}
                  >
                    {/* Pulse wave animation overlay when generating */}
                    {generating && (
                      <>
                        <div
                          className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent animate-pulse-wave"
                          style={{
                            background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.15) 0%, transparent 60%)',
                            animation: 'pulseWave 2s ease-in-out infinite',
                          }}
                        />
                        <div
                          className="absolute inset-0"
                          style={{
                            background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.1) 0%, transparent 70%)',
                            animation: 'pulseWave 2s ease-in-out infinite 0.5s',
                          }}
                        />
                        <div
                          className="absolute inset-0"
                          style={{
                            background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.05) 0%, transparent 80%)',
                            animation: 'pulseWave 2s ease-in-out infinite 1s',
                          }}
                        />
                      </>
                    )}
                    {/* Fade out gradient at edges */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'radial-gradient(ellipse at center, transparent 30%, hsl(var(--secondary)) 100%)',
                      }}
                    />
                  </div>

                  {previewImage ? (
                    <>
                      <img
                        src={previewImage}
                        alt="Selected thumbnail"
                        className="w-full   object-contain"
                      />
                      {generating && (
                        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                          {/* Grid overlay for generating state */}
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `
                                linear-gradient(to right, hsl(var(--border) / 0.2) 1px, transparent 1px),
                                linear-gradient(to bottom, hsl(var(--border) / 0.2) 1px, transparent 1px)
                              `,
                              backgroundSize: '40px 40px',
                            }}
                          />
                          {/* Pulse waves */}
                          <div
                            className="absolute inset-0"
                            style={{
                              background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.2) 0%, transparent 50%)',
                              animation: 'pulseWave 2s ease-in-out infinite',
                            }}
                          />
                          <div
                            className="absolute inset-0"
                            style={{
                              background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.15) 0%, transparent 60%)',
                              animation: 'pulseWave 2s ease-in-out infinite 0.5s',
                            }}
                          />
                          <div
                            className="absolute inset-0"
                            style={{
                              background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.1) 0%, transparent 70%)',
                              animation: 'pulseWave 2s ease-in-out infinite 1s',
                            }}
                          />
                          <div className="text-center space-y-3 relative z-10">
                            <GeneratingMessages />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center relative z-10">
                      {generating ? (
                        <GeneratingMessages />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Preview will appear here
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {hasGeneratedImage && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                      onClick={() => handleDownload("youtube")}
                      disabled={downloading}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {downloading ? "Downloading..." : "Download"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                      onClick={() => setRemixDialogOpen(true)}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Remix
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {generatedThumbnails.length > 0 && (
              <div className="rounded-xl border border-border bg-card/50 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">Generated thumbnails</p>
                    <p className="text-xs text-muted-foreground">Click to select</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{generatedThumbnails.length} results</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Are you sure you want to clear the generated thumbnails? This will remove them from cache.")) {
                          setGeneratedThumbnails([]);
                          setSelectedImage(null);
                          setSelectedImages(new Set());
                          setGridImageUrl(null);
                          setCurrentGenerationId(null);
                        }
                      }}
                    >
                      Clear all
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-3">
                  {generatedThumbnails.map((url, index) => (
                    <div
                      key={index}
                      className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all cursor-pointer animate-in fade-in slide-in-from-top-4 duration-500 ${previewImage === url
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                        }`}
                      style={{ 
                        animationDelay: `${index * 150}ms`,
                        animationFillMode: 'both' 
                      }}
                      onClick={() => setSelectedImage(url)}
                    >
                      <img
                        src={url}
                        alt={`Generated thumbnail ${index + 1}`}
                        className="w-full   object-cover"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(url);
                        }}
                        className={`absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${selectedImages.has(url)
                          ? "bg-primary border-primary text-white shadow-lg scale-110"
                          : "bg-black/40 border-white/60 text-white hover:bg-black/60 hover:border-white"
                          }`}
                      >
                        <Check className={`w-4 h-4 transition-all ${selectedImages.has(url) ? "scale-100 opacity-100" : "scale-0 opacity-0"}`} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => setSelectedImages(new Set(generatedThumbnails))}>
                    Select all
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedImages(new Set())}>
                    Deselect all
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={saveSelected} 
                    disabled={isLoading || saving || selectedImages.size === 0}
                    className="relative w-[120px] rounded-[4px] border border-[#F43F5E] bg-transparent text-[#F43F5E] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:border-zinc-800 disabled:text-zinc-500 overflow-hidden group"
                  >
                    <span className="relative z-10">{saving ? "Saving..." : `Save ${selectedImages.size}`}</span>
                    {/* Metal reflection fill effect */}
                    <div className="absolute inset-0 z-0 bg-gradient-to-tr from-[#F43F5E] via-[#F43F5E]/80 to-[#F43F5E] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 pointer-events-none bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 translate-x-[-150%] group-hover:animate-shine" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card/70 shadow-sm">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col  ">
              <div className="p-4 border-b border-border/60 space-y-1">
                <p className="text-sm font-semibold">Creation stages</p>
                <p className="text-xs text-muted-foreground">
                  Navigate between Avatar, Elements, Title, and Background.
                </p>
              </div>

              <div className="px-4 pt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="avatar">Avatar</TabsTrigger>
                  <TabsTrigger value="elements">Elements</TabsTrigger>
                  <TabsTrigger value="title">Title</TabsTrigger>
                  <TabsTrigger value="background">Background</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1 px-4 pb-4 pt-3 max-h-[75vh]">
                <div className="pr-2 space-y-4">
                  <TabsContent value="avatar" className="space-y-6 mt-0">
                    <CollapsibleSection
                      title="Avatar Selection"
                      subtitle="Choose or upload an avatar image to feature in your thumbnail"
                      defaultOpen={true}
                    >
                      {avatars.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
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
                                  className="absolute inset-0 w-full object-cover rounded-lg"
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
                                setCustomAvatarUrl(null);
                              }}
                              className={`aspect-square rounded-lg border-2 overflow-hidden transition-all ${selectedAvatar === avatar.id
                                ? "border-primary ring-2 ring-primary/50"
                                : "border-border hover:border-muted-foreground"
                                }`}
                            >
                              <img
                                src={avatar.image_url}
                                alt="Avatar"
                                className="w-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No avatars available. Upload one in your Profile.
                        </p>
                      )}
                    </CollapsibleSection>

                    {(selectedAvatar || customAvatarUrl) && (
                      <>
                        <CollapsibleSection
                          title="Expressions"
                          subtitle="Select facial expressions for your avatar (max 3)"
                        >
                          <MultiSelectChips
                            label=""
                            options={EXPRESSION_OPTIONS}
                            value={expressions}
                            onChange={setExpressions}
                            maxSelected={3}
                            showAiDecide
                            aiLabel="Let AI Decide"
                            aiDescription="AI will vary expressions across the 9 thumbnails"
                            customPlaceholder="Add custom expression..."
                          />
                        </CollapsibleSection>

                        <CollapsibleSection
                          title="Avatar Position"
                          subtitle="Control where your avatar appears on the canvas"
                        >
                          <MultiSelectChips
                            label=""
                            options={POSITION_OPTIONS}
                            value={avatarPositions}
                            onChange={setAvatarPositions}
                            showAiDecide
                            aiLabel="Let AI Decide"
                            aiDescription="AI will vary avatar positions across the 9 thumbnails"
                            customPlaceholder="Add custom position..."
                          />
                        </CollapsibleSection>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="elements" className="space-y-6 mt-0">
                    <CollapsibleSection
                      title="Text Elements"
                      subtitle="Add specific objects to include (e.g. 'red car', 'sunflowers')"
                      defaultOpen={true}
                    >
                      <div className="space-y-3">
                        <div className="flex gap-2 pt-1">
                          <Input
                            placeholder="Add specific element (e.g. red car, neon sign)..."
                            value={currentTextElement}
                            onChange={(e) => setCurrentTextElement(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTextElement();
                              }
                            }}
                          />
                          <Button
                            onClick={handleAddTextElement}
                            size="icon"
                            variant="outline"
                            disabled={!currentTextElement.trim()}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        {textElements.length > 0 && (
                          <div className="flex flex-wrap gap-x-2 gap-y-3">
                            {textElements.map((element, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center gap-1.5 rounded border border-border/60 bg-secondary/50 px-3.5 py-1.5 text-sm shadow-sm"
                              >
                                {element}
                                <button type="button" onClick={() => handleRemoveTextElement(element)} className="hover:text-destructive">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleSection>
                    <CollapsibleSection
                      title="Element Library"
                      subtitle="Select up to 3 elements like products, props, or custom images"
                      defaultOpen={true}
                    >
                      <div className="grid grid-cols-3 gap-2">
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

                        {customElements.map((customEl) => (
                          <button
                            key={customEl.id}
                            onClick={() => {
                              if (selectedProducts.includes(customEl.id)) {
                                setSelectedProducts(selectedProducts.filter(id => id !== customEl.id));
                              } else {
                                if (selectedProducts.length < 3) {
                                  setSelectedProducts([...selectedProducts, customEl.id]);
                                  setElementPositions(prev => ({ ...prev, [customEl.id]: ["center-right"] }));
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
                              className="w-full   object-cover"
                            />
                            {selectedProducts.includes(customEl.id) && (
                              <div className="absolute top-1 right-1 bg-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                {selectedProducts.indexOf(customEl.id) + 1}
                              </div>
                            )}
                          </button>
                        ))}

                        {products.slice(0, 6).map((product) => (
                          <button
                            key={product.id}
                            onClick={() => {
                              if (selectedProducts.includes(product.id)) {
                                setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                              } else {
                                if (selectedProducts.length < 3) {
                                  setSelectedProducts([...selectedProducts, product.id]);
                                  setElementPositions(prev => ({ ...prev, [product.id]: ["center-right"] }));
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
                                className="w-full   object-cover"
                              />
                            ) : (
                              <div className="w-full   bg-muted flex items-center justify-center">
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
                    </CollapsibleSection>

                    {selectedProducts.length > 0 && (
                      <CollapsibleSection
                        title="Element Positions"
                        subtitle="Define placement for each selected element"
                      >
                        <div className="space-y-4">
                          {selectedProducts.map(id => {
                            const customEl = customElements.find(el => el.id === id);
                            const product = products.find(p => p.id === id);
                            const name = customEl ? "Custom Element" : (product?.title || "Element");

                            return (
                              <div key={id} className="space-y-3 p-4 rounded-lg bg-secondary/50 border border-border">
                                <span className="text-sm font-medium text-foreground">{name}</span>
                                <MultiSelectChips
                                  label=""
                                  options={POSITION_OPTIONS}
                                  value={elementPositions[id] || []}
                                  onChange={(next) => setElementPositions((prev) => ({ ...prev, [id]: next }))}
                                  showAiDecide
                                  aiLabel="Let AI Decide"
                                  aiDescription="AI will vary element positions across the 9 thumbnails"
                                  customPlaceholder="Add custom position..."
                                />
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleSection>
                    )}
                  </TabsContent>

                  <TabsContent value="title" className="space-y-6 mt-0">
                    <CollapsibleSection
                      title="Title Content"
                      subtitle="Write your own title or let AI generate click-worthy variations"
                      defaultOpen={true}
                    >
                      <div className="space-y-5">
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Title</Label>
                          <RadioCardSelector
                            options={[
                              { value: "ai", label: "AI Generate", description: "Click-worthy titles" },
                              { value: "custom", label: "Manual", description: "Write your own" },
                            ]}
                            value={titleMode}
                            onChange={(v) => setTitleMode(v as "ai" | "custom")}
                          />
                          {titleMode === "custom" && (
                            <Input
                              placeholder="Enter title..."
                              className="mx-1 w-[calc(100%-8px)]"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                            />
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Subtitle</Label>
                          <RadioCardSelector
                            options={[
                              { value: "ai", label: "AI Generate", description: "Complement titles" },
                              { value: "custom", label: "Manual", description: "Write your own" },
                            ]}
                            value={subtitleMode}
                            onChange={(v) => setSubtitleMode(v as "ai" | "custom")}
                          />
                          {subtitleMode === "custom" && (
                            <Textarea
                              placeholder="Enter subtitle..."
                              className="mx-1 w-[calc(100%-8px)]"
                              value={subtitle}
                              onChange={(e) => setSubtitle(e.target.value)}
                              rows={2}
                            />
                          )}
                        </div>
                      </div>
                    </CollapsibleSection>

                    <CollapsibleSection
                      title="Font Style"
                      subtitle="Choose from presets or use an image reference for typography"
                    >
                      <div className="space-y-4">
                        <RadioCardSelector
                          options={[
                            { value: "preset", label: "Preset Styles", description: "Select from presets" },
                            { value: "image", label: "Image Reference", description: "Upload a sample" },
                          ]}
                          value={useImageFontStyle ? "image" : "preset"}
                          onChange={(v) => setUseImageFontStyle(v === "image")}
                        />

                        {!useImageFontStyle ? (
                          <MultiSelectChips
                            label=""
                            options={TEXT_STYLE_OPTIONS}
                            value={textStyles}
                            onChange={setTextStyles}
                            showAiDecide
                            aiLabel="Let AI Decide"
                            aiDescription="AI will vary text styles across the 9 thumbnails"
                            customPlaceholder="Add custom text style..."
                          />
                        ) : (
                          <div className="space-y-3">
                            {fontStyles.length === 0 ? (
                              <div className="border border-dashed border-border rounded-lg p-4 text-center">
                                <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground mb-2">
                                  No font styles available yet.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate("/font-styles")}
                                >
                                  Upload Font Styles
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                                  {fontStyles.map((fs) => (
                                    <button
                                      key={fs.id}
                                      type="button"
                                      onClick={() => setSelectedFontStyleId(fs.id)}
                                      className={`relative rounded-lg border-2 overflow-hidden transition-all ${selectedFontStyleId === fs.id
                                        ? "border-primary ring-2 ring-primary/20"
                                        : "border-border hover:border-primary/50"
                                        }`}
                                    >
                                      <div className="aspect-[4/3]">
                                        <img
                                          src={fs.image_url}
                                          alt={fs.name}
                                          className="w-full   object-cover"
                                        />
                                      </div>
                                      {fs.is_system && (
                                        <div className="absolute top-1 right-1">
                                          <Crown className="w-3 h-3 text-amber-500" />
                                        </div>
                                      )}
                                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                        <p className="text-[9px] text-white truncate">{fs.name}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  <Button
                                    variant="link"
                                    className="h-auto p-0 text-xs"
                                    onClick={() => navigate("/font-styles")}
                                  >
                                    Manage font styles →
                                  </Button>
                                </p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </CollapsibleSection>

                    {(titleMode === "ai" || subtitleMode === "ai" || title || subtitle) && (
                      <CollapsibleSection
                        title="Text Position"
                        subtitle="Control where your text appears on the canvas"
                      >
                        <MultiSelectChips
                          label=""
                          options={POSITION_OPTIONS}
                          value={textPositions}
                          onChange={setTextPositions}
                          showAiDecide
                          aiLabel="Let AI Decide"
                          aiDescription="AI will vary text positions across the 9 thumbnails"
                          customPlaceholder="Add custom position..."
                        />
                      </CollapsibleSection>
                    )}

                    {savedTitles.length > 0 && (
                      <CollapsibleSection
                        title="Saved Titles"
                        subtitle="Quick access to your saved title presets"
                      >
                        <div className="space-y-3">
                          <div className="space-y-2">
                            {savedTitles.slice(0, 4).map((saved) => (
                              <div
                                key={saved.id}
                                className="rounded-lg border border-border p-3 bg-secondary/40 space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-sm truncate">{saved.name}</p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-3 text-xs"
                                    onClick={() => applySavedTitle(saved)}
                                  >
                                    Use
                                  </Button>
                                </div>
                                <p className="text-sm font-semibold truncate">{saved.title}</p>
                                {saved.subtitle && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {saved.subtitle}
                                  </p>
                                )}
                                <p className="text-[11px] text-muted-foreground">
                                  Style: {saved.text_style} • Position: {saved.text_position}
                                </p>
                              </div>
                            ))}
                          </div>
                          {savedTitles.length > 4 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              onClick={() => navigate("/titles")}
                            >
                              View all titles
                            </Button>
                          )}
                        </div>
                      </CollapsibleSection>
                    )}
                  </TabsContent>

                  <TabsContent value="background" className="space-y-6 mt-0">
                    <CollapsibleSection
                      title="Visual Style"
                      subtitle="Define the overall mood and aesthetic of your thumbnails"
                      defaultOpen={true}
                    >
                      <MultiSelectChips
                        label=""
                        options={VISUAL_STYLE_OPTIONS}
                        value={visualStyles}
                        onChange={setVisualStyles}
                        showAiDecide
                        aiLabel="Let AI Decide"
                        aiDescription="AI will vary visual styles across the 9 thumbnails"
                        customPlaceholder="Add custom visual style..."
                      />
                    </CollapsibleSection>

                    <CollapsibleSection
                      title="Background"
                      subtitle="Choose a background type: gradient, solid color, image, or custom"
                    >
                      <div className="space-y-5">
                        {/* AI Decide Option for Background */}
                        <button
                          type="button"
                          onClick={() => setBackgroundAiDecide(!backgroundAiDecide)}
                          className={`w-full px-4 py-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${backgroundAiDecide
                            ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]"
                            : "border-border/60 bg-card/50 hover:border-muted-foreground/50"
                            }`}
                        >
                          <div className="text-left space-y-0.5">
                            <div className="font-semibold text-sm">Let AI Decide</div>
                            <div className="text-xs text-muted-foreground leading-relaxed">
                              AI will create varied backgrounds across the 9 thumbnails
                            </div>
                          </div>
                          <div
                            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${backgroundAiDecide
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40"
                              }`}
                          >
                            {backgroundAiDecide && (
                              <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                            )}
                          </div>
                        </button>

                        <div className={`mt-5 space-y-4 transition-opacity ${backgroundAiDecide ? "opacity-50 pointer-events-none" : ""}`}>
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

                          {backgroundType === "gradient" && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-sm">Color 1</Label>
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
                                <Label className="text-sm">Color 2</Label>
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

                          {backgroundType === "solid" && (
                            <div className="space-y-2">
                              <Label className="text-sm">Color</Label>
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

                          {backgroundType === "image" && (
                            <div className="space-y-2">
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

                          {backgroundType === "custom-prompt" && (
                            <div className="space-y-2">
                              <Label className="text-sm">Background Description</Label>
                              <Textarea
                                placeholder="Describe the background you want... (e.g., 'Futuristic city skyline at sunset')"
                                value={customBackgroundPrompt}
                                onChange={(e) => setCustomBackgroundPrompt(e.target.value)}
                                rows={3}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleSection>

                    <CollapsibleSection
                      title="Aspect Ratio"
                      subtitle="Select the dimensions for your thumbnail output"
                    >
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
                    </CollapsibleSection>

                    {savedBackgrounds.length > 0 && (
                      <CollapsibleSection
                        title="Saved Backgrounds"
                        subtitle="Quick access to your saved background presets"
                      >
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {savedBackgrounds.slice(0, 4).map((bg) => (
                              <div
                                key={bg.id}
                                className="rounded-lg border border-border p-2 space-y-2 bg-secondary/40"
                              >
                                <p className="text-sm font-medium truncate">{bg.name}</p>
                                {renderSavedBackgroundPreview(bg)}
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span className="capitalize">
                                    {(bg.type as string).replace("-", " ")}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-3 text-xs"
                                    onClick={() => applySavedBackground(bg)}
                                  >
                                    Use
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          {savedBackgrounds.length > 4 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              onClick={() => navigate("/backgrounds")}
                            >
                              View all backgrounds
                            </Button>
                          )}
                        </div>
                      </CollapsibleSection>
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>

              <div className="border-t border-border/60 p-4 space-y-2">
                <div className="flex w-full border border-border rounded-lg overflow-hidden">
                  <Button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    variant="outline"
                    className="flex-1 rounded-none border-0 border-r border-r-border/50 hover:text-pink-500 hover:scale-100 [&_svg]:hover:text-pink-500"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {croppingGrid ? "Processing variations..." : `Generating ${GENERATION_MODES.find(m => m.value === generationMode)?.thumbnailCount || 1} ${GENERATION_MODES.find(m => m.value === generationMode)?.thumbnailCount === 1 ? "thumbnail" : "variations"}...`}
                      </>
                    ) : (
                      <>
                        <Bot className="w-5 h-5 mr-2" />
                        Generate {GENERATION_MODES.find(m => m.value === generationMode)?.label || "1 Thumbnail"} ({GENERATION_MODES.find(m => m.value === generationMode)?.credits || 1} credit{GENERATION_MODES.find(m => m.value === generationMode)?.credits !== 1 ? "s" : ""})
                      </>
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="lg"
                        className="rounded-none border-0 px-3 hover:scale-100"
                        disabled={isLoading}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Select generation mode</DropdownMenuLabel>
                      {GENERATION_MODES.map((mode) => {
                        const isDisabled = isFree && mode.value !== "1";
                        return (
                          <DropdownMenuItem
                            key={mode.value}
                            onClick={() => !isDisabled && setGenerationMode(mode.value)}
                            disabled={isDisabled}
                            className={`${generationMode === mode.value ? "bg-accent" : ""} ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <span>{mode.label}</span>
                                {isDisabled && <Lock className="h-3 w-3" />}
                              </div>
                              <span className="text-xs text-muted-foreground ml-2">
                                {mode.credits} credit{mode.credits !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateNew;
