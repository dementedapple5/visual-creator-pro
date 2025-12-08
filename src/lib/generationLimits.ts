export type SubscriptionInfo = {
  monthly_limit?: number;
  is_daily_limit?: boolean | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  billing_interval?: "month" | "year" | "day" | null;
};

export const getGenerationWindowStart = (subscription: SubscriptionInfo) => {
  const isDailyLimit = subscription.is_daily_limit ?? true;

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

export const getGenerationLimitLabel = (subscription: SubscriptionInfo) =>
  (subscription.is_daily_limit ?? true) ? "Daily" : "Monthly";

export const calculateRemainingGenerations = (
  subscription: SubscriptionInfo,
  usedCount: number
) => {
  const limit = subscription.monthly_limit ?? 1;
  return Math.max(limit - usedCount, 0);
};

