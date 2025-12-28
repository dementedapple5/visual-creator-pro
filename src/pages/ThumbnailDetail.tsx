import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Download, 
  Trash2, 
  Bot, 
  Palette, 
  Type, 
  Image as ImageIcon, 
  Smile, 
  Monitor, 
  CalendarDays, 
  Plus, 
  Send,
  Info,
  MoreVertical,
  ChevronRight
} from "lucide-react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

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
  name?: string | null;
}

interface Product {
  id: string;
  title: string;
  brand: string;
  images: { image_url: string }[];
}

type MentionType = "avatar" | "product";

interface MentionItem {
  type: MentionType;
  id: string;
  label: string;
  imageUrl: string;
}

const ThumbnailDetail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [thumbnail, setThumbnail] = useState<Thumbnail | null>(null);
  const [versions, setVersions] = useState<ThumbnailVersion[]>([]);
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [availableAvatars, setAvailableAvatars] = useState<Avatar[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [iterating, setIterating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ThumbnailVersion | null>(null);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [mentionTab, setMentionTab] = useState<"all" | "avatar" | "product">("all");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkUser();
    fetchThumbnail();
    fetchAvailableAssets();
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
          prompt: t("thumbnailDetail.originalGeneration")
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
          prompt: t("thumbnailDetail.originalGeneration")
        };
        setVersions([originalVersion]);
        setSelectedVersion(originalVersion);
      }

      // Fetch avatar if exists
      if (data.avatar_id) {
        const { data: avatarData, error: avatarError } = await supabase
          .from("avatars")
          .select("id, image_url, name")
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
      toast.error(t("thumbnailDetail.errors.failedLoad"));
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableAssets = async () => {
    try {
      // Fetch avatars
      const { data: avatarsData, error: avatarsError } = await supabase
        .from("avatars")
        .select("id,image_url,name")
        .order("created_at", { ascending: false });
      
      if (avatarsError) throw avatarsError;
      setAvailableAvatars((avatarsData || []) as Avatar[]);

      // Fetch all products for the user
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          title,
          brand,
          images:product_images(image_url)
        `)
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;
      setAvailableProducts((productsData || []) as Product[]);
    } catch (error) {
      console.warn("Could not fetch available assets for mentions", error);
    }
  };

  const mentionItems: MentionItem[] = useMemo(() => {
    const items: MentionItem[] = [];

    // Avatars
    for (const a of availableAvatars) {
      if (!a?.id || !a?.image_url) continue;
      items.push({
        type: "avatar",
        id: a.id,
        label: a.name || `Avatar ${a.id.slice(0, 6)}`,
        imageUrl: a.image_url,
      });
    }

    // Products/Elements from the entire library
    for (const p of availableProducts) {
      const img = p.images?.[0]?.image_url;
      if (!p?.id || !img) continue;
      items.push({
        type: "product",
        id: p.id,
        label: `${p.brand ? `${p.brand} ` : ""}${p.title}`.trim() || `Product ${p.id.slice(0, 6)}`,
        imageUrl: img,
      });
    }

    return items;
  }, [availableAvatars, availableProducts]);

  const filteredMentionItems = useMemo(() => {
    const raw = mentionQuery.trim().toLowerCase();
    const isAvatar = raw.startsWith("avatar:") || raw.startsWith("avatars:");
    const isProduct = raw.startsWith("product:") || raw.startsWith("products:") || raw.startsWith("element:") || raw.startsWith("elements:");
    const q = (isAvatar || isProduct) ? raw.split(":").slice(1).join(":").trim() : raw;

    let base = mentionItems;
    if (mentionTab !== "all") {
      base = mentionItems.filter((it) => it.type === mentionTab);
    } else if (isAvatar) {
      base = mentionItems.filter((it) => it.type === "avatar");
    } else if (isProduct) {
      base = mentionItems.filter((it) => it.type === "product");
    }

    if (!q) return base.slice(0, 8);
    return base
      .filter((it) => it.label.toLowerCase().includes(q) || it.id.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionItems, mentionQuery, mentionTab]);

  const parseContextImagesFromPrompt = (text: string): MentionItem[] => {
    const found: MentionItem[] = [];
    
    for (const item of mentionItems) {
      const safeLabel = item.label.replace(/\s+/g, "_");
      // Escape special regex chars just in case
      const escapedLabel = safeLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`@${escapedLabel}(\\s|$)`, "i");
      
      if (regex.test(text)) {
        found.push(item);
      }
    }
    
    return found;
  };

  const contextPreviewItems = useMemo(() => {
    return parseContextImagesFromPrompt(prompt);
  }, [prompt, mentionItems]);

  const openMentionIfNeeded = (nextText: string, caret: number) => {
    const beforeCaret = nextText.slice(0, caret);
    const at = beforeCaret.lastIndexOf("@");
    if (at < 0) {
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery("");
      return;
    }

    const charBefore = at === 0 ? " " : beforeCaret[at - 1];
    if (charBefore && !/\s/.test(charBefore)) {
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery("");
      return;
    }

    const query = beforeCaret.slice(at + 1);
    if (/\s/.test(query)) {
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery("");
      return;
    }

    setMentionOpen(true);
    setMentionStart(at);
    setMentionQuery(query);
    setMentionActiveIndex(0);
  };

  const insertMention = (item: MentionItem) => {
    const el = inputRef.current;
    if (!el) return;

    const caret = el.selectionStart ?? prompt.length;
    const start = mentionStart ?? caret;
    // Use a readable token: @Name (replacing spaces with underscores for easier parsing)
    const safeLabel = item.label.replace(/\s+/g, "_");
    const token = `@${safeLabel}`;

    const next = prompt.slice(0, start) + token + " " + prompt.slice(caret);
    setPrompt(next);

    setMentionOpen(false);
    setMentionStart(null);
    setMentionQuery("");
    setMentionTab("all");

    requestAnimationFrame(() => {
      const pos = start + token.length + 1;
      el.focus();
      el.setSelectionRange(pos, pos);
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    });
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
        .in("status", ["completed", "processing"])
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
      const contextItems = parseContextImagesFromPrompt(prompt);

      // Generate a new version based on the current image and the prompt
      const { data: result, error } = await supabase.functions.invoke("generate-thumbnail", {
        body: {
          thumbnailId: id,
          iterationImageUrl: currentVersionImageUrl,
          iterationPrompt: prompt,
          contextImageUrls: contextItems.map((it) => it.imageUrl),
          contextImageLabels: contextItems.map((it) => `${it.type}:${it.label}`),
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

      toast.success(t("thumbnailDetail.errors.newVersionGenerated"));
    } catch (error) {
      console.error("Error iterating thumbnail:", error);
      toast.error(t("thumbnailDetail.errors.failedGenerate"));
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
      toast.success(t("thumbnailDetail.errors.downloadStarted", { label: option.label }));
    } catch (error) {
      console.error("Error downloading thumbnail:", error);
      toast.error(t("thumbnailDetail.errors.failedDownload"));
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

      toast.success(t("thumbnailDetail.errors.deletedSuccess"));
      navigate("/dashboard");
    } catch (error) {
      console.error("Error deleting thumbnail:", error);
      toast.error(t("thumbnailDetail.errors.failedDelete"));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionActiveIndex((i) => Math.min(i + 1, Math.max(filteredMentionItems.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionOpen(false);
        setMentionStart(null);
        setMentionQuery("");
        return;
      }
      if (e.key === "Enter") {
        if (filteredMentionItems[mentionActiveIndex]) {
          e.preventDefault();
          insertMention(filteredMentionItems[mentionActiveIndex]);
          return;
        }
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleIterate();
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const ThumbnailInfo = () => (
    <div className="space-y-6">
      {selectedVersion && (
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("thumbnailDetail.selectedVersion")}
          </h3>
          <div
            className="rounded-[8px] overflow-hidden border border-border bg-muted"
            style={{ aspectRatio: thumbnail?.aspect_ratio.replace(":", "/") }}
          >
            <img
              src={selectedVersion.image_url}
              alt="Selected version"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">{t("thumbnailDetail.created")}</span>
              <span className="text-foreground">
                {new Date(selectedVersion.created_at).toLocaleDateString()}
              </span>
            </div>
            {selectedVersion.prompt && (
              <div className="pt-3 border-t border-border">
                <span className="text-[10px] text-muted-foreground block mb-2 font-semibold uppercase tracking-wider">{t("thumbnailDetail.promptUsed")}</span>
                <p className="text-xs text-foreground leading-relaxed bg-muted/50 p-3 rounded-lg border border-border/50">
                  {selectedVersion.prompt}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pt-6 border-t border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          {t("thumbnailDetail.baseSettings")}
        </h3>
        <div className="space-y-4">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5 font-semibold">{t("thumbnailDetail.title")}</span>
            <p className="text-sm text-foreground leading-relaxed font-medium bg-muted/30 p-2 rounded border border-border/30">
              {thumbnail?.title || t("thumbnailDetail.untitled")}
            </p>
          </div>
          <div className="flex items-center justify-between bg-muted/30 p-2 rounded border border-border/30">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t("thumbnailDetail.totalVersions")}</span>
            <span className="text-sm text-foreground font-bold">{versions.length}</span>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          {t("thumbnailDetail.generationConfig")}
        </h3>
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground text-[10px] px-2.5 py-1 border-border rounded-md flex items-center gap-2">
            <Palette className="w-3 h-3 text-purple-400" />
            {thumbnail?.visual_style}
          </Badge>
          <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground text-[10px] px-2.5 py-1 border-border rounded-md flex items-center gap-2">
            <Type className="w-3 h-3 text-blue-400" />
            {thumbnail?.text_style}
          </Badge>
          <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground text-[10px] px-2.5 py-1 border-border rounded-md flex items-center gap-2">
            <ImageIcon className="w-3 h-3 text-pink-400" />
            {thumbnail?.background_type}
          </Badge>
          {thumbnail?.expression && (
            <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground text-[10px] px-2.5 py-1 border-border rounded-md flex items-center gap-2">
              <Smile className="w-3 h-3 text-green-400" />
              {thumbnail.expression}
            </Badge>
          )}
          <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground text-[10px] px-2.5 py-1 border-border rounded-md flex items-center gap-2">
            <Monitor className="w-3 h-3 text-orange-400" />
            {thumbnail?.aspect_ratio}
          </Badge>
        </div>

        {(avatar || products.length > 0) && (
          <div className="space-y-4 pt-4 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">{t("thumbnailDetail.assetsUsed")}</span>
            <div className="flex flex-wrap items-center gap-3">
              {avatar && (
                <div className="group relative">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20 shadow-sm transition-transform group-hover:scale-105">
                    <img src={avatar.image_url} alt={avatar.name || "Avatar"} className="w-full h-full object-cover" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 bg-primary text-[8px] text-white px-1 rounded-full border border-background">
                    {avatar.name || "Avatar"}
                  </span>
                </div>
              )}
              {products.map((product) => (
                product.images?.[0] && (
                  <div
                    key={product.id}
                    className="group relative cursor-pointer"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-border/50 shadow-sm transition-all group-hover:border-primary/50 group-hover:scale-105">
                      <img src={product.images[0].image_url} alt={product.title} className="w-full h-full object-cover" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 bg-secondary text-[8px] text-foreground px-1 rounded-full border border-border">Product</span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t("thumbnailDetail.loading")}</div>
      </div>
    );
  }

  if (!thumbnail) {
    return null;
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden relative">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-muted-foreground hover:text-foreground hover:bg-accent -ml-2 shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{t("thumbnailDetail.back")}</span>
            </Button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-semibold text-foreground truncate max-w-[120px] sm:max-w-[200px]">
                {thumbnail.title || t("thumbnailDetail.untitled")}
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {versions.length === 1 
                  ? t("thumbnailDetail.versions", { count: versions.length })
                  : t("thumbnailDetail.versionsPlural", { count: versions.length })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              size="sm"
              onClick={() => handleDownload("youtube")}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-2.5 sm:px-4 h-8 sm:h-9"
              disabled={downloading}
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              <span className="text-xs sm:text-sm">{downloading ? t("thumbnailDetail.downloading") : t("thumbnailDetail.download")}</span>
            </Button>
            
            <Sheet open={showDetailsSheet} onOpenChange={setShowDetailsSheet}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden text-muted-foreground h-8 w-8 border-border">
                  <Info className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:w-[400px] overflow-y-auto bg-card border-l border-border px-6 py-8">
                <SheetHeader className="text-left mb-6">
                  <SheetTitle className="text-xl font-bold">{t("thumbnailDetail.thumbnailDetails")}</SheetTitle>
                  <SheetDescription>{t("thumbnailDetail.detailsDescription")}</SheetDescription>
                </SheetHeader>
                <div className="mt-4">
                  <ThumbnailInfo />
                </div>
              </SheetContent>
            </Sheet>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - Chat Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-background/50 relative">
          {/* Scrollable Chat */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 scroll-smooth">
            <div className="max-w-3xl mx-auto space-y-8 sm:space-y-10">
              {/* Versions as Chat Messages */}
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className={`group animate-in fade-in slide-in-from-bottom-4 duration-500`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Prompt/Label */}
                  {version.prompt && (
                    <div className="flex items-start gap-3 sm:gap-4 mb-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-500/20">
                        <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-card border border-border/60 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                          <p className="text-sm text-foreground leading-relaxed">
                            {version.prompt}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-2 ml-1 flex items-center gap-1.5 uppercase tracking-tighter font-medium">
                          <CalendarDays className="w-3 h-3" />
                          {formatTime(version.created_at)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Image Container */}
                  <div className="pl-0 sm:pl-14">
                    <div
                      className={`relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer shadow-sm ${selectedVersion?.id === version.id
                        ? "border-rose-500 shadow-xl shadow-rose-500/10 scale-[1.01]"
                        : "border-border/60 hover:border-border hover:shadow-md"
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
                          loading="lazy"
                        />
                      </div>

                      {/* Selection indicator */}
                      {selectedVersion?.id === version.id && (
                        <div className="absolute top-3 right-3 px-2.5 py-1 bg-rose-500 text-white rounded-full text-[10px] font-bold shadow-lg animate-in zoom-in duration-300 uppercase tracking-wider">
                          {t("thumbnailDetail.selected")}
                        </div>
                      )}

                      {/* Version number */}
                      <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full text-[10px] font-bold text-white border border-white/10 tracking-widest uppercase">
                        {t("thumbnailDetail.version", { number: index + 1 })}
                      </div>

                      {/* Quick action buttons on hover (mobile always visible or simple) */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator for new generation */}
              {iterating && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-start gap-3 sm:gap-4 mb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center flex-shrink-0 animate-pulse shadow-lg shadow-rose-500/20">
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-card border border-border/60 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                        <p className="text-sm text-foreground italic opacity-70">{prompt}</p>
                      </div>
                    </div>
                  </div>
                  <div className="pl-0 sm:pl-14">
                    <div
                      className="rounded-2xl overflow-hidden border-2 border-dashed border-border/60 bg-muted/30 flex items-center justify-center"
                      style={{ aspectRatio: thumbnail.aspect_ratio.replace(":", "/") }}
                    >
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 border-4 border-rose-500/20 rounded-full" />
                          <div className="absolute inset-0 w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-semibold text-foreground">{t("thumbnailDetail.generatingMagic")}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{t("thumbnailDetail.version", { number: versions.length + 1 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} className="h-4" />
            </div>
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="border-t border-border bg-background/80 backdrop-blur-xl p-4 sm:pt-4 sm:px-6 sm:pb-20 sticky bottom-0 z-30">
            <div className="max-w-3xl mx-auto">
              {contextPreviewItems.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mr-1">
                    {t("thumbnailDetail.context")}
                  </span>
                  {contextPreviewItems.map((it) => (
                    <div
                      key={`${it.type}:${it.id}`}
                      className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 shadow-sm"
                      title={`@${it.label.replace(/\s+/g, "_")}`}
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-border bg-muted">
                        <img src={it.imageUrl} alt={it.label} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[11px] text-foreground max-w-[220px] truncate">{it.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative bg-card rounded-2xl border border-border focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/5 transition-all flex items-center p-2 shadow-lg">
                {mentionOpen && (
                  <div className="absolute left-3 bottom-[54px] w-[min(520px,calc(100%-24px))] rounded-xl border border-border bg-popover shadow-xl overflow-hidden z-50">
                    <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border flex items-center justify-between bg-muted/30">
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setMentionTab("all");
                            setMentionActiveIndex(0);
                          }}
                          className={`hover:text-foreground transition-colors ${mentionTab === "all" ? "text-primary font-bold" : ""}`}
                        >
                          {t("thumbnailDetail.mention.all")}
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setMentionTab("avatar");
                            setMentionActiveIndex(0);
                          }}
                          className={`hover:text-foreground transition-colors ${mentionTab === "avatar" ? "text-primary font-bold" : ""}`}
                        >
                          {t("thumbnailDetail.mention.avatars")}
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setMentionTab("product");
                            setMentionActiveIndex(0);
                          }}
                          className={`hover:text-foreground transition-colors ${mentionTab === "product" ? "text-primary font-bold" : ""}`}
                        >
                          {t("thumbnailDetail.mention.elements")}
                        </button>
                      </div>
                      <span className="font-semibold opacity-50">{mentionQuery ? `@${mentionQuery}` : "@"}</span>
                    </div>
                    <div className="max-h-64 overflow-auto">
                      {filteredMentionItems.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-muted-foreground italic">
                          {mentionTab === "all" 
                            ? t("thumbnailDetail.mention.noItems", { type: t("thumbnailDetail.mention.items") })
                            : mentionTab === "avatar"
                            ? t("thumbnailDetail.mention.noAvatars")
                            : t("thumbnailDetail.mention.noElements")}
                        </div>
                      ) : (
                        filteredMentionItems.map((it, idx) => (
                          <button
                            key={`${it.type}:${it.id}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              insertMention(it);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors ${
                              idx === mentionActiveIndex ? "bg-accent" : ""
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-border bg-muted shrink-0">
                              <img src={it.imageUrl} alt={it.label} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-foreground font-medium truncate">{it.label}</div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                @{it.label.replace(/\s+/g, "_")}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPrompt(next);
                    openMentionIfNeeded(next, e.target.selectionStart ?? next.length);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={t("thumbnailDetail.describeChanges")}
                  rows={1}
                  disabled={iterating}
                  className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/60 px-3 py-2.5 resize-none focus:outline-none text-[16px] sm:text-sm leading-relaxed min-h-[42px] max-h-[150px]"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 150) + 'px';
                  }}
                  onClick={(e) => {
                    const el = e.target as HTMLTextAreaElement;
                    openMentionIfNeeded(el.value, el.selectionStart ?? el.value.length);
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setMentionOpen(false);
                      setMentionStart(null);
                      setMentionQuery("");
                      setMentionTab("all");
                    }, 100);
                  }}
                />

                <div className="flex items-center gap-2 mr-1.5 ml-2">
                  <Button
                    size="sm"
                    onClick={handleIterate}
                    disabled={!prompt.trim() || iterating}
                    className={`rounded-xl h-9 w-9 p-0 transition-all duration-300 font-semibold shadow-sm ${prompt.trim() && !iterating
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95"
                      : "bg-secondary text-muted-foreground"
                      }`}
                  >
                    {iterating ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <p className="hidden sm:block text-center text-[10px] text-muted-foreground mt-3 font-medium uppercase tracking-widest opacity-60">
                {t("thumbnailDetail.pressEnter")}
              </p>
            </div>
          </div>
        </div>

        {/* Preview Panel - Desktop only */}
        <div className="hidden lg:block w-96 border-l border-border bg-card/50 backdrop-blur-sm p-6 overflow-y-auto">
          <ThumbnailInfo />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{t("thumbnailDetail.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t("thumbnailDetail.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground border-border hover:bg-secondary/80">
              {t("thumbnailDetail.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {t("thumbnailDetail.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ThumbnailDetail;
