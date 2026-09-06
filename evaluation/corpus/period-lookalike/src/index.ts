export interface Membership { current_period_end: number }
export function renewal(membership: Membership) {
  return membership.current_period_end;
}
