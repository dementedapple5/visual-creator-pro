import { Home, Package, Sparkles, User, LogOut, Check, Image as ImageIcon, History, PenTool, Lock, Zap } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getGenerationLimitLabel } from "@/lib/generationLimits";
import { useSubscription } from "@/hooks/use-subscription";

const getMainMenuItems = (t: (key: string) => string) => [
  { icon: Home, label: t("navigation.dashboard"), path: "/dashboard" },
  { icon: Zap, label: t("navigation.quickCreate"), path: "/quick-create" },
  { icon: Sparkles, label: t("navigation.create"), path: "/create" },
  { icon: History, label: t("navigation.generations"), path: "/generations" },
];

const getContentMenuItems = (t: (key: string) => string) => [
  { icon: User, label: t("navigation.avatars"), path: "/avatars" },
  { icon: Package, label: t("navigation.elements"), path: "/products" },
  { icon: ImageIcon, label: t("navigation.backgrounds"), path: "/backgrounds" },
  { icon: PenTool, label: t("navigation.fontStyles"), path: "/font-styles" },
];

// Detect if running on localhost
const isLocalhost = import.meta.env.DEV || 
  (typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
  ));

// Production Price IDs
const productionPlansData = [
  {
    name: "Starter",
    monthlyPrice: "$17.99",
    yearlyPrice: "$172.70",
    yearlySavings: "20%",
    monthlyPriceId: "price_1SX0vtISMAOMUNUM7hJ7Mk45",
    yearlyPriceId: "price_1SXHyGISMAOMUNUMx0LrXEZg",
    productId: "prod_TTytxm2oUYxzXe",
    tier: "starter",
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
    yearlySavings: "20%",
    monthlyPriceId: "price_1SXHwFISMAOMUNUM0syTOyVg",
    yearlyPriceId: "price_1SXI02ISMAOMUNUMd8oTYJPc",
    productId: "prod_TUGTkbIPU5H2pn",
    tier: "pro",
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
    yearlySavings: "20%",
    monthlyPriceId: "price_1SX0wNISMAOMUNUMTz5N3THc",
    yearlyPriceId: "price_1SXI0FISMAOMUNUMgfSnO0Y0",
    productId: "prod_TTyuNeWPfbeOFz",
    tier: "enterprise",
    features: [
      "300 credits/month",
      "100 headshots/month",
      "Advanced customization",
      "24/7 support"
    ]
  }
];

// Test Price IDs - these use env vars with fallbacks to hardcoded test IDs
const testPlansData = [
  {
    name: "Starter",
    monthlyPrice: "$17.99",
    yearlyPrice: "$172.70",
    yearlySavings: "20%",
    monthlyPriceId: import.meta.env.VITE_STRIPE_TEST_STARTER_MONTHLY || "price_1SZg9TEWPks3JDZoOTWeeWtL",
    yearlyPriceId: import.meta.env.VITE_STRIPE_TEST_STARTER_YEARLY || "price_1SZg9QEWPks3JDZoFjQaUHxY",
    productId: import.meta.env.VITE_STRIPE_TEST_STARTER_PRODUCT || null,
    tier: "starter",
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
    yearlySavings: "20%",
    monthlyPriceId: import.meta.env.VITE_STRIPE_TEST_PRO_MONTHLY || "price_1SZg9REWPks3JDZop3BiasS8",
    yearlyPriceId: import.meta.env.VITE_STRIPE_TEST_PRO_YEARLY || "price_1SZg9PEWPks3JDZoFf6QuI9W",
    productId: import.meta.env.VITE_STRIPE_TEST_PRO_PRODUCT || null,
    tier: "pro",
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
    yearlySavings: "20%",
    monthlyPriceId: import.meta.env.VITE_STRIPE_TEST_ENTERPRISE_MONTHLY || "price_1SZg9SEWPks3JDZobpOOCLPy",
    yearlyPriceId: import.meta.env.VITE_STRIPE_TEST_ENTERPRISE_YEARLY || "price_1SZg9OEWPks3JDZoxGEh7vDM",
    productId: import.meta.env.VITE_STRIPE_TEST_ENTERPRISE_PRODUCT || null,
    tier: "enterprise",
    features: [
      "300 credits/month",
      "100 headshots/month",
      "Advanced customization",
      "24/7 support"
    ]
  }
];

// Use test plans on localhost, production plans otherwise
const getSubscriptionPlansData = (t: (key: string) => string) => {
  const basePlans = isLocalhost ? testPlansData : productionPlansData;
  return basePlans.map(plan => ({
    ...plan,
    features: plan.tier === "starter" 
      ? [
          t("plans.starter.features.credits"),
          t("plans.starter.features.headshots"),
          t("plans.starter.features.customization"),
          t("plans.starter.features.support")
        ]
      : plan.tier === "pro"
      ? [
          t("plans.pro.features.credits"),
          t("plans.pro.features.headshots"),
          t("plans.pro.features.customization"),
          t("plans.pro.features.support")
        ]
      : plan.tier === "enterprise"
      ? [
          t("plans.enterprise.features.credits"),
          t("plans.enterprise.features.headshots"),
          t("plans.enterprise.features.customization"),
          t("plans.enterprise.features.support")
        ]
      : plan.features
  }));
};

export const AppDrawer = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("yearly");
  const [stripeLoading, setStripeLoading] = useState(false);
  const [profile, setProfile] = useState<{ username: string | null; email: string | null } | null>(null);
  
  const { 
    subscription, 
    creditsUsed, 
    remainingCredits, 
    refetch: refetchSubscription 
  } = useSubscription();

  const mainMenuItems = getMainMenuItems(t);
  const contentMenuItems = getContentMenuItems(t);
  const subscriptionPlansData = getSubscriptionPlansData(t);

  // Map plan tiers to badge variants
  const planBadgeVariants: Record<string, "secondary" | "default" | "outline"> = {
    "starter": "secondary",
    "pro": "default",
    "enterprise": "default",
    "free": "outline",
  };
  const limitLabel = getGenerationLimitLabel(subscription);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (open) {
      fetchProfile();
      refetchSubscription();
    }
  }, [open, refetchSubscription]);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("username, email")
      .eq("id", user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }
  };

  const getInitials = () => {
    if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase();
    }
    if (profile?.email) {
      return profile.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success(t("drawer.signedOut"));
    navigate("/");
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleSubscribe = async (priceId: string) => {
    try {
      setStripeLoading(true);
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success(t("drawer.openingCheckout"));
        setUpgradeDialogOpen(false);
        setTimeout(() => {
          refetchSubscription();
          fetchProfile();
        }, 3000);
      }
    } catch (error: any) {
      toast.error(error.message || t("drawer.failedCheckout"));
    } finally {
      setStripeLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="left">
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 glass-button text-foreground"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-full w-64 glass-panel border-r border-border rounded-r-3xl rounded-l-none">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border space-y-6">
            <h2 className="text-xl font-bold tracking-tight text-foreground">{t("drawer.vizion")}</h2>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
              <Avatar className="h-10 w-10 ring-2 ring-primary/10">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white font-bold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium truncate text-foreground">
                    {profile?.username || profile?.email || t("common.user")}
                  </p>
                  {subscription.is_super_admin ? (
                    <Badge variant="default" className="text-[10px] py-0 px-1.5 h-5 bg-gradient-to-r from-purple-500 to-blue-600 border-0 whitespace-nowrap shrink-0">
                      SA
                    </Badge>
                  ) : subscription.subscribed ? (
                    <Badge variant={planBadgeVariants[subscription.plan_tier] || "default"} className="text-[10px] py-0 px-1.5 h-5 whitespace-nowrap shrink-0">
                      {subscription.plan_name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5 border-border text-muted-foreground whitespace-nowrap shrink-0">
                      {t("common.free")}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {subscription.is_super_admin 
                    ? `${creditsUsed} ${t("drawer.generated")}`
                    : `${creditsUsed}/${subscription.monthly_limit} ${t("drawer.used")}`}
                </p>
                {!subscription.subscribed && !subscription.is_super_admin && (
                  <Button
                    onClick={() => setUpgradeDialogOpen(true)}
                    variant="default"
                    size="sm"
                    className="w-full mt-2 h-7 text-xs bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white border-0"
                  >
                    {t("common.upgradePlan")}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-6">
            <div className="space-y-1">
              {mainMenuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                const isCreate = item.path === "/create";
                const isLimitReached = remainingCredits <= 0;
                const isDisabled = isCreate && isLimitReached;
                
                return (
                  <div key={item.path} className="space-y-1">
                    <button
                      onClick={() => !isDisabled && handleNavigation(item.path)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 ${
                        isDisabled
                          ? "opacity-50 cursor-not-allowed text-muted-foreground"
                          : isActive
                          ? "bg-secondary text-foreground shadow-lg shadow-purple-500/10 border border-border"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? "text-purple-400" : ""}`} />
                      <span>{item.label}</span>
                    </button>
                    {isCreate && isLimitReached && (
                      <p className="text-xs text-muted-foreground px-4">
                        {limitLabel} {t("drawer.limitReached")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-4 px-4 uppercase tracking-wider">{t("navigation.content")}</p>
              <div className="space-y-1">
                {contentMenuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  const isRestricted = !subscription.subscribed && !subscription.is_super_admin &&
                    ["/products", "/backgrounds", "/font-styles"].includes(item.path);
                  
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNavigation(item.path)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-300 ${isActive
                          ? "bg-secondary text-foreground shadow-lg shadow-purple-500/10 border border-border"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${isActive ? "text-purple-400" : ""}`} />
                        <span>{item.label}</span>
                      </div>
                      {isRestricted && (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-border space-y-1">
            <button
              onClick={() => handleNavigation("/profile")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 ${location.pathname === "/profile"
                  ? "bg-secondary text-foreground shadow-lg shadow-purple-500/10 border border-border"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
            >
              <User className="w-5 h-5" />
              <span>{t("common.profile")}</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all duration-300"
            >
              <LogOut className="w-5 h-5" />
              <span>{t("common.logout")}</span>
            </button>
          </div>
        </div>
      </DrawerContent>

      {/* Upgrade Plan Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="glass-panel border-border max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
              {t("common.chooseYourPlan")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("common.upgradeToUnlock")}
            </DialogDescription>
          </DialogHeader>

          {/* Billing Interval Toggle */}
          <div className="flex items-center justify-center gap-2 p-1 rounded-lg bg-muted border border-border w-fit mx-auto mb-6">
            <button
              onClick={() => setBillingInterval("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                billingInterval === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("common.monthly")}
            </button>
            <button
              onClick={() => setBillingInterval("yearly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all relative ${
                billingInterval === "yearly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("common.yearly")}
              <span className="absolute -top-4 -right-4 text-[10px] bg-gradient-to-r from-purple-500 to-blue-600 text-white px-1.5 py-0.5 rounded-full shadow-lg shadow-purple-500/20">
                20% {t("common.save").toLowerCase()}
              </span>
            </button>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subscriptionPlansData.map((plan) => {
              const priceId = billingInterval === "monthly" ? plan.monthlyPriceId : plan.yearlyPriceId;
              const isPopular = plan.popular;
              
              // Calculate display price
              let displayPrice: string;
              
              if (billingInterval === "monthly") {
                displayPrice = plan.monthlyPrice;
              } else {
                // For yearly, show monthly equivalent
                const yearlyPriceNum = parseFloat(plan.yearlyPrice.replace("$", ""));
                const monthlyEquivalent = (yearlyPriceNum / 12).toFixed(2);
                displayPrice = `$${monthlyEquivalent}`;
              }

              return (
                <div
                  key={plan.productId}
                  className={`relative rounded-xl border p-6 transition-all ${
                    isPopular
                      ? "border-purple-500/50 bg-gradient-to-br from-purple-500/10 to-blue-600/10 shadow-lg shadow-purple-500/20"
                      : "border-border bg-card hover:border-foreground/20"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-500 to-blue-600 text-white border-0">
                        {t("common.mostPopular")}
                      </Badge>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-foreground">{displayPrice}</span>
                        <span className="text-muted-foreground">{t("landing.perMonth")}</span>
                      </div>
                      {billingInterval === "yearly" && plan.yearlySavings && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {plan.yearlyPrice} {t("landing.billedAnnually")} • {t("common.save")} {plan.yearlySavings}
                        </p>
                      )}
                    </div>

                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => handleSubscribe(priceId)}
                      disabled={stripeLoading}
                      className={`w-full ${
                        isPopular
                          ? "bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white border-0 shadow-lg shadow-purple-500/20"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }`}
                    >
                      {stripeLoading ? t("common.processing") : t("common.getStartedButton")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </Drawer>
  );
};
