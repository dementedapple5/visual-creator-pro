import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Download, Upload, Plus, Type as TypeIcon, Image as ImageIcon, Crown, Grid3X3, Check, ChevronDown, Bot, X, Lock, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { compressAndConvertToJpg, DOWNLOAD_SIZES, DownloadSizeKey, downloadImageWithSize, uploadDataUrlToStorage, isDataUrl } from "@/lib/imageUtils";
import type { Tables } from "@/integrations/supabase/types";
import { MultiSelectChips } from "@/components/MultiSelectChips";
import { AvatarPositionSelector } from "@/components/AvatarPositionSelector";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { RadioCardSelector } from "@/components/RadioCardSelector";
import { useSubscription } from "@/hooks/use-subscription";
import { Card, CardContent } from "@/components/ui/card";
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

const getPositions = (t: (key: string) => string) => [
  { value: "top-left", label: t("createNew.positions.topLeft") },
  { value: "top-center", label: t("createNew.positions.topCenter") },
  { value: "top-right", label: t("createNew.positions.topRight") },
  { value: "center-left", label: t("createNew.positions.centerLeft") },
  { value: "center", label: t("createNew.positions.center") },
  { value: "center-right", label: t("createNew.positions.centerRight") },
  { value: "bottom-left", label: t("createNew.positions.bottomLeft") },
  { value: "bottom-center", label: t("createNew.positions.bottomCenter") },
  { value: "bottom-right", label: t("createNew.positions.bottomRight") },
];

const getPositionOptions = (t: (key: string) => string) => getPositions(t).map((p) => ({ value: p.value, label: p.label }));

const getVisualStyles = (t: (key: string) => string) => [
  t("createNew.visualStyles.modernMinimalist"),
  t("createNew.visualStyles.boldDramatic"),
  t("createNew.visualStyles.playfulFun"),
  t("createNew.visualStyles.professionalClean"),
  t("createNew.visualStyles.cinematic"),
  t("createNew.visualStyles.3dRendered"),
  "Custom",
];

const getVisualStyleOptions = (t: (key: string) => string) => getVisualStyles(t)
  .filter((s) => s !== "Custom")
  .map((s) => ({ value: s, label: s }));

const getTextStyles = (t: (key: string) => string) => [
  t("createNew.textStyles.boldLarge"),
  t("createNew.textStyles.elegantScript"),
  t("createNew.textStyles.modernSans"),
  t("createNew.textStyles.handwritten"),
  t("createNew.textStyles.futuristic"),
  t("createNew.textStyles.classicSerif"),
  "Custom",
];

const getTextStyleOptions = (t: (key: string) => string) => getTextStyles(t)
  .filter((s) => s !== "Custom")
  .map((s) => ({ value: s, label: s }));

const getExpressions = (t: (key: string) => string) => [
  { id: "excited", label: t("createNew.expressions.excited") },
  { id: "surprised", label: t("createNew.expressions.surprised") },
  { id: "happy", label: t("createNew.expressions.happy") },
  { id: "serious", label: t("createNew.expressions.serious") },
  { id: "confident", label: t("createNew.expressions.confident") },
  { id: "thinking", label: t("createNew.expressions.thinking") },
];

const getExpressionOptions = (t: (key: string) => string) => getExpressions(t).map((e) => ({ value: e.id, label: e.label }));

const getGenerationModes = (t: (key: string) => string) => [
  { value: "1", label: `1 ${t("createNew.generation.thumbnail")}`, thumbnailCount: 1, gridSize: 1, credits: 1 },
  { value: "4", label: `4 ${t("createNew.generation.thumbnails")}`, thumbnailCount: 4, gridSize: 2, credits: 2 },
  { value: "9", label: `9 ${t("createNew.generation.thumbnails")}`, thumbnailCount: 9, gridSize: 3, credits: 4 },
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const POSITION_OPTIONS = getPositionOptions(t);
  const VISUAL_STYLE_OPTIONS = getVisualStyleOptions(t);
  const TEXT_STYLE_OPTIONS = getTextStyleOptions(t);
  const EXPRESSION_OPTIONS = getExpressionOptions(t);
  const GENERATION_MODES = getGenerationModes(t);
  const [generating, setGenerating] = useState(false);
  const [generatingHeadshot, setGeneratingHeadshot] = useState(false);
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

  // Avatar naming and headshot flow states
  const [pendingAvatar, setPendingAvatar] = useState<{ id: string; url: string } | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [avatarName, setAvatarName] = useState("");
  const [showHeadshotDialog, setShowHeadshotDialog] = useState(false);
  const [headshotUsage, setHeadshotUsage] = useState(0);

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

  const { isFree, subscription, refetch: refetchSubscription } = useSubscription();

  // Data states
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const isFreeAvatarLimited =
    !!subscription && !subscription.subscribed && !subscription.is_super_admin && avatars.length >= 1;

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
    fetchHeadshotUsage();
  }, [subscription?.billing_period_start]);

  const fetchHeadshotUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const start = subscription?.billing_period_start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const { count, error } = await supabase
        .from("generations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("mode", "headshot")
        .eq("status", "completed")
        .gte("created_at", start);

      if (!error && count !== null) {
        setHeadshotUsage(count);
      }
    } catch (error) {
      console.error("Error fetching headshot usage:", error);
    }
  };

  const getHeadshotLimit = () => {
    if (subscription?.is_super_admin) return 999999;
    const tier = subscription?.plan_tier || "free";
    const limits: Record<string, number> = {
      starter: 10,
      pro: 30,
      enterprise: 100,
      free: 0
    };
    return limits[tier] || 0;
  };

  const headshotLimitReached = headshotUsage >= getHeadshotLimit();

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
      toast.success(t("createNew.errors.backgroundUploaded"));
    } catch (error) {
      console.error("Error uploading background:", error);
      toast.error(t("createNew.errors.failedBackgroundUpload"));
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
      toast.success(t("createNew.errors.avatarUploaded"));
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error(t("createNew.errors.failedAvatarUpload"));
    }
  };

  const handlePermanentAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setGenerating(true); // Reuse generating state for loading
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Check free tier limit
      if (isFreeAvatarLimited) {
        toast.error(t("avatars.freeLimitReached"));
        return;
      }

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

      const { data: insertedAvatar, error: dbError } = await supabase
        .from("avatars")
        .insert({ user_id: user.id, image_url: publicUrl })
        .select("id, image_url")
        .single();

      if (dbError) throw dbError;

      toast.success(t("createNew.errors.avatarUploaded"));
      fetchAvatars();

      // Trigger naming flow
      setPendingAvatar({ id: insertedAvatar?.id || "", url: insertedAvatar?.image_url || publicUrl });
      setAvatarName("");
      setShowNameDialog(true);
    } catch (error) {
      console.error("Error uploading permanent avatar:", error);
      toast.error(t("createNew.errors.failedAvatarUpload"));
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveName = async () => {
    if (!pendingAvatar || !avatarName.trim()) {
      toast.error(t("avatars.errors.enterName"));
      return;
    }

    try {
      const { error } = await supabase
        .from("avatars")
        .update({ name: avatarName.trim() })
        .eq("id", pendingAvatar.id);

      if (error) throw error;

      toast.success(t("avatars.errors.namedSuccess"));
      fetchAvatars();
      setShowNameDialog(false);
      setShowHeadshotDialog(true);
    } catch (error) {
      console.error("Error naming avatar:", error);
      toast.error(t("avatars.errors.failedName"));
    }
  };

  const handleGenerateHeadshot = async () => {
    if (!pendingAvatar) return;

    try {
      setGeneratingHeadshot(true);
      const { data, error } = await supabase.functions.invoke("generate-headshot", {
        body: { imageUrl: pendingAvatar.url, avatarId: pendingAvatar.id }
      });

      if (error) throw error;

      toast.success(t("avatars.errors.headshotGenerated"));
      fetchAvatars();
      fetchHeadshotUsage(); // Refresh usage
    } catch (error: any) {
      console.error("Error generating headshot:", error);
      toast.error(error.message || t("avatars.errors.failedHeadshot"));
    } finally {
      setGeneratingHeadshot(false);
      setShowHeadshotDialog(false);
      setPendingAvatar(null);
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

      toast.success(t("createNew.errors.elementUploaded"));
    } catch (error) {
      console.error("Error uploading element:", error);
      toast.error(t("createNew.errors.failedElementUpload"));
    }
  };

  const handleAddTextElement = () => {
    if (!currentTextElement.trim()) return;

    if (textElements.includes(currentTextElement.trim())) {
      toast.error(t("createNew.elements.elementAlreadyAdded"));
      return;
    }

    if (textElements.length >= 10) {
      toast.error(t("createNew.elements.maxTextElements"));
      return;
    }

    setTextElements([...textElements, currentTextElement.trim()]);
    setElementPositions(prev => ({ ...prev, [currentTextElement.trim()]: ["ai-decide"] }));
    setCurrentTextElement("");
  };

  const handleRemoveTextElement = (element: string) => {
    setTextElements(textElements.filter(e => e !== element));
    setElementPositions(prev => {
      const next = { ...prev };
      delete next[element];
      return next;
    });
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

    toast.success(t("createNew.errors.backgroundApplied"));
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

    toast.success(t("createNew.errors.titleApplied"));
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
        .in("status", ["completed", "processing"])
        .gte("created_at", countStartDate);

      const usedGenerations = usageData?.reduce((acc, curr) => acc + (curr.credits_used || 0), 0) || 0;
      const selectedMode = GENERATION_MODES.find(m => m.value === generationMode) || GENERATION_MODES[0];
      const requiredCredits = selectedMode.credits;
      const isGridMode = selectedMode.thumbnailCount > 1;

      const isSuperAdmin = subscriptionData?.is_super_admin === true;

      if (!isSuperAdmin && usedGenerations + requiredCredits > monthlyLimit) {
        const limitType = getGenerationLimitLabel(subscriptionData || {});
        toast.error(`${limitType} ${t("createNew.errors.limitReached")} ${limitType === "Daily" ? t("createNew.errors.freeUsersDaily") : t("createNew.errors.allCreditsUsed")}`);
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
              // Map selected products and text elements to include their specific positions, names and brands
              elements: [
                ...selectedProducts.map(id => {
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
                ...textElements.map(text => ({
                  position: (elementPositions[text]?.[0] || "center-right"),
                  name: text,
                }))
              ],
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
        toast.success(t("createNew.errors.thumbnailGenerated"));
      } else {
        // Store grid + crop into thumbnails on client
        setGridImageUrl(gridImageSource);
        setCroppingGrid(true);
        try {
          const cropped = await cropGridToThumbnails(gridImageSource, selectedMode.gridSize);
          setGeneratedThumbnails(cropped);
          setSelectedImage(cropped[0] || null);
          setSelectedImages(new Set());
          toast.success(t("createNew.errors.variationsGenerated", { count: selectedMode.thumbnailCount }));
        } catch (e) {
          console.warn("Grid cropping failed, falling back to grid image", e);
          setGeneratedThumbnails([gridImageSource]);
          setSelectedImage(gridImageSource);
          toast.warning(t("createNew.errors.gridImageCroppingFailed"));
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
      toast.error(t("createNew.errors.failedGenerate"));
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
      toast.success(t("createNew.errors.downloadStarted", { label: option.label }));
    } catch (error: any) {
      console.error("Error downloading thumbnail:", error);
      toast.error(error?.message || t("createNew.errors.failedDownload"));
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
      toast.error(t("createNew.errors.noThumbnailsSelected"));
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

      toast.success(t("createNew.errors.saved", { 
        count: urls.length, 
        thumbnailLabel: urls.length > 1 ? t("createNew.generation.thumbnails") : t("createNew.generation.thumbnail"),
        plural: urls.length > 1 ? "s" : ""
      }));
    } catch (e) {
      console.error("Error saving thumbnails:", e);
      toast.error(t("createNew.errors.failedSave"));
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
        .in("status", ["completed", "processing"])
        .gte("created_at", countStartDate);

      const usedGenerations = usageData?.reduce((acc, curr) => acc + (curr.credits_used || 0), 0) || 0;
      const remixCredits = 1; // Remix uses 1 credit

      const isSuperAdmin = subscriptionData?.is_super_admin === true;

      if (!isSuperAdmin && usedGenerations + remixCredits > monthlyLimit) {
        const limitType = getGenerationLimitLabel(subscriptionData || {});
        toast.error(`${limitType} ${t("createNew.errors.limitReached")} ${limitType === "Daily" ? t("createNew.errors.freeUsersRemix") : t("createNew.errors.allThumbnailsUsed")}`);
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
      toast.success(t("createNew.errors.remixGenerated"));
    } catch (error: any) {
      console.error("Error remixing thumbnail:", error);
      toast.error(error.message || t("createNew.errors.failedRemix"));
    } finally {
      setRemixing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("createNew.playground")}</p>
            <h2 className="text-2xl font-semibold leading-tight">{t("createNew.pageTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("createNew.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              {t("createNew.backToDashboard")}
            </Button>
          </div>
        </div>

        <Dialog open={remixDialogOpen} onOpenChange={setRemixDialogOpen}>
          <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createNew.remix.title")}</DialogTitle>
            <DialogDescription>
              {t("createNew.remix.description")}
            </DialogDescription>
          </DialogHeader>
            <div className="space-y-4 pt-4">
              <Textarea
                placeholder={t("createNew.remix.placeholder")}
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
                    {t("createNew.remix.generatingRemix")}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t("createNew.remix.generateRemix")}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("avatars.nameYourAvatar")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="avatar-name">{t("avatars.avatarName")}</Label>
                <Input
                  id="avatar-name"
                  placeholder={t("avatars.avatarNamePlaceholder")}
                  value={avatarName}
                  onChange={(e) => setAvatarName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveName();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t("avatars.nameMention")}
                </p>
              </div>
              <Button onClick={handleSaveName} className="w-full">
                {t("avatars.saveName")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={showHeadshotDialog} onOpenChange={setShowHeadshotDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                {t("avatars.professionalHeadshot")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isFree ? (
                  t("avatars.headshotFreeOnly")
                ) : headshotLimitReached ? (
                  t("avatars.headshotLimitReached", { limit: getHeadshotLimit() })
                ) : (
                  <>
                    {t("avatars.headshotDescription")}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {t("avatars.remainingThisMonth", { count: getHeadshotLimit() - headshotUsage })}
                    </div>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={generatingHeadshot}>
                {isFree || headshotLimitReached ? t("common.cancel") : t("avatars.keepOriginal")}
              </AlertDialogCancel>
              {isFree ? (
                <AlertDialogAction onClick={() => navigate("/profile")}>
                  {t("avatars.viewPlans")}
                </AlertDialogAction>
              ) : headshotLimitReached ? (
                <AlertDialogAction onClick={() => navigate("/profile")}>
                  {t("avatars.upgradePlan")}
                </AlertDialogAction>
              ) : (
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleGenerateHeadshot();
                  }}
                  disabled={generatingHeadshot}
                  className="bg-rose-500 hover:bg-rose-600"
                >
                  {generatingHeadshot ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("avatars.generating")}
                    </>
                  ) : (
                    t("avatars.transformToHeadshot")
                  )}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card/60 shadow-sm backdrop-blur">
              <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("createNew.livePreview")}</p>
                  <p className="font-semibold">{t("createNew.canvas")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("avatar")}>
                  {t("createNew.startWithAvatar")}
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
                        crossOrigin="anonymous"
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
                        {t("createNew.previewWillAppear")}
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
                      {downloading ? t("createNew.downloading") : t("createNew.download")}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                      onClick={() => setRemixDialogOpen(true)}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {t("createNew.remixButton")}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {generatedThumbnails.length > 0 && (
              <div className="rounded-xl border border-border bg-card/50 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">{t("createNew.generatedThumbnails")}</p>
                    <p className="text-xs text-muted-foreground">{t("createNew.clickToSelect")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{generatedThumbnails.length} {t("createNew.results")}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(t("common.confirm"))) {
                          setGeneratedThumbnails([]);
                          setSelectedImage(null);
                          setSelectedImages(new Set());
                          setGridImageUrl(null);
                          setCurrentGenerationId(null);
                        }
                      }}
                    >
                      {t("createNew.clearAll")}
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
                        crossOrigin="anonymous"
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
                    {t("createNew.selectAll")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedImages(new Set())}>
                    {t("createNew.deselectAll")}
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={saveSelected} 
                    disabled={isLoading || saving || selectedImages.size === 0}
                    className="relative w-[120px] rounded-[4px] border border-[#F43F5E] bg-transparent text-[#F43F5E] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:border-zinc-800 disabled:text-zinc-500 overflow-hidden group"
                  >
                    <span className="relative z-10">{saving ? t("createNew.saving") : `${t("createNew.save")} ${selectedImages.size}`}</span>
                    {/* Metal reflection fill effect */}
                    <div className="absolute inset-0 z-0 bg-gradient-to-tr from-[#F43F5E] via-[#F43F5E]/80 to-[#F43F5E] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 pointer-events-none bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 translate-x-[-150%] group-hover:animate-shine" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card/70 shadow-sm lg:sticky lg:top-24 lg:h-[calc(100vh-140px)] flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b border-border/60 space-y-1">
                <p className="text-sm font-semibold">{t("createNew.creationStages")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("createNew.navigateStages")}
                </p>
              </div>

              <div className="px-4 pt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="avatar">{t("createNew.tabs.avatar")}</TabsTrigger>
                  <TabsTrigger value="elements">{t("createNew.tabs.elements")}</TabsTrigger>
                  <TabsTrigger value="title">{t("createNew.tabs.title")}</TabsTrigger>
                  <TabsTrigger value="background">{t("createNew.tabs.background")}</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1 px-4 pb-4 pt-3">
                <div className="pr-2 space-y-4">
                  <TabsContent value="avatar" className="space-y-6 mt-0">
                    <CollapsibleSection
                      title={t("createNew.avatar.selection")}
                      subtitle={t("createNew.avatar.selectionSubtitle")}
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
                                <span className="text-xs text-muted-foreground font-medium">{t("createNew.avatar.upload")}</span>
                              </>
                            )}
                            {customAvatarUrl && !selectedAvatar && (
                              <div className="absolute inset-0 ring-2 ring-primary rounded-lg pointer-events-none" />
                            )}
                          </div>

                          {avatars.map((avatar) => (
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
                        <Card 
                          className={`cursor-pointer hover:bg-accent/50 transition-colors border-dashed ${isFreeAvatarLimited ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => {
                            if (isFreeAvatarLimited) {
                              toast.error(t("avatars.freeLimitReached"));
                              return;
                            }
                            document.getElementById('permanent-avatar-upload')?.click();
                          }}
                        >
                          <input
                            id="permanent-avatar-upload"
                            type="file"
                            accept="image/*"
                            onChange={handlePermanentAvatarUpload}
                            className="hidden"
                            disabled={isFreeAvatarLimited}
                          />
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-primary/10">
                                <Plus className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{t("createNew.avatar.noAvatarsTitle")}</p>
                                <p className="text-xs text-muted-foreground">{t("createNew.avatar.noAvatarsSubtitle")}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </CardContent>
                        </Card>
                      )}
                    </CollapsibleSection>

                    {(selectedAvatar || customAvatarUrl) && (
                      <>
                        <CollapsibleSection
                          title={t("createNew.avatar.expressions")}
                          subtitle={t("createNew.avatar.expressionsSubtitle")}
                        >
                          <MultiSelectChips
                            label=""
                            options={EXPRESSION_OPTIONS}
                            value={expressions}
                            onChange={setExpressions}
                            maxSelected={3}
                            showAiDecide
                            aiLabel={t("common.letAIDecide")}
                            aiDescription={t("createNew.aiVaryExpressions")}
                            customPlaceholder={t("createNew.addCustomExpression")}
                          />
                        </CollapsibleSection>

                        <CollapsibleSection
                          title={t("createNew.avatar.position")}
                          subtitle={t("createNew.avatar.positionSubtitle")}
                        >
                          <AvatarPositionSelector
                            options={POSITION_OPTIONS}
                            value={avatarPositions}
                            onChange={setAvatarPositions}
                            showAiDecide
                            aiLabel={t("common.letAIDecide")}
                            aiDescription={t("createNew.aiVaryPositions")}
                          />
                        </CollapsibleSection>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="elements" className="space-y-6 mt-0">
                    <CollapsibleSection
                      title={t("createNew.elements.textElements")}
                      subtitle={t("createNew.elements.textElementsSubtitle")}
                      defaultOpen={true}
                    >
                      <div className="space-y-3">
                        <div className="flex gap-2 pt-1">
                          <Input
                            placeholder={t("createNew.elements.addElement")}
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
                      title={t("createNew.elements.elementLibrary")}
                      subtitle={t("createNew.elements.elementLibrarySubtitle")}
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
                            <span className="text-xs text-muted-foreground font-medium">{t("createNew.avatar.upload")}</span>
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
                                  toast.error(t("createNew.elements.maximumReached"));
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
                              alt={t("createNew.elements.customElement")}
                              className="w-full   object-cover"
                            />
                            {selectedProducts.includes(customEl.id) && (
                              <div className="absolute top-1 right-1 bg-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                {selectedProducts.indexOf(customEl.id) + 1}
                              </div>
                            )}
                          </button>
                        ))}

                        {products.map((product) => (
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
                                  toast.error(t("createNew.elements.maximumReached"));
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

                            {(selectedProducts.length > 0 || textElements.length > 0) && (
                      <CollapsibleSection
                        title={t("createNew.elements.elementPositions")}
                        subtitle={t("createNew.elements.elementPositionsSubtitle")}
                      >
                        <div className="space-y-4">
                          {selectedProducts.map(id => {
                            const customEl = customElements.find(el => el.id === id);
                            const product = products.find(p => p.id === id);
                            const name = customEl ? t("createNew.elements.customElement") : (product?.title || t("createNew.elements.element"));

                            return (
                              <div key={id} className="space-y-3 p-4 rounded-lg bg-secondary/50 border border-border">
                                <span className="text-sm font-medium text-foreground">{name}</span>
                                <AvatarPositionSelector
                                  options={POSITION_OPTIONS}
                                  value={elementPositions[id] || []}
                                  onChange={(next) => setElementPositions((prev) => ({ ...prev, [id]: next }))}
                                  showAiDecide
                                  aiLabel={t("common.letAIDecide")}
                                  aiDescription={t("createNew.aiVaryElementPositions")}
                                />
                              </div>
                            );
                          })}

                          {textElements.map(element => (
                            <div key={`text-${element}`} className="space-y-3 p-4 rounded-lg bg-secondary/50 border border-border">
                              <span className="text-sm font-medium text-foreground">{element}</span>
                              <AvatarPositionSelector
                                options={POSITION_OPTIONS}
                                value={elementPositions[element] || []}
                                onChange={(next) => setElementPositions((prev) => ({ ...prev, [element]: next }))}
                                showAiDecide
                                aiLabel={t("common.letAIDecide")}
                                aiDescription={t("createNew.aiVaryElementPositions")}
                              />
                            </div>
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}
                  </TabsContent>

                  <TabsContent value="title" className="space-y-6 mt-0">
                    <CollapsibleSection
                      title={t("createNew.title.content")}
                      subtitle={t("createNew.title.contentSubtitle")}
                      defaultOpen={true}
                    >
                      <div className="space-y-5">
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">{t("createNew.title.title")}</Label>
                          <RadioCardSelector
                            options={[
                              { value: "ai", label: t("createNew.title.aiGenerate"), description: t("createNew.title.aiGenerateDesc") },
                              { value: "custom", label: t("createNew.title.manual"), description: t("createNew.title.manualDesc") },
                            ]}
                            value={titleMode}
                            onChange={(v) => setTitleMode(v as "ai" | "custom")}
                          />
                          {titleMode === "custom" && (
                            <Input
                              placeholder={t("createNew.title.enterTitle")}
                              className="mx-1 w-[calc(100%-8px)]"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                            />
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label className="text-sm font-medium">{t("createNew.title.subtitle")}</Label>
                          <RadioCardSelector
                            options={[
                              { value: "ai", label: t("createNew.title.aiGenerate"), description: t("createNew.title.aiGenerateDesc") },
                              { value: "custom", label: t("createNew.title.manual"), description: t("createNew.title.manualDesc") },
                            ]}
                            value={subtitleMode}
                            onChange={(v) => setSubtitleMode(v as "ai" | "custom")}
                          />
                          {subtitleMode === "custom" && (
                            <Textarea
                              placeholder={t("createNew.title.enterSubtitle")}
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
                      title={t("createNew.title.fontStyle")}
                      subtitle={t("createNew.title.fontStyleSubtitle")}
                    >
                      <div className="space-y-4">
                        <RadioCardSelector
                          options={[
                            { value: "preset", label: t("createNew.title.presetStyles"), description: t("createNew.title.presetStylesDesc") },
                            { value: "image", label: t("createNew.title.imageReference"), description: t("createNew.title.imageReferenceDesc") },
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
                            aiLabel={t("common.letAIDecide")}
                            aiDescription={
                              (() => {
                                const selectedMode = GENERATION_MODES.find(m => m.value === generationMode);
                                const thumbnailCount = selectedMode?.thumbnailCount || 1;
                                if (thumbnailCount === 1) {
                                  return t("createNew.aiVaryTextStyles1");
                                } else if (thumbnailCount === 4) {
                                  return t("createNew.aiVaryTextStyles4");
                                } else {
                                  return t("createNew.aiVaryTextStyles9");
                                }
                              })()
                            }
                            customPlaceholder={t("createNew.addCustomTextStyle")}
                          />
                        ) : (
                          <div className="space-y-3">
                            {fontStyles.length === 0 ? (
                              <div className="border border-dashed border-border rounded-lg p-4 text-center">
                                <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground mb-2">
                                  {t("createNew.title.noFontStyles")}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate("/font-styles")}
                                >
                                  {t("createNew.title.uploadFontStyles")}
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
                                    {t("createNew.title.manageFontStyles")}
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
                        title={t("createNew.title.textPosition")}
                        subtitle={t("createNew.title.textPositionSubtitle")}
                      >
                        <AvatarPositionSelector
                          options={POSITION_OPTIONS}
                          value={textPositions}
                          onChange={setTextPositions}
                          showAiDecide
                          aiLabel={t("common.letAIDecide")}
                          aiDescription={t("createNew.aiVaryTextPositions")}
                        />
                      </CollapsibleSection>
                    )}

                    {savedTitles.length > 0 && (
                      <CollapsibleSection
                        title={t("createNew.title.savedTitles")}
                        subtitle={t("createNew.title.savedTitlesSubtitle")}
                      >
                        <div className="space-y-3">
                          <div className="space-y-2">
                            {savedTitles.map((saved) => (
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
                                    {t("createNew.title.use")}
                                  </Button>
                                </div>
                                <p className="text-sm font-semibold truncate">{saved.title}</p>
                                {saved.subtitle && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {saved.subtitle}
                                  </p>
                                )}
                                <p className="text-[11px] text-muted-foreground">
                                  {t("createNew.title.style")}: {saved.text_style} • {t("createNew.title.position")}: {saved.text_position}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleSection>
                    )}
                  </TabsContent>

                  <TabsContent value="background" className="space-y-6 mt-0">
                    <CollapsibleSection
                      title={t("createNew.background.visualStyle")}
                      subtitle={t("createNew.background.visualStyleSubtitle")}
                      defaultOpen={true}
                    >
                      <MultiSelectChips
                        label=""
                        options={VISUAL_STYLE_OPTIONS}
                        value={visualStyles}
                        onChange={setVisualStyles}
                        showAiDecide
                        aiLabel={t("common.letAIDecide")}
                        aiDescription={
                          (() => {
                            const selectedMode = GENERATION_MODES.find(m => m.value === generationMode);
                            const thumbnailCount = selectedMode?.thumbnailCount || 1;
                            if (thumbnailCount === 1) {
                              return t("createNew.aiVaryVisualStyles1");
                            } else if (thumbnailCount === 4) {
                              return t("createNew.aiVaryVisualStyles4");
                            } else {
                              return t("createNew.aiVaryVisualStyles9");
                            }
                          })()
                        }
                        customPlaceholder={t("createNew.addCustomVisualStyle")}
                      />
                    </CollapsibleSection>

                    <CollapsibleSection
                      title={t("createNew.background.background")}
                      subtitle={t("createNew.background.backgroundSubtitle")}
                    >
                      <div className="space-y-5">
                        {/* AI Decide Option for Background */}
                        <button
                          type="button"
                          onClick={() => setBackgroundAiDecide(!backgroundAiDecide)}
                          className={`w-[calc(100%-8px)] mx-1 px-4 py-3.5 rounded-[4px] border transition-all duration-200 ease-out flex items-start justify-between gap-3 ${
                            backgroundAiDecide 
                              ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]" 
                              : "border-border/60 bg-card/40 hover:bg-card/60 hover:border-muted-foreground/50"
                          }`}
                        >
                          <div className="text-left space-y-0.5">
                            <div className="font-semibold text-sm">{t("createNew.background.letAIDecide")}</div>
                            <div className="text-xs text-muted-foreground leading-relaxed">
                              {(() => {
                                const selectedMode = GENERATION_MODES.find(m => m.value === generationMode);
                                const thumbnailCount = selectedMode?.thumbnailCount || 1;
                                if (thumbnailCount === 1) {
                                  return t("createNew.background.letAIDecideDesc1");
                                } else if (thumbnailCount === 4) {
                                  return t("createNew.background.letAIDecideDesc4");
                                } else {
                                  return t("createNew.background.letAIDecideDesc9");
                                }
                              })()}
                            </div>
                          </div>
                          <div className="mt-0.5 flex-shrink-0">
                            <div
                              className={`w-5 h-5 rounded-[2px] border-2 flex items-center justify-center transition-all duration-200 ease-out ${
                                backgroundAiDecide
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                  : "border-muted-foreground/40 bg-transparent"
                              }`}
                            >
                              <Check className={`w-3.5 h-3.5 transition-all duration-200 ${backgroundAiDecide ? "opacity-100 scale-100" : "opacity-0 scale-75"}`} />
                            </div>
                          </div>
                        </button>

                        <div className={`mt-1 space-y-4 transition-opacity ${backgroundAiDecide ? "opacity-50 pointer-events-none" : ""}`}>
                          <Select value={backgroundType} onValueChange={setBackgroundType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gradient">{t("createNew.background.gradient")}</SelectItem>
                              <SelectItem value="solid">{t("createNew.background.solidColor")}</SelectItem>
                              <SelectItem value="image">{t("createNew.background.uploadImage")}</SelectItem>
                              <SelectItem value="avatar">{t("createNew.background.fromAvatar")}</SelectItem>
                              <SelectItem value="custom-prompt">{t("createNew.background.customPrompt")}</SelectItem>
                            </SelectContent>
                          </Select>

                          {backgroundType === "gradient" && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-sm">{t("createNew.background.color1")}</Label>
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
                                <Label className="text-sm">{t("createNew.background.color2")}</Label>
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
                              <Label className="text-sm">{t("createNew.background.color")}</Label>
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
                                      <p className="text-sm text-muted-foreground">{t("createNew.background.clickToChange")}</p>
                                    </div>
                                  ) : (
                                    <div>
                                      <p className="text-sm text-muted-foreground">{t("createNew.background.clickToUpload")}</p>
                                      <p className="text-xs text-muted-foreground mt-1">{t("createNew.background.pngJpgUpTo10MB")}</p>
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
                                {t("createNew.background.backgroundFromAvatar")}
                              </p>
                            </div>
                          )}

                          {backgroundType === "avatar" && !selectedAvatar && (
                            <div className="p-3 bg-destructive/10 rounded-lg">
                              <p className="text-sm text-destructive">
                                {t("createNew.background.selectAvatarFirst")}
                              </p>
                            </div>
                          )}

                          {backgroundType === "custom-prompt" && (
                            <div className="space-y-2">
                              <Label className="text-sm">{t("createNew.background.backgroundDescription")}</Label>
                              <Textarea
                                placeholder={t("createNew.background.describeBackground")}
                                value={customBackgroundPrompt}
                                onChange={(e) => setCustomBackgroundPrompt(e.target.value)}
                                rows={3}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleSection>

                    {savedBackgrounds.length > 0 && (
                      <CollapsibleSection
                        title={t("createNew.background.savedBackgrounds")}
                        subtitle={t("createNew.background.savedBackgroundsSubtitle")}
                      >
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {savedBackgrounds.map((bg) => (
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
                                    {t("createNew.title.use")}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => navigate("/backgrounds")}
                          >
                            {t("createNew.background.viewAll")}
                          </Button>
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
                        {croppingGrid ? t("createNew.generation.processingVariations") : t("createNew.generation.generating", { 
                          count: GENERATION_MODES.find(m => m.value === generationMode)?.thumbnailCount || 1,
                          type: GENERATION_MODES.find(m => m.value === generationMode)?.thumbnailCount === 1 ? t("createNew.generation.thumbnail") : t("createNew.generation.variations")
                        })}
                      </>
                    ) : (
                      <>
                        <Bot className="w-5 h-5 mr-2" />
                        {(() => {
                          const selectedMode = GENERATION_MODES.find(m => m.value === generationMode);
                          const modeLabel = selectedMode?.label || `1 ${t("createNew.generation.thumbnail")}`;
                          const credits = selectedMode?.credits || 1;
                          const creditLabel = credits !== 1 ? t("createNew.generation.credits") : t("createNew.generation.credit");
                          // Construir el texto directamente para evitar problemas de interpolación
                          return `${t("createNew.generation.generate")} ${modeLabel} (${credits} ${creditLabel})`;
                        })()}
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
                      <DropdownMenuLabel>{t("createNew.generation.selectGenerationMode")}</DropdownMenuLabel>
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
                                {mode.credits} {mode.credits !== 1 ? t("createNew.generation.credits") : t("createNew.generation.credit")}
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
