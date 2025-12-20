import { ReactNode } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Loader2, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SubscriptionGuardProps {
  children: ReactNode;
  requiredTier?: "starter" | "pro" | "enterprise";
}

export const SubscriptionGuard = ({ children }: SubscriptionGuardProps) => {
  const { loading, isFree } = useSubscription();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Checking subscription...</p>
      </div>
    );
  }

  if (isFree) {
    return (
      <div className="container mx-auto px-6 py-12 flex items-center justify-center min-h-[70vh]">
        <Card className="max-w-md w-full border-primary/20 bg-secondary/30 backdrop-blur-sm shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <Crown className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Pro Feature</CardTitle>
            <CardDescription className="text-base mt-2">
              The page you're looking for is only available on our paid plans.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-background/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="bg-primary/20 p-1.5 rounded-full shrink-0">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                <span>Unlimited Elements & Backgrounds</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="bg-primary/20 p-1.5 rounded-full shrink-0">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                <span>Custom Font Styles & Titles</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="bg-primary/20 p-1.5 rounded-full shrink-0">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                <span>Higher generation limits</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button 
              className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
              onClick={() => navigate("/profile")}
            >
              View Pricing Plans
            </Button>
            <Button 
              variant="ghost" 
              className="w-full"
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

