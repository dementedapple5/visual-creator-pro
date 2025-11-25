import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Check } from "lucide-react";

const subscriptionPlans = [
  {
    name: "Free",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    priceId: null,
    yearlyPriceId: null,
    productId: null,
    features: [
      "1 thumbnail/day",
      "HD resolution",
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
    yearlyPriceId: "price_yearly_starter",
    productId: "prod_TTytxm2oUYxzXe",
    features: [
      "50 HD thumbnails/month",
      "2K resolution",
      "Email support"
    ]
  },
  {
    name: "Pro",
    monthlyPrice: "$29.99",
    yearlyPrice: "$287.90",
    monthlySavings: null,
    yearlySavings: "20%",
    priceId: "price_1SX0w8ISMAOMUNUM8zz7KCfk",
    yearlyPriceId: "price_yearly_pro",
    productId: "prod_TTytaKmSmKge2x",
    popular: true,
    features: [
      "100 HD thumbnails/month",
      "2K resolution",
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
    yearlyPriceId: "price_yearly_enterprise",
    productId: "prod_TTyuNeWPfbeOFz",
    features: [
      "300 HD thumbnails/month",
      "4K resolution",
      "24/7 support"
    ]
  }
];

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
    product_id: string | null;
    subscription_end: string | null;
  }>({ subscribed: false, product_id: null, subscription_end: null });
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("yearly");

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
      
      if (data) {
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
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Opening checkout...");
        setTimeout(() => checkSubscription(), 3000);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to start checkout");
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
      <main className="container mx-auto px-6 py-12 pl-20 max-w-6xl">
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
                <h2 className="text-2xl font-semibold mb-2">Subscription Plans</h2>
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

            {subscription.subscribed && (
              <Card className="mb-6 bg-primary/5 border-primary">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Active Subscription</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Current plan: {subscriptionPlans.find(p => p.productId === subscription.product_id)?.name || "Active"}
                  </p>
                  {subscription.subscription_end && (
                    <p className="text-sm text-muted-foreground">
                      Renews on: {new Date(subscription.subscription_end).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {!subscription.subscribed && (
              <Card className="mb-6 bg-muted/50 border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-muted-foreground" />
                    <span className="font-semibold">Free Tier</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You're currently on the free plan
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="grid md:grid-cols-4 gap-4">
              {subscriptionPlans.map((plan) => {
                const isCurrentPlan = plan.productId 
                  ? subscription.subscribed && subscription.product_id === plan.productId
                  : !subscription.subscribed;
                const isFree = !plan.priceId;
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
                    {billingInterval === "yearly" && !isFree && (
                      <div className="absolute -top-3 right-4">
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          Save 20%
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
                            <span className="text-muted-foreground">/month</span>
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
                          onClick={() => handleSubscribe(currentPriceId!)}
                          className="w-full"
                          variant={plan.popular ? "default" : "outline"}
                          size="sm"
                          disabled={loading || isCurrentPlan}
                        >
                          {isCurrentPlan ? "Current Plan" : "Subscribe"}
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
