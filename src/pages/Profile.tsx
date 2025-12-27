import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Detect if running on localhost
const isLocalhost = import.meta.env.DEV || 
  (typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
  ));

// Production Price IDs (Live mode)
const productionPlans = [
  {
    name: "Free",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    priceId: null,
    yearlyPriceId: null,
    productId: null,
    tier: "free" as const,
    features: [
      "5 one-time credits",
      "Email support"
    ]
  },
  {
    name: "Starter",
    monthlyPrice: "$17.99",
    yearlyPrice: "$172.70",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: "price_1SX0vtISMAOMUNUM7hJ7Mk45",
    yearlyPriceId: "price_1SXHyGISMAOMUNUMx0LrXEZg",
    productId: "prod_TTytxm2oUYxzXe",
    tier: "starter" as const,
    features: [
      "50 credits/month",
      "10 headshots/month",
      "Advanced customization",
      "Email support"
    ]
  },
  {
    name: "Pro",
    monthlyPrice: "$29.99",
    yearlyPrice: "$287.90",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: "price_1SXHwFISMAOMUNUM0syTOyVg",
    yearlyPriceId: "price_1SXI02ISMAOMUNUMd8oTYJPc",
    productId: "prod_TUGTkbIPU5H2pn",
    tier: "pro" as const,
    popular: true,
    features: [
      "100 credits/month",
      "30 headshots/month",
      "Advanced customization",
      "Priority support"
    ]
  },
  {
    name: "Enterprise",
    monthlyPrice: "$99.99",
    yearlyPrice: "$959.90",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: "price_1SX0wNISMAOMUNUMTz5N3THc",
    yearlyPriceId: "price_1SXI0FISMAOMUNUMgfSnO0Y0",
    productId: "prod_TTyuNeWPfbeOFz",
    tier: "enterprise" as const,
    features: [
      "300 credits/month",
      "100 headshots/month",
      "Advanced customization",
      "24/7 support"
    ]
  }
];

// Test/Sandbox Price IDs (Test mode)
// ⚠️ IMPORTANT: Replace the placeholder Price IDs below with your actual test Price IDs from Stripe Dashboard (Test mode)
// To get your test Price IDs:
// 1. Go to Stripe Dashboard (make sure Test mode toggle is ON)
// 2. Go to Products
// 3. Click on each product and copy the Price IDs (they start with "price_")
// 4. Replace the placeholder values below
const testPlans = [
  {
    name: "Free",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    priceId: null,
    yearlyPriceId: null,
    productId: null,
    tier: "free" as const,
    features: [
      "5 one-time credits",
      "Email support"
    ]
  },
  {
    name: "Starter",
    monthlyPrice: "$17.99",
    yearlyPrice: "$172.70",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: import.meta.env.VITE_STRIPE_TEST_STARTER_MONTHLY || "price_1SZg9TEWPks3JDZoOTWeeWtL",
    yearlyPriceId: import.meta.env.VITE_STRIPE_TEST_STARTER_YEARLY || "price_1SZg9QEWPks3JDZoFjQaUHxY",
    productId: import.meta.env.VITE_STRIPE_TEST_STARTER_PRODUCT || null,
    tier: "starter" as const,
    features: [
      "50 credits/month",
      "10 headshots/month",
      "Advanced customization",
      "Email support"
    ]
  },
  {
    name: "Pro",
    monthlyPrice: "$29.99",
    yearlyPrice: "$287.90",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: import.meta.env.VITE_STRIPE_TEST_PRO_MONTHLY || "price_1SZg9REWPks3JDZop3BiasS8",
    yearlyPriceId: import.meta.env.VITE_STRIPE_TEST_PRO_YEARLY || "price_1SZg9PEWPks3JDZoFf6QuI9W",
    productId: import.meta.env.VITE_STRIPE_TEST_PRO_PRODUCT || null,
    tier: "pro" as const,
    popular: true,
    features: [
      "100 credits/month",
      "30 headshots/month",
      "Advanced customization",
      "Priority support"
    ]
  },
  {
    name: "Enterprise",
    monthlyPrice: "$99.99",
    yearlyPrice: "$959.90",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: import.meta.env.VITE_STRIPE_TEST_ENTERPRISE_MONTHLY || "price_1SZg9SEWPks3JDZobpOOCLPy",
    yearlyPriceId: import.meta.env.VITE_STRIPE_TEST_ENTERPRISE_YEARLY || "price_1SZg9OEWPks3JDZoxGEh7vDM",
    productId: import.meta.env.VITE_STRIPE_TEST_ENTERPRISE_PRODUCT || null,
    tier: "enterprise" as const,
    features: [
      "300 credits/month",
      "100 headshots/month",
      "Advanced customization",
      "24/7 support"
    ]
  }
];

// Use test plans on localhost, production plans otherwise
const subscriptionPlans = isLocalhost ? testPlans : productionPlans;

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingUsername, setUpdatingUsername] = useState(false);
  const [subscription, setSubscription] = useState<{
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
    billing_interval?: "day" | "month" | "year" | "forever" | null;
  }>({ 
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
  });
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("yearly");
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    checkUser();
    checkSubscription();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    setEmail(session.user.email || "");
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    
    if (profile) {
      setUsername(profile.username || "");
    }
  };

  const handleUpdateUsername = async () => {
    if (!username.trim()) {
      toast.error("Username cannot be empty");
      return;
    }

    try {
      setUpdatingUsername(true);
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.trim() })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Username updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update username");
    } finally {
      setUpdatingUsername(false);
    }
  };

  const checkSubscription = async () => {
    try {
      setCheckingSubscription(true);
      const { data, error } = await supabase.functions.invoke("check-subscription");
      
      if (error) throw error;
      
      if (data && !data.error) {
        setSubscription(data);
      }
    } catch (error: any) {
      console.error("Error checking subscription:", error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (priceId: string) => {
    try {
      setLoading(true);
      
      // Validate Price ID format - must be a real Stripe Price ID
      if (!priceId || !priceId.startsWith("price_") || priceId.length < 25) {
        const errorMsg = `Invalid Price ID: "${priceId}". This looks like a placeholder. Please update testPlans in Profile.tsx with real Stripe test Price IDs from your Stripe Dashboard (Test mode).`;
        console.error(errorMsg);
        toast.error(errorMsg);
        return;
      }
      
      // Check if it's a placeholder
      if (priceId.includes("TEST_") && !priceId.match(/^price_[a-zA-Z0-9]{24,}$/)) {
        const errorMsg = `Placeholder Price ID detected: "${priceId}". Please replace it with a real Stripe test Price ID. Get it from Stripe Dashboard > Products (Test mode) > Your Product > Copy Price ID.`;
        console.error(errorMsg);
        toast.error(errorMsg);
        return;
      }
      
      console.log("Initiating checkout with:", { priceId, isLocalhost, testMode: isLocalhost });
      
      const response = await supabase.functions.invoke("create-checkout", {
        body: { 
          priceId,
          testMode: isLocalhost // Explicitly pass test mode flag
        },
      });

      const { data, error } = response;
      
      console.log("Checkout response:", { data, error });

      if (error) {
        console.error("Checkout error:", error);
        
        // Try to extract error message
        let errorMessage = "Failed to start checkout";
        
        // Check error.message
        if (error.message) {
          errorMessage = error.message;
        }
        
        // Check error.context
        if (error.context && typeof error.context === 'object' && Object.keys(error.context).length > 0) {
          const context = error.context as any;
          if (context.error) errorMessage = context.error;
          else if (context.message) errorMessage = context.message;
        }
        
        // Check data for error
        if (data?.error) {
          errorMessage = data.error;
        }
        
        console.error("Error message:", errorMessage);
        console.error("💡 Check Network tab > create-checkout request > Response tab for detailed error");
        console.error("💡 Check Supabase Dashboard > Edge Functions > create-checkout > Logs");
        
        toast.error(errorMessage);
        return;
      }

      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Opening checkout...");
        setTimeout(() => checkSubscription(), 3000);
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        console.warn("No URL or error in response:", data);
        toast.error("Unexpected response from checkout. Check console for details.");
      }
    } catch (error: any) {
      console.error("Checkout exception:", error);
      const errorMessage = error?.message || 
                          error?.error?.message ||
                          error?.context?.error ||
                          "Failed to start checkout. Check console for details.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to open customer portal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-4 max-w-6xl">
        <div className="space-y-8">
          {/* User Info */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl">Account Information</CardTitle>
              <CardDescription>View your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} disabled className="bg-secondary" />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <div className="flex gap-2">
                  <Input 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                  />
                  <Button
                    onClick={handleUpdateUsername}
                    disabled={updatingUsername}
                    size="sm"
                  >
                    Update
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>User ID</Label>
                <Input value={user?.id || ""} disabled className="bg-secondary text-xs" />
              </div>
            </CardContent>
          </Card>

          {/* Theme Switcher */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl">Appearance</CardTitle>
              <CardDescription>Customize how the app looks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Label>Theme</Label>
                <Tabs value={theme} onValueChange={setTheme} className="w-full max-w-xs">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="light" className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      <span className="hidden sm:inline">Light</span>
                    </TabsTrigger>
                    <TabsTrigger value="dark" className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      <span className="hidden sm:inline">Dark</span>
                    </TabsTrigger>
                    <TabsTrigger value="system" className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      <span className="hidden sm:inline">System</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          {/* Update Password */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl">Update Password</CardTitle>
              <CardDescription>Change your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
              <Button
                onClick={handleUpdatePassword}
                disabled={loading || !newPassword || !confirmPassword}
                size="sm"
              >
                Update Password
              </Button>
            </CardContent>
          </Card>

          {/* Subscription Plans */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-semibold">Subscription Plans</h2>
                  {isLocalhost && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-full font-medium">
                      TEST MODE
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Choose the plan that fits your needs
                </p>
              </div>
              {subscription.subscribed && (
                <Button onClick={handleManageSubscription} disabled={loading} variant="outline" size="sm">
                  Manage Subscription
                </Button>
              )}
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className={`text-sm ${billingInterval === "monthly" ? "font-semibold" : "text-muted-foreground"}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingInterval(billingInterval === "monthly" ? "yearly" : "monthly")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  billingInterval === "yearly" ? "bg-primary" : "bg-secondary"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                    billingInterval === "yearly" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-sm ${billingInterval === "yearly" ? "font-semibold" : "text-muted-foreground"}`}>
                Yearly
              </span>
              {billingInterval === "yearly" && (
                <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-1 rounded-full">
                  Save 20%
                </span>
              )}
            </div>

            {subscription.is_super_admin && (
              <Card className="mb-6 bg-gradient-to-r from-purple-500/10 to-blue-600/10 border-purple-500/50 shadow-lg shadow-purple-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-purple-500" />
                    <span className="font-semibold text-purple-600 dark:text-purple-400">Super Admin Active</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You have full access to all features and unlimited generations.
                  </p>
                </CardContent>
              </Card>
            )}

            {subscription.subscribed && !subscription.is_super_admin && (
              <Card className="mb-6 bg-primary/5 border-primary">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Active Subscription</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Current plan: {subscription.plan_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Monthly limit: {subscription.monthly_limit} thumbnails
                  </p>
                  {subscription.subscription_end && (
                    <p className="text-sm text-muted-foreground">
                      Renews on: {new Date(subscription.subscription_end).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {!subscription.subscribed && !subscription.is_super_admin && (
              <Card className="mb-6 bg-muted/50 border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-muted-foreground" />
                    <span className="font-semibold">Free Tier</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You're currently on the free plan with 5 one-time credits
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="grid md:grid-cols-4 gap-4">
              {subscriptionPlans.map((plan) => {
                const isFree = !plan.priceId;
                // Match current plan using plan_tier from subscription response
                // This works for both test and production environments
                const isCurrentPlan = subscription.plan_tier === plan.tier;
                const currentPriceId = billingInterval === "monthly" ? plan.priceId : plan.yearlyPriceId;
                
                // Calculate prices
                const monthlyPrice = parseFloat(plan.monthlyPrice.replace("$", ""));
                const discountedMonthlyPrice = monthlyPrice * 0.8;
                const yearlyTotal = parseFloat(plan.yearlyPrice.replace("$", ""));
                
                return (
                  <Card
                    key={plan.name}
                    className={`bg-card border-border relative transition-all duration-300 hover:scale-105 hover:shadow-lg ${
                      plan.popular ? "ring-2 ring-primary" : ""
                    } ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
                  >
                    {plan.popular && !isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                          Your Plan
                        </span>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <CardDescription>
                        {billingInterval === "monthly" ? (
                          <>
                            <span className="text-3xl font-bold text-foreground">
                              {plan.monthlyPrice}
                            </span>
                            {!isFree && <span className="text-muted-foreground">/month</span>}
                          </>
                        ) : (
                          <>
                            {!isFree ? (
                              <>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-lg text-muted-foreground line-through">
                                    {plan.monthlyPrice}
                                  </span>
                                  <span className="text-3xl font-bold text-foreground">
                                    ${discountedMonthlyPrice.toFixed(2)}
                                  </span>
                                  <span className="text-muted-foreground">/month</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Billed annually at {plan.yearlyPrice}
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-3xl font-bold text-foreground">
                                  {plan.monthlyPrice}
                                </span>
                                <span className="text-muted-foreground">/month</span>
                              </>
                            )}
                          </>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {!isFree && (
                        <Button
                          onClick={() => {
                            if (!currentPriceId) {
                              toast.error(`Test Price ID not configured for ${plan.name}. Please update testPlans in Profile.tsx with your Stripe test Price IDs.`);
                              return;
                            }
                            handleSubscribe(currentPriceId);
                          }}
                          className="w-full"
                          variant={plan.popular ? "default" : "outline"}
                          size="sm"
                          disabled={loading || isCurrentPlan || !currentPriceId}
                        >
                          {isCurrentPlan ? "Current Plan" : !currentPriceId ? "Price ID Missing" : "Subscribe"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
