import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

const DEFAULT_SUBSCRIPTION: SubscriptionData = {
  subscribed: false,
  is_super_admin: false,
  product_id: null,
  subscription_end: null,
  plan_name: "Free",
  plan_tier: "free",
  monthly_limit: 1,
  is_daily_limit: true,
  billing_period_start: null,
  billing_period_end: null,
};

export const useSubscription = () => {
  const [subscription, setSubscription] = useState<SubscriptionData>(DEFAULT_SUBSCRIPTION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const { data, error: invokeError } = await supabase.functions.invoke("check-subscription");
      
      if (invokeError) throw invokeError;
      
      if (data && !data.error) {
        setSubscription(data);
      }
    } catch (err: any) {
      console.error("Error fetching subscription:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
    
    // Subscribe to auth changes to refetch subscription
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchSubscription();
      } else if (event === "SIGNED_OUT") {
        setSubscription(DEFAULT_SUBSCRIPTION);
      }
    });

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  return {
    subscription,
    loading,
    error,
    isFree: subscription.plan_tier === "free" && !subscription.is_super_admin,
    isSuperAdmin: !!subscription.is_super_admin,
    refetch: fetchSubscription,
  };
};

