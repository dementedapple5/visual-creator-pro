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

const menuItems = [
  { icon: Home, label: "Dashboard", path: "/dashboard" },
  { icon: Sparkles, label: "Create", path: "/create" },
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
    "prod_TTytaKmSmKge2x": { name: "Pro", variant: "default" as const },
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

    // Count thumbnails generated
    const { count } = await supabase
      .from("thumbnails")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    setGenerationsCount(count || 0);

    // Fetch subscription status
    const { data: subscriptionData } = await supabase.functions.invoke("check-subscription");
    if (subscriptionData) {
      setSubscription(subscriptionData);
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
          className="fixed top-4 left-4 z-50 bg-secondary hover:bg-accent"
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
      <DrawerContent className="h-full w-60 bg-card border-border">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border space-y-4">
            <h2 className="text-sm font-semibold tracking-wide">VIZION</h2>
            
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-primary text-primary-foreground">
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium truncate">
                    {profile?.username || profile?.email || "User"}
                  </p>
                  {subscription.subscribed && subscription.product_id && subscriptionPlans[subscription.product_id as keyof typeof subscriptionPlans] ? (
                    <Badge variant={subscriptionPlans[subscription.product_id as keyof typeof subscriptionPlans].variant} className="text-xs py-0 px-1.5">
                      {subscriptionPlans[subscription.product_id as keyof typeof subscriptionPlans].name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs py-0 px-1.5">
                      Free
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {generationsCount} generations
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-2">
            <div className="space-y-0.5">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="p-2 border-t border-border space-y-0.5">
            <button
              onClick={() => handleNavigation("/profile")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                location.pathname === "/profile"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
