import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const requestBody = await req.json();
    const { priceId } = requestBody;
    if (!priceId) throw new Error("Price ID is required");
    logStep("Price ID received", { priceId });

    // Detect if request is from localhost
    // Check multiple headers and request body for localhost indication
    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const xForwardedHost = req.headers.get("x-forwarded-host") || "";
    const isLocalhost = origin.includes("localhost") || 
                        origin.includes("127.0.0.1") || 
                        origin.includes("[::1]") ||
                        xForwardedHost.includes("localhost") ||
                        xForwardedHost.includes("127.0.0.1") ||
                        (requestBody.testMode === true); // Allow explicit test mode flag
    
    logStep("Origin detection", { origin, xForwardedHost, isLocalhost });
    
    // Use test key for localhost, fallback to production key
    const testKey = Deno.env.get("STRIPE_TEST_SECRET_KEY");
    const productionKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    // If localhost and test key exists, use it. Otherwise use production key.
    // If test key doesn't exist but we're on localhost, still try production key as fallback
    const stripeKey = (isLocalhost && testKey) ? testKey : (productionKey || testKey || "");
    
    if (!stripeKey) {
      const errorMsg = isLocalhost 
        ? "Neither STRIPE_TEST_SECRET_KEY nor STRIPE_SECRET_KEY is set. Please set STRIPE_TEST_SECRET_KEY in Supabase Dashboard > Edge Functions > Secrets for localhost testing."
        : "STRIPE_SECRET_KEY is not set. Please set it in Supabase Dashboard > Edge Functions > Secrets.";
      logStep("ERROR: Missing Stripe key", { isLocalhost, hasTestKey: !!testKey, hasProductionKey: !!productionKey });
      throw new Error(errorMsg);
    }
    
    const mode = (isLocalhost && testKey) ? "TEST" : "PRODUCTION";
    const isTestKey = stripeKey.startsWith("sk_test_");
    const isLiveKey = stripeKey.startsWith("sk_live_");
    
    logStep("Stripe key selected", { 
      mode,
      isLocalhost,
      keyPrefix: stripeKey.substring(0, 7) + "...",
      keyType: isTestKey ? "test" : isLiveKey ? "live" : "unknown",
      priceId
    });

    // Validate Price ID matches key mode
    if (isTestKey && !priceId.startsWith("price_")) {
      throw new Error(`Invalid Price ID format: ${priceId}. Test mode requires a valid Stripe Price ID starting with "price_".`);
    }
    if (isLiveKey && priceId.includes("TEST")) {
      logStep("WARNING: Using TEST Price ID with live key", { priceId });
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer, will create in checkout");
    }

    // Determine checkout origin - prefer origin header, fallback to referer, then default
    const checkoutOrigin = origin || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "http://localhost:8080";
    logStep("Creating checkout session", { checkoutOrigin, priceId, mode });
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${checkoutOrigin}/profile?success=true`,
      cancel_url: `${checkoutOrigin}/profile?canceled=true`,
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR in create-checkout", { 
      message: errorMessage,
      stack: errorStack,
      errorType: error?.constructor?.name
    });
    
    // Return more detailed error in development
    const errorResponse: any = { error: errorMessage };
    if (errorStack) {
      errorResponse.details = errorStack;
    }
    
    return new Response(JSON.stringify(errorResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
