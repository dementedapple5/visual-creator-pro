export type SubscriptionInfo = {
  monthly_limit?: number;
  is_daily_limit?: boolean | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  billing_interval?: "month" | "year" | "day" | null;
  is_super_admin?: boolean;
};

export const getGenerationWindowStart = (subscription: SubscriptionInfo) => {
  if (subscription.is_super_admin) {
    return new Date(0).toISOString(); // Always start from beginning of time for super admins
  }
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
  if (subscription.is_super_admin) {
    return 999999;
  }
  const limit = subscription.monthly_limit ?? 1;
  return Math.max(limit - usedCount, 0);
};

