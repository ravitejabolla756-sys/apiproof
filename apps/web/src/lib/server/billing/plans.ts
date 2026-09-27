export interface PlanDefinition {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  currency: string;
  limits: {
    maxRepositories: number;
    maxScansPerMonth: number;
    maxDraftPrsPerMonth: number;
  };
}

export const PLANS: Record<string, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'For small projects and evaluating APIProof AST analysis',
    priceMonthly: 0,
    currency: 'usd',
    limits: {
      maxRepositories: 3,
      maxScansPerMonth: 10,
      maxDraftPrsPerMonth: 5,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For engineering teams automating breaking API migrations',
    priceMonthly: 49,
    currency: 'usd',
    limits: {
      maxRepositories: 25,
      maxScansPerMonth: 200,
      maxDraftPrsPerMonth: 100,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited repositories and priority AST scan workers',
    priceMonthly: 299,
    currency: 'usd',
    limits: {
      maxRepositories: 10000,
      maxScansPerMonth: 100000,
      maxDraftPrsPerMonth: 100000,
    },
  },
};

export function getPlanDefinition(planId: string): PlanDefinition {
  return PLANS[planId] || PLANS.free!;
}
