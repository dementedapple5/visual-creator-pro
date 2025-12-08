import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Plan tier detection based on price amount (monthly equivalent)
// This works for both test and production modes
function getPlanTierFromPrice(priceAmount: number): { 
  tier: "starter" | "pro" | "enterprise"; 
  name: string;
  monthlyLimit: number;
} {
  // Convert to monthly equivalent (prices in cents)
  const monthlyAmount = priceAmount;
  
  // Starter: ~$17.99/month = 1799 cents (or ~$14.39/month yearly = ~1439 cents)
  // Pro: ~$29.99/month = 2999 cents (or ~$23.99/month yearly = ~2399 cents)
  // Enterprise: ~$99.99/month = 9999 cents (or ~$79.99/month yearly = ~7999 cents)
  
  if (monthlyAmount <= 2000) {
    // Starter tier (up to $20/month)
    return { tier: "starter", name: "Starter", monthlyLimit: 50 };
  } else if (monthlyAmount <= 4000) {
    // Pro tier ($20-$40/month)
    return { tier: "pro", name: "Pro", monthlyLimit: 100 };
  } else {
    // Enterprise tier ($40+/month)
    return { tier: "enterprise", name: "Enterprise", monthlyLimit: 300 };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const supabaseServiceClient = supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

  try {
    logStep("Function started");

    // Detect if request is from localhost
    const origin = req.headers.get("origin") || "";
    const isLocalhost = origin.includes("localhost") || 
                        origin.includes("127.0.0.1") || 
                        origin.includes("[::1]");
    
    // Use test key for localhost, fallback to production key
    const testKey = Deno.env.get("STRIPE_TEST_SECRET_KEY");
    const productionKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeKey = (isLocalhost && testKey) ? testKey : (productionKey || "");
    
    if (!stripeKey) {
      throw new Error(isLocalhost 
        ? "STRIPE_TEST_SECRET_KEY is not set (required for localhost)" 
        : "STRIPE_SECRET_KEY is not set");
    }
    
    logStep("Stripe key selected", { 
      mode: isLocalhost && testKey ? "TEST" : "PRODUCTION",
      keyPrefix: stripeKey.substring(0, 7) + "..."
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan_name: "Free",
        plan_tier: "free",
        monthly_limit: 1,
        is_daily_limit: true, // Free tier is 1/day, not 1/month
        billing_period_start: null,
        billing_period_end: null,
        billing_interval: "day",
        next_charge_at: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 100,
      expand: ["data.items.data.price"],
    });
    
    logStep("Subscriptions fetched", { 
      count: subscriptions.data.length,
      firstSub: subscriptions.data[0] ? {
        id: subscriptions.data[0].id,
        current_period_start: subscriptions.data[0].current_period_start,
        current_period_end: subscriptions.data[0].current_period_end,
        start_date: subscriptions.data[0].start_date,
      } : null
    });
    // Pick the subscription that ends the latest (most relevant/longest-running)
    const activeSubscription = [...subscriptions.data].sort(
      (a, b) => (b.current_period_end || 0) - (a.current_period_end || 0)
    )[0];
    const hasActiveSub = Boolean(activeSubscription);
    let productId = null;
    let priceId = null;
    let subscriptionEnd = null;
    let subscriptionStart = null;
    let planName = "Free";
    let planTier = "free";
    let monthlyLimit = 1;
    let isDailyLimit = true;
    let billingInterval: "day" | "month" | "year" | null = null;
    let nextChargeAt: string | null = null;
    let subscriptionRowId: string | null = null;

    if (hasActiveSub && activeSubscription) {
      const subscription = activeSubscription;
      
      logStep("Raw subscription data", { 
        id: subscription.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        start_date: subscription.start_date,
        status: subscription.status,
      });
      
      // Safely convert timestamps to ISO strings
      // current_period_end is when the current billing period ends (next charge date)
      if (subscription.current_period_end) {
        try {
          subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
          nextChargeAt = subscriptionEnd;
          logStep("Parsed current_period_end", { raw: subscription.current_period_end, iso: subscriptionEnd });
        } catch (e) {
          logStep("Warning: Could not parse current_period_end", { value: subscription.current_period_end, error: String(e) });
        }
      } else {
        logStep("Warning: current_period_end is missing from subscription");
      }
      
      // current_period_start is when the current billing period started
      if (subscription.current_period_start) {
        try {
          subscriptionStart = new Date(subscription.current_period_start * 1000).toISOString();
          logStep("Parsed current_period_start", { raw: subscription.current_period_start, iso: subscriptionStart });
        } catch (e) {
          logStep("Warning: Could not parse current_period_start", { value: subscription.current_period_start, error: String(e) });
        }
      } else {
        logStep("Warning: current_period_start is missing from subscription");
      }
      
      // Fallback: use start_date if current_period_start is not available
      // start_date is when the subscription was originally created
      if (!subscriptionStart && subscription.start_date) {
        try {
          subscriptionStart = new Date(subscription.start_date * 1000).toISOString();
          logStep("Using start_date as fallback", { raw: subscription.start_date, iso: subscriptionStart });
        } catch (e) {
          logStep("Warning: Could not parse start_date", { value: subscription.start_date, error: String(e) });
        }
      }
      
      logStep("Active subscription found", { subscriptionId: subscription.id, startDate: subscriptionStart, endDate: subscriptionEnd });
      
      // Get price info from the first subscription item
      const subscriptionItem = subscription.items?.data?.[0];
      if (!subscriptionItem?.price) {
        logStep("Warning: No price found in subscription item");
      }
      
      productId = subscriptionItem?.price?.product as string || null;
      priceId = subscriptionItem?.price?.id || null;
      const priceAmount = subscriptionItem?.price?.unit_amount || 0;
      const priceInterval = subscriptionItem?.price?.recurring?.interval;
      
      logStep("Price info", { priceId, priceAmount, priceInterval });
      
      // Calculate monthly equivalent amount for tier detection
      let monthlyEquivalent = priceAmount;
      if (priceInterval === "year") {
        monthlyEquivalent = Math.round(priceAmount / 12);
      }
      billingInterval = priceInterval || null;
      
      const planInfo = getPlanTierFromPrice(monthlyEquivalent);
      planName = planInfo.name;
      planTier = planInfo.tier;
      monthlyLimit = planInfo.monthlyLimit;
      isDailyLimit = false;
      
      logStep("Determined subscription plan", { productId, planName, planTier, monthlyLimit });

      // Persist subscription + linkage using service role (required by RLS)
      if (!supabaseServiceClient) {
        logStep("Warning: SUPABASE_SERVICE_ROLE_KEY not set, skipping DB persistence");
      } else {
        const upsertSub = await supabaseServiceClient
          .from("subscriptions")
          .upsert(
            {
              stripe_subscription_id: subscription.id,
              stripe_customer_id: customerId,
              stripe_product_id: productId,
              stripe_price_id: priceId,
              interval: priceInterval,
              status: subscription.status || null,
              monthly_limit: monthlyLimit,
              current_period_start: subscriptionStart,
              current_period_end: subscriptionEnd,
            },
            { onConflict: "stripe_subscription_id" }
          )
          .select("id")
          .single();

        if (upsertSub.error) {
          logStep("Warning: failed to upsert subscription record", { error: upsertSub.error.message });
        } else {
          subscriptionRowId = upsertSub.data?.id || null;
        }

        if (subscriptionRowId) {
          // Monthly reset even for yearly subscriptions
          const computeMonthlyReset = (startIso?: string | null) => {
            const base = startIso ? new Date(startIso) : new Date();
            if (Number.isNaN(base.getTime())) {
              return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            }
            base.setMonth(base.getMonth() + 1);
            return base.toISOString();
          };

          const resetDate = computeMonthlyReset(subscriptionStart);

          const upsertUserSub = await supabaseServiceClient
            .from("user_subscriptions")
            .upsert(
              {
                user_id: user.id,
                subscription_id: subscriptionRowId,
                start_date: subscriptionStart,
                end_date: subscriptionEnd,
                reset_date: resetDate,
              },
              { onConflict: "user_id,subscription_id" }
            );

          if (upsertUserSub.error) {
            logStep("Warning: failed to upsert user_subscription record", { error: upsertUserSub.error.message });
          }
        }
      }
    } else {
      logStep("No active subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd,
      // New fields for better plan handling
      plan_name: planName,
      plan_tier: planTier,
      monthly_limit: monthlyLimit,
      is_daily_limit: isDailyLimit,
      billing_period_start: subscriptionStart,
      billing_period_end: subscriptionEnd,
      billing_interval: billingInterval,
      next_charge_at: nextChargeAt,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
