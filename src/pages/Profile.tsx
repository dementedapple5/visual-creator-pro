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
    name: "Starter",
    price: "$9.99",
    priceId: "price_starter",
    features: [
      "50 thumbnails per month",
      "Basic AI generation",
      "HD quality exports",
      "Email support"
    ]
  },
  {
    name: "Pro",
    price: "$19.99",
    priceId: "price_pro",
    popular: true,
    features: [
      "200 thumbnails per month",
      "Advanced AI generation",
      "4K quality exports",
      "Priority support",
      "Custom templates"
    ]
  },
  {
    name: "Enterprise",
    price: "$49.99",
    priceId: "price_enterprise",
    features: [
      "Unlimited thumbnails",
      "Premium AI generation",
      "8K quality exports",
      "24/7 dedicated support",
      "Custom branding",
      "API access"
    ]
  }
];

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    setEmail(session.user.email || "");
    
    // Fetch profile data
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    
    if (profile) {
      setName(profile.email || "");
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

  const handleSubscribe = (priceId: string) => {
    toast.info("Subscription feature coming soon!");
    // TODO: Integrate with Stripe
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
            <h2 className="text-2xl font-semibold mb-2">Subscription Plans</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Choose the plan that fits your needs
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              {subscriptionPlans.map((plan) => (
                <Card
                  key={plan.priceId}
                  className={`bg-card border-border relative ${
                    plan.popular ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription>
                      <span className="text-3xl font-bold text-foreground">
                        {plan.price}
                      </span>
                      <span className="text-muted-foreground">/month</span>
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
                    <Button
                      onClick={() => handleSubscribe(plan.priceId)}
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      size="sm"
                    >
                      Subscribe
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
