import { Home, Package, Sparkles, User, LogOut } from "lucide-react";
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
import { useState, useEffect } from "react";

const mainMenuItems = [
  { icon: Home, label: "Dashboard", path: "/dashboard" },
  { icon: Sparkles, label: "Create", path: "/create" },
];

const contentMenuItems = [
  { icon: Package, label: "Products", path: "/products" },
  { icon: User, label: "Avatars", path: "/avatars" },
];

export const AppDrawer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ username: string | null; email: string | null } | null>(null);
  const [generationsCount, setGenerationsCount] = useState(0);
  const [subscription, setSubscription] = useState<{
    subscribed: boolean;
    product_id: string | null;
  }>({ subscribed: false, product_id: null });

  const subscriptionPlans = {
    "prod_TTytxm2oUYxzXe": { name: "Starter", variant: "secondary" as const },
    "prod_TUGTkbIPU5H2pn": { name: "Pro", variant: "default" as const },
    "prod_TTyuNeWPfbeOFz": { name: "Enterprise", variant: "default" as const }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
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

    // Fetch subscription status
    const { data: subscriptionData } = await supabase.functions.invoke("check-subscription");
    if (subscriptionData) {
      setSubscription(subscriptionData);
    }

    // Count generations based on subscription status
    if (!subscriptionData?.subscribed) {
      // Free tier: count today's generations only
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("thumbnails")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", today.toISOString());

      setGenerationsCount(count || 0);
    } else {
      // Paid tier: count all generations
      const { count } = await supabase
        .from("thumbnails")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setGenerationsCount(count || 0);
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
    toast.success("Signed out successfully");
    navigate("/");
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="left">
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 glass-button hover:bg-white/20 text-white"
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
      <DrawerContent className="h-full w-64 glass-panel border-r border-white/10 rounded-r-3xl rounded-l-none">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-white/10 space-y-6">
            <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">VIZION</h2>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <Avatar className="h-10 w-10 ring-2 ring-white/10">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white font-bold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium truncate text-white">
                    {profile?.username || profile?.email || "User"}
                  </p>
                  {subscription.subscribed && subscription.product_id && subscriptionPlans[subscription.product_id as keyof typeof subscriptionPlans] ? (
                    <Badge variant={subscriptionPlans[subscription.product_id as keyof typeof subscriptionPlans].variant} className="text-[10px] py-0 px-1.5 h-5">
                      {subscriptionPlans[subscription.product_id as keyof typeof subscriptionPlans].name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5 border-white/20 text-muted-foreground">
                      Free
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {subscription.subscribed
                    ? `${generationsCount} generations`
                    : `${generationsCount}/1 today`}
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-6">
            <div className="space-y-1">
              {mainMenuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 ${isActive
                        ? "bg-white/10 text-white shadow-lg shadow-purple-500/10 border border-white/10"
                        : "text-muted-foreground hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? "text-purple-400" : ""}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-white/10">
              <p className="text-xs font-semibold text-muted-foreground mb-4 px-4 uppercase tracking-wider">Content</p>
              <div className="space-y-1">
                {contentMenuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNavigation(item.path)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 ${isActive
                          ? "bg-white/10 text-white shadow-lg shadow-purple-500/10 border border-white/10"
                          : "text-muted-foreground hover:bg-white/5 hover:text-white"
                        }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? "text-purple-400" : ""}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-white/10 space-y-1">
            <button
              onClick={() => handleNavigation("/profile")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 ${location.pathname === "/profile"
                  ? "bg-white/10 text-white shadow-lg shadow-purple-500/10 border border-white/10"
                  : "text-muted-foreground hover:bg-white/5 hover:text-white"
                }`}
            >
              <User className="w-5 h-5" />
              <span>Profile</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all duration-300"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
