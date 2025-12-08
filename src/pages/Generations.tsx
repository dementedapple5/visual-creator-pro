import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { calculateRemainingGenerations, getGenerationLimitLabel, getGenerationWindowStart, type SubscriptionInfo } from "@/lib/generationLimits";
import { toast } from "sonner";

type GenerationRecord = {
  id: string;
  status: string;
  mode: string;
  created_at: string;
  completed_at: string | null;
  image_url: string | null;
  title: string | null;
  subtitle: string | null;
  aspect_ratio: string | null;
  thumbnail_id: string | null;
  error_message: string | null;
  remix_prompt?: string | null;
  prompt?: string | null;
};

type SubscriptionData = SubscriptionInfo & {
  subscribed: boolean;
  product_id: string | null;
  plan_name: string;
  plan_tier: "free" | "starter" | "pro" | "enterprise";
  subscription_end: string | null;
  next_charge_at?: string | null;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "secondary",
  processing: "default",
  pending: "default",
  failed: "destructive",
};

const modeLabel: Record<string, string> = {
  create: "Create",
  remix: "Remix",
  iterate: "Iterate",
};

const Generations = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [usedCount, setUsedCount] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [subscription, setSubscription] = useState<SubscriptionData>({
    subscribed: false,
    product_id: null,
    plan_name: "Free",
    plan_tier: "free",
    monthly_limit: 1,
    is_daily_limit: true,
    billing_period_start: null,
    billing_period_end: null,
    billing_interval: null,
    subscription_end: null,
    next_charge_at: null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: subscriptionData } = await supabase.functions.invoke("check-subscription");
      const activeSubscription = subscriptionData && !subscriptionData.error
        ? subscriptionData as SubscriptionData
        : subscription;

      if (subscriptionData && !subscriptionData.error) {
        setSubscription(subscriptionData as SubscriptionData);
      }

      const windowStart = getGenerationWindowStart(activeSubscription || {});

      const { data, error } = await supabase
        .from("generations")
        .select("id, status, mode, created_at, completed_at, image_url, title, subtitle, aspect_ratio, thumbnail_id, error_message, remix_prompt, prompt", { count: "exact" })
        .eq("user_id", session.user.id)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const records = data || [];
      const completedCount = records.filter((item) => item.status === "completed").length;

      setGenerations(records as GenerationRecord[]);
      setUsedCount(completedCount);
      setRemaining(calculateRemainingGenerations(activeSubscription || {}, completedCount));
    } catch (error) {
      console.error("Error loading generations", error);
      toast.error("Failed to load generations history");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value: string | Date | null) => {
    if (!value) return "Not available";

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString();
  };

  const getResetDate = () => {
    if (subscription.is_daily_limit) {
      const nextReset = new Date();
      nextReset.setHours(24, 0, 0, 0);
      return nextReset;
    }

    // For subscriptions (monthly or yearly), credits reset monthly
    // Calculate based on the billing period start date
    if (subscription.subscribed && subscription.billing_period_start) {
      const startDate = new Date(subscription.billing_period_start);
      if (!Number.isNaN(startDate.getTime())) {
        const now = new Date();
        const dayOfMonth = startDate.getDate();
        
        // Start with current month's reset date
        let nextReset = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
        
        // If we've passed this month's reset date, move to next month
        if (nextReset <= now) {
          nextReset.setMonth(nextReset.getMonth() + 1);
        }
        
        // Handle edge case: if dayOfMonth is 31 but next month only has 30 days
        // JavaScript Date automatically handles this, but let's be explicit
        if (nextReset.getDate() !== dayOfMonth) {
          // Day rolled over to next month, set to last day of intended month
          nextReset.setDate(0); // Sets to last day of previous month
        }
        
        return nextReset;
      }
    }

    return null;
  };

  const limitLabel = getGenerationLimitLabel(subscription);
  const remainingLabel = subscription.is_daily_limit ? "today" : "this period";
  const resetDate = getResetDate();

  // Calculate billing interval label for plan title
  const billingIntervalSuffix = subscription.subscribed
    ? subscription.billing_interval === "year"
      ? "Yearly"
      : subscription.billing_interval === "month"
        ? "Monthly"
        : ""
    : "";
  
  // Build plan title with billing interval (e.g., "Starter Monthly" or "Pro Yearly")
  const planTitleWithBilling = subscription.subscribed && billingIntervalSuffix
    ? `${subscription.plan_name} ${billingIntervalSuffix}`
    : subscription.plan_name;

  // Calculate subscription period dates
  const subscriptionStartDate = subscription.billing_period_start
    ? new Date(subscription.billing_period_start)
    : null;
  
  // Calculate end date: use provided end date, or calculate from start date
  const calculateEndDate = () => {
    if (subscription.billing_period_end) {
      const end = new Date(subscription.billing_period_end);
      if (!Number.isNaN(end.getTime())) return end;
    }
    
    // Calculate from start date if end date not available
    // Use proper month/year arithmetic to handle varying month lengths
    if (subscriptionStartDate && !Number.isNaN(subscriptionStartDate.getTime())) {
      const calculatedEnd = new Date(subscriptionStartDate);
      if (subscription.billing_interval === "year") {
        // Add 1 year
        calculatedEnd.setFullYear(calculatedEnd.getFullYear() + 1);
      } else {
        // Add 1 month (handles varying month lengths correctly)
        calculatedEnd.setMonth(calculatedEnd.getMonth() + 1);
      }
      return calculatedEnd;
    }
    
    return null;
  };
  
  const subscriptionEndDate = calculateEndDate();
  
  // Format date as short date string (e.g., "Dec 8, 2025")
  const formatShortDate = (date: Date | null) => {
    if (!date || Number.isNaN(date.getTime())) return "Not available";
    return date.toLocaleDateString(undefined, { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  };

  const subscriptionPeriodLabel = subscription.subscribed
    ? `${formatShortDate(subscriptionStartDate)} - ${formatShortDate(subscriptionEndDate)}`
    : "Free tier";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Usage</p>
            <h1 className="text-2xl font-semibold">Generation History</h1>
            <p className="text-sm text-muted-foreground">
              Track every generation, status, and remaining credits.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
            <Button onClick={() => navigate("/create")}>
              New Generation
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Used {remainingLabel}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-bold">{usedCount}/{subscription.monthly_limit}</p>
              <p className="text-sm text-muted-foreground">
                Status: {limitLabel} limit • Resets on {formatShortDate(resetDate)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Plan</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <p className="text-lg font-semibold">{planTitleWithBilling}</p>
              <p className="text-sm text-muted-foreground">
                {subscriptionPeriodLabel}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-border/60 bg-card/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, idx) => (
                  <div key={idx} className="h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : generations.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No generations yet in this period.
              </div>
            ) : (
              <ScrollArea className="max-h-[600px] pr-4">
                <div className="relative pl-4">
                  <div className="absolute left-1 top-0 bottom-0 w-px bg-border" />
                  {generations.map((item, index) => (
                    <div key={item.id} className="relative pl-4 pb-6 last:pb-0">
                      <span className="absolute left-[-9px] top-2 h-2.5 w-2.5 rounded-full bg-primary" />
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">
                              {item.title || "Untitled generation"}
                            </p>
                            <Badge variant={statusVariant[item.status] || "outline"} className="capitalize">
                              {item.status}
                            </Badge>
                            <Badge variant="outline">
                              {modeLabel[item.mode] || item.mode}
                            </Badge>
                            {item.aspect_ratio && (
                              <Badge variant="outline">{item.aspect_ratio}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(item.created_at)}
                          </p>
                          {item.subtitle && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{item.subtitle}</p>
                          )}
                          {item.prompt && (
                            <p className="text-xs text-muted-foreground line-clamp-2">Prompt: {item.prompt}</p>
                          )}
                          {item.remix_prompt && (
                            <p className="text-xs text-muted-foreground line-clamp-2">Remix: {item.remix_prompt}</p>
                          )}
                          {item.error_message && (
                            <p className="text-xs text-destructive">Error: {item.error_message}</p>
                          )}
                          {item.thumbnail_id && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => navigate(`/thumbnail/${item.thumbnail_id}`)}
                              >
                                Open
                              </Button>
                            </div>
                          )}
                        </div>
                        {item.image_url && (
                          <div className="mt-2 md:mt-0">
                            <img
                              src={item.image_url}
                              alt={item.title || "Generated thumbnail"}
                              className="h-24 w-40 rounded-lg border border-border object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Generations;

