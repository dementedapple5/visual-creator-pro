import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  calculateRemainingGenerations, 
  getGenerationWindowStart 
} from "@/lib/generationLimits";

export interface SubscriptionData {
  subscribed: boolean;
  is_super_admin?: boolean;
  product_id: string | null;
  subscription_end: string | null;
  plan_name: string;
  plan_tier: "free" | "starter" | "pro" | "enterprise";
  monthly_limit: number;
  is_daily_limit: boolean;
  billing_period_start: string | null;
  billing_period_end: string | null;
  billing_interval: "day" | "month" | "year" | "forever" | null;
}

const DEFAULT_SUBSCRIPTION: SubscriptionData = {
  subscribed: false,
  is_super_admin: false,
  product_id: null,
  subscription_end: null,
  plan_name: "Free",
  plan_tier: "free",
  monthly_limit: 5,
  is_daily_limit: false,
  billing_period_start: null,
  billing_period_end: null,
  billing_interval: "forever",
};

export const useSubscription = () => {
  const [subscription, setSubscription] = useState<SubscriptionData>(DEFAULT_SUBSCRIPTION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [remainingCredits, setRemainingCredits] = useState(0);

  const fetchSubscriptionAndUsage = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubscription(DEFAULT_SUBSCRIPTION);
        setCreditsUsed(0);
        setRemainingCredits(0);
        return;
      }

      // Fetch subscription from Edge Function
      const { data: subData, error: invokeError } = await supabase.functions.invoke("check-subscription");
      
      if (invokeError) throw invokeError;
      
      let activeSub = DEFAULT_SUBSCRIPTION;
      if (subData && !subData.error) {
        activeSub = subData;
        setSubscription(subData);
      }

      // Fetch usage data
      const countStartDate = getGenerationWindowStart(activeSub);

      const { data: usageData, error: usageError } = await supabase
        .from("generations")
        .select("credits_used")
        .eq("user_id", user.id)
        .in("status", ["completed", "processing"])
        .gte("created_at", countStartDate);

      if (usageError) throw usageError;

      const used = usageData?.reduce((acc, curr) => acc + (curr.credits_used || 0), 0) || 0;
      setCreditsUsed(used);
      setRemainingCredits(calculateRemainingGenerations(activeSub, used));

    } catch (err: any) {
      console.error("Error fetching subscription/usage:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptionAndUsage();
    
    // Subscribe to auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchSubscriptionAndUsage();
      } else if (event === "SIGNED_OUT") {
        setSubscription(DEFAULT_SUBSCRIPTION);
        setCreditsUsed(0);
        setRemainingCredits(0);
      }
    });

    return () => {
      authSubscription.unsubscribe();
    };
  }, [fetchSubscriptionAndUsage]);

  return {
    subscription,
    loading,
    error,
    creditsUsed,
    remainingCredits,
    isFree: subscription.plan_tier === "free" && !subscription.is_super_admin,
    isSuperAdmin: !!subscription.is_super_admin,
    refetch: fetchSubscriptionAndUsage,
  };
};

