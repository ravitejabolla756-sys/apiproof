export interface PlanDefinition {
  id: string;
  name: string;
  description: string;
  /** null means custom pricing. */
  priceMonthly: number | null;
  currency: string;
  limits: {
    /** null means unlimited for this metric. */
    maxRepositories: number | null;
    maxScansPerMonth: number | null;
    maxDraftPrsPerMonth: number | null;
  };
}

export const PLANS: Record<string, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'For individual developers',
    priceMonthly: 0,
    currency: 'inr',
    limits: {
      maxRepositories: 1,
      maxScansPerMonth: 3,
      maxDraftPrsPerMonth: 2,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For fast-moving development teams',
    priceMonthly: 5000,
    currency: 'inr',
    limits: {
      maxRepositories: 5,
      maxScansPerMonth: null,
      maxDraftPrsPerMonth: 20,
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    description: 'For engineering organizations',
    priceMonthly: 15000,
    currency: 'inr',
    limits: {
      maxRepositories: null,
      maxScansPerMonth: null,
      maxDraftPrsPerMonth: 100,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For security-sensitive scale with custom deployment options',
    priceMonthly: null,
    currency: 'usd',
    limits: {
      maxRepositories: null,
      maxScansPerMonth: 100000,
      maxDraftPrsPerMonth: 100000,
    },
  },
};

export function getPlanDefinition(planId: string): PlanDefinition {
  return PLANS[planId] || PLANS.free!;
}
