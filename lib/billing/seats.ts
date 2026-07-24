/**
 * Soft seat caps by plan tier. Invites are blocked when members + pending
 * would exceed the cap — raise via plan change / admin, not a Settings toggle.
 */
export const PLAN_SEAT_LIMITS = {
  trial: 5,
  team: 25,
  business: 100,
  enterprise: 1000
} as const;

export type PlanTierForSeats = keyof typeof PLAN_SEAT_LIMITS;

export function seatLimitForPlan(planTier: string | null | undefined): number {
  if (planTier && planTier in PLAN_SEAT_LIMITS) {
    return PLAN_SEAT_LIMITS[planTier as PlanTierForSeats];
  }
  return PLAN_SEAT_LIMITS.trial;
}

export function seatsRemaining(params: {
  planTier: string;
  memberCount: number;
}): { limit: number; used: number; remaining: number; atLimit: boolean } {
  const limit = seatLimitForPlan(params.planTier);
  const used = params.memberCount;
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining, atLimit: used >= limit };
}
