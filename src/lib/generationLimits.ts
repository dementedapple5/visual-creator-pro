export type SubscriptionInfo = {
  monthly_limit?: number;
  is_daily_limit?: boolean | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  billing_interval?: "month" | "year" | "day" | "forever" | null;
  is_super_admin?: boolean;
  plan_tier?: string;
};

export const getGenerationWindowStart = (subscription: SubscriptionInfo) => {
  if (subscription.is_super_admin) {
    return new Date(0).toISOString(); // Always start from beginning of time for super admins
  }
  
  // If it's forever/one-time, use the billing_period_start (user creation date)
  if (subscription.billing_interval === "forever" && subscription.billing_period_start) {
    return subscription.billing_period_start;
  }

  const isDailyLimit = subscription.is_daily_limit ?? false; // Default to false now

  if (isDailyLimit) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  }

  if (subscription.billing_period_start) {
    return subscription.billing_period_start;
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  return startOfMonth.toISOString();
};

export const getGenerationLimitLabel = (subscription: SubscriptionInfo) => {
  if (subscription.is_super_admin) return "Unlimited";
  if (subscription.billing_interval === "forever") return "One-time";
  return (subscription.is_daily_limit) ? "Daily" : "Monthly";
};

export const calculateRemainingGenerations = (
  subscription: SubscriptionInfo,
  usedCount: number
) => {
  if (subscription.is_super_admin) {
    return 999999;
  }
  const limit = subscription.monthly_limit ?? 1;
  return Math.max(limit - usedCount, 0);
};

