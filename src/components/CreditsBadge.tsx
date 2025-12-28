import { Zap } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const CreditsBadge = () => {
  const { subscription, remainingCredits, loading, isSuperAdmin } = useSubscription();
  const { t } = useTranslation();

  if (loading) {
    return <Skeleton className="h-9 w-24 rounded-full bg-muted/50" />;
  }

  const isLowCredits = remainingCredits <= 2 && !isSuperAdmin;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center">
            <Badge 
              variant="outline" 
              className={`h-9 px-4 gap-2 glass-panel border-border transition-all duration-300 hover:bg-secondary/50 cursor-default rounded-full ${
                isLowCredits ? "border-amber-500/50 text-amber-500 shadow-lg shadow-amber-500/10" : "text-foreground"
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isLowCredits ? "fill-amber-500 animate-pulse" : "fill-purple-500 text-purple-500"}`} />
              <span className="font-medium text-sm">
                {isSuperAdmin ? "∞" : remainingCredits}
              </span>
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent className="glass-panel border-border">
          <p className="text-xs font-medium">
            {isSuperAdmin 
              ? "Unlimited Credits" 
              : `${remainingCredits} / ${subscription.monthly_limit} credits remaining`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
