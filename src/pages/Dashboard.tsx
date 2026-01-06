import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, CalendarDays, SlidersHorizontal, Loader2, Sparkles, Download, Zap, User, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { downloadImageWithSize, DOWNLOAD_SIZES } from "@/lib/imageUtils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Thumbnail {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  created_at: string;
  avatar_id: string | null;
  product_id: string | null;
}

interface Generation {
  id: string;
  status: string;
  mode: string;
  thumbnail_id: string | null;
  title: string | null;
  subtitle: string | null;
  created_at: string;
}

interface AvatarOption {
  id: string;
  image_url: string;
}

interface ProductOption {
  id: string;
  title: string;
  brand: string;
  images?: { image_url: string }[];
}

interface FiltersState {
  search: string;
  avatar: string;
  element: string;
}

const initialFilters: FiltersState = {
  search: "",
  avatar: "all",
  element: "all",
};

const ITEMS_PER_PAGE = 15;

const Dashboard = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]); // Replaced by useQuery
  const [avatars, setAvatars] = useState<AvatarOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  // const [loading, setLoading] = useState(true); // Replaced by useQuery
  const [pendingGenerations, setPendingGenerations] = useState<Generation[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const previousPendingCountRef = useRef(0);

  const { data: { thumbnails, count } = { thumbnails: [], count: 0 }, isLoading: loading } = useQuery({
    queryKey: ["thumbnails", currentPage, filters, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("thumbnails")
        .select("*", { count: "exact" });

      if (filters.search.trim()) {
        query = query.or(`title.ilike.%${filters.search}%,subtitle.ilike.%${filters.search}%`);
      }

      if (filters.avatar !== "all") {
        query = query.eq("avatar_id", filters.avatar);
      }

      if (filters.element !== "all") {
        query = query.eq("product_id", filters.element);
      }

      if (dateRange?.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte("created_at", toDate.toISOString());
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        toast.error(t("dashboard.errors.failedLoad"));
        throw error;
      }
      return { thumbnails: data as Thumbnail[], count: count || 0 };
    },
  });

  useEffect(() => {
    checkUser();
    // fetchThumbnails(); // Handled by useQuery
    fetchFilterOptions();
    fetchPendingGenerations();

    // Poll for pending generations every 3 seconds
    const interval = setInterval(() => {
      fetchPendingGenerations();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, dateRange]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  // fetchThumbnails removed as it is now handled by useQuery

  const fetchFilterOptions = async () => {
    try {
      const [{ data: avatarData, error: avatarError }, { data: productData, error: productError }] =
        await Promise.all([
          supabase.from("avatars").select("id, image_url").order("created_at", { ascending: false }),
          supabase
            .from("products")
            .select(`
              id,
              title,
              brand,
              images:product_images(image_url)
            `)
            .order("created_at", { ascending: false }),
        ]);

      if (avatarError) throw avatarError;
      if (productError) throw productError;

      setAvatars(avatarData || []);
      setProducts((productData as ProductOption[]) || []);
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const fetchPendingGenerations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("generations")
        .select("id, status, mode, thumbnail_id, title, subtitle, created_at")
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const newCount = (data || []).length;
      const previousCount = previousPendingCountRef.current;

      setPendingGenerations(data || []);

      // Check if any generation just completed (was pending before, now isn't in the list)
      if (previousCount > 0 && newCount < previousCount) {
        // Refresh thumbnails to get the newly created ones
        queryClient.invalidateQueries({ queryKey: ["thumbnails"] });
      }

      previousPendingCountRef.current = newCount;
    } catch (error) {
      console.error("Error fetching pending generations:", error);
    }
  }, []);

  const handleDownload = async (thumbnail: Thumbnail) => {
    try {
      setDownloadingIds((prev) => new Set(prev).add(thumbnail.id));
      
      // Default to YouTube size for dashboard quick download
      const option = DOWNLOAD_SIZES.youtube;
      
      await downloadImageWithSize(thumbnail.image_url, {
        width: option.width,
        height: option.height,
        fileName: `${thumbnail.title || "thumbnail"}-${option.width}x${option.height}.png`,
      });
      
      toast.success(t("dashboard.errors.downloadStarted"));
    } catch (error) {
      console.error("Error downloading thumbnail:", error);
      toast.error(t("dashboard.errors.failedDownload"));
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(thumbnail.id);
        return next;
      });
    }
  };

  // Check if a thumbnail has a pending iteration
  const hasPendingIteration = (thumbnailId: string) => {
    return pendingGenerations.some(
      (gen) => gen.thumbnail_id === thumbnailId && gen.mode === "iterate"
    );
  };

  // Get new generations (create mode without thumbnail_id yet, or with thumbnail_id not in our list)
  const newGenerations = useMemo(() => {
    return pendingGenerations.filter(
      (gen) => gen.mode === "create" || (gen.mode !== "iterate" && !gen.thumbnail_id)
    );
  }, [pendingGenerations]);

  const formatDate = (value: string) => {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const totalPages = Math.ceil(count / ITEMS_PER_PAGE);

  const resetFilters = () => {
    setFilters(initialFilters);
    setDateRange(undefined);
  };

  const dateRangeLabel = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return `${formatDate(dateRange.from.toISOString())} → ${formatDate(dateRange.to.toISOString())}`;
    }
    if (dateRange?.from) {
      return formatDate(dateRange.from.toISOString());
    }
    return t("dashboard.selectDateRange");
  }, [dateRange, t]);

  const hasActiveFilters = 
    filters.search.trim() !== "" || 
    filters.avatar !== "all" || 
    filters.element !== "all" || 
    !!dateRange;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/90">
      <div className="w-full px-6 pb-8 pt-4 space-y-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary/80">{t("dashboard.gallery")}</p>
            <h1 className="text-3xl font-semibold tracking-tight">{t("dashboard.yourThumbnails")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.subtitle")}
            </p>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate("/create")}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/70 p-6 text-left transition-all hover:border-primary/50 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {t("navigation.create")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.createCardDescription")}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/quick-create")}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/70 p-6 text-left transition-all hover:border-primary/50 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {t("navigation.quickCreate")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.quickCreateCardDescription")}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/sketch")}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/70 p-6 text-left transition-all hover:border-primary/50 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                <Pencil className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {t("navigation.sketch")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.sketchCardDescription")}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/avatars")}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/70 p-6 text-left transition-all hover:border-primary/50 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {t("navigation.avatars")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.avatarsCardDescription")}
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder={t("dashboard.searchPlaceholder")}
                className="w-full bg-card/70 pl-10"
              />
            </div>

            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 bg-card/70">
                  <SlidersHorizontal className="h-4 w-4" />
                  {t("dashboard.filters")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[340px] sm:w-[420px] space-y-4" align="end">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{t("dashboard.filters")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.filtersDescription")}</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{t("dashboard.avatar")}</label>
                    <Select
                      value={filters.avatar}
                      onValueChange={(value) => setFilters((prev) => ({ ...prev, avatar: value }))}
                    >
                      <SelectTrigger className="bg-background/60">
                        <SelectValue placeholder={t("dashboard.filterByAvatar")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("dashboard.allAvatars")}</SelectItem>
                        {avatars.map((avatar, index) => (
                          <SelectItem key={avatar.id} value={avatar.id}>
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-6 overflow-hidden rounded-full bg-muted">
                                <img src={avatar.image_url} alt="" className="h-full w-full object-cover" />
                              </span>
                              <span>{t("dashboard.avatarLabel", { index: index + 1 })}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{t("dashboard.element")}</label>
                    <Select
                      value={filters.element}
                      onValueChange={(value) => setFilters((prev) => ({ ...prev, element: value }))}
                    >
                      <SelectTrigger className="bg-background/60">
                        <SelectValue placeholder={t("dashboard.filterByElement")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("dashboard.allElements")}</SelectItem>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-6 overflow-hidden rounded bg-muted">
                                {product.images?.[0]?.image_url ? (
                                  <img
                                    src={product.images[0].image_url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="block h-full w-full bg-muted" />
                                )}
                              </span>
                              <span className="truncate">
                                {product.title} {product.brand ? `· ${product.brand}` : ""}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">{t("dashboard.dateRange")}</label>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-between bg-background/60 text-left font-normal",
                            !dateRange?.from && "text-muted-foreground"
                          )}
                        >
                          <span>{dateRangeLabel}</span>
                          <CalendarDays className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center" side="bottom">
                        <Calendar
                          mode="range"
                          numberOfMonths={2}
                          selected={dateRange}
                          onSelect={(range) => setDateRange(range)}
                          defaultMonth={dateRange?.from}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      resetFilters();
                      setFiltersOpen(false);
                    }}
                  >
                    {t("dashboard.clearFilters")}
                  </Button>
                  <Button size="sm" onClick={() => setFiltersOpen(false)}>
                    {t("dashboard.apply")}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-lg"
              >
                <Skeleton className="aspect-video w-full" />
                <div className="p-2 space-y-3">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="pt-4 flex items-center justify-between">
                    <Skeleton className="h-9 w-24 rounded" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : count === 0 ? (
          !hasActiveFilters ? (
            <div className="text-center py-20 rounded-2xl border border-border/60 bg-card/70 shadow-inner">
              <p className="text-muted-foreground mb-4">{t("dashboard.noThumbnails")}</p>
              <Button
                onClick={() => navigate("/create")}
                size="sm"
                className="bg-primary hover:bg-primary/90 shadow-primary/20 shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("dashboard.createThumbnail")}
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-card/70 p-10 text-center shadow-inner">
              <p className="text-lg font-semibold mb-2">{t("dashboard.noResults")}</p>
              <p className="text-muted-foreground mb-6">
                {t("dashboard.noResultsDescription")}
              </p>
              <Button onClick={resetFilters} variant="outline">
                {t("dashboard.resetFilters")}
              </Button>
            </div>
          )
        ) : (
          <div className="space-y-12">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {/* Placeholder cards for new generations in progress - only on first page */}
              {currentPage === 1 && newGenerations.map((generation, index) => (
                <div
                  key={generation.id}
                  className="relative overflow-hidden rounded-lg border border-border/60 bg-card shadow-xl animate-in fade-in slide-in-from-top-4 duration-500"
                  style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                >
                  <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="relative">
                        <span className="absolute inset-0 h-12 w-12 rounded-full bg-primary/30 animate-ping" />
                        <span className="absolute inset-0 h-12 w-12 rounded-full bg-primary/20 animate-ping [animation-delay:150ms]" />
                        <div className="relative h-12 w-12 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center">
                          <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-muted-foreground animate-pulse">
                        {t("dashboard.generating")}
                      </p>
                    </div>
                  </div>
                  <div className="relative space-y-4 p-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="h-6 w-3/4 rounded bg-muted animate-pulse" />
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      </div>
                      <div className="h-4 w-1/2 rounded bg-muted/60 animate-pulse" />
                    </div>
                    <div className="pt-2">
                      <div className="h-9 w-28 rounded bg-muted/40 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}

              {thumbnails.map((thumbnail, index) => {
                const isIterating = hasPendingIteration(thumbnail.id);

                return (
                  <div
                    key={thumbnail.id}
                    className="group relative flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card shadow-lg animate-in fade-in slide-in-from-top-4 duration-500"
                    style={{ animationDelay: `${(currentPage === 1 ? newGenerations.length + index : index) * 50}ms`, animationFillMode: 'both' }}
                  >
                    <div
                      className="relative aspect-video w-full overflow-hidden bg-muted/20 cursor-pointer"
                      onClick={() => navigate(`/thumbnail/${thumbnail.id}`)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <img
                        src={thumbnail.image_url}
                        alt={thumbnail.title || "Thumbnail"}
                        className={cn(
                          "h-full w-full object-cover",
                          isIterating && "opacity-50 grayscale-[0.5]"
                        )}
                      />

                      {/* Loading overlay for iterations in progress */}
                      {isIterating && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
                          <div className="flex flex-col items-center gap-3">
                            <div className="rounded-full bg-background/80 p-3 backdrop-blur-md shadow-lg">
                              <Loader2 className="h-6 w-6 text-primary animate-spin" />
                            </div>
                            <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur-md shadow-sm">
                              {t("dashboard.iterating")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-2 space-y-4">
                      <div className="space-y-0 cursor-pointer" onClick={() => navigate(`/thumbnail/${thumbnail.id}`)}>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-1 text-lg font-semibold leading-tight text-card-foreground pt-2.5">
                            {thumbnail.title || t("dashboard.untitledProject")}
                          </h3>
                          {isIterating && (
                            <span className="relative flex h-2.5 w-2.5 flex-none translate-y-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-sm text-muted-foreground/80 leading-relaxed h-11">
                          {thumbnail.subtitle || t("dashboard.noDescription")}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-auto">
                        <div className="flex gap-2">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/thumbnail/${thumbnail.id}`);
                            }}
                            variant="secondary"
                            size="sm"
                            className="h-9 px-4 rounded bg-secondary/80 hover:bg-secondary text-secondary-foreground font-medium text-xs transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                          >
                            {t("dashboard.viewDetails")}
                          </Button>
                          
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(thumbnail);
                            }}
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded border-border/40 hover:bg-secondary/80"
                            disabled={downloadingIds.has(thumbnail.id)}
                          >
                            {downloadingIds.has(thumbnail.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        <span className="text-xs font-medium text-muted-foreground/60">
                          {formatDate(thumbnail.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <Pagination className="mt-8">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className={cn(
                        "cursor-pointer",
                        currentPage === 1 && "pointer-events-none opacity-50"
                      )}
                    />
                  </PaginationItem>
                  
                  {[...Array(totalPages)].map((_, i) => {
                    const page = i + 1;
                    // Logic to show only a subset of pages if there are many
                    if (
                      totalPages > 7 &&
                      page !== 1 &&
                      page !== totalPages &&
                      Math.abs(page - currentPage) > 1
                    ) {
                      if (Math.abs(page - currentPage) === 2) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return null;
                    }

                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className={cn(
                        "cursor-pointer",
                        currentPage === totalPages && "pointer-events-none opacity-50"
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
