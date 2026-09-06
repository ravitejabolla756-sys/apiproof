# Phase 2.5 registry review ledger

Reviewed on 2026-09-06 by Codex (agent). All nine canonical records remain **reviewed**: 9 reviewed, 0 verified, 0 draft. No human approval is claimed. Source pages were opened individually during development; no scraper or runtime documentation fetch was introduced. Quotes are not stored.

| Record suffix | Inspected support | Scope/assumption checked |
| --- | --- | --- |
| subscriptions-del-removed | [v13 guide](https://github.com/stripe/stripe-node/wiki/Migration-guide-for-v13) | del removed; cancel replacement; cohort starts where cancel is available |
| subscriptions-del-deprecated | [v13 guide](https://github.com/stripe/stripe-node/wiki/Migration-guide-for-v13) | Guide calls del deprecated; selected lower bound is not asserted to date deprecation |
| checkout-shipping-rates-renamed | [v13 guide](https://github.com/stripe/stripe-node/wiki/Migration-guide-for-v13) | Checkout create parameter scope, shipping_options replacement |
| account-link-type-changed | [v13 guide](https://github.com/stripe/stripe-node/wiki/Migration-guide-for-v13) | Exactly two removed enum values; no name-only parameter match |
| invoice-upcoming-removed | [invoice advisory](https://docs.stripe.com/changelog/basil/2025-03-31/invoice-preview-api-deprecations), [tagged v18 changelog](https://raw.githubusercontent.com/stripe/stripe-node/v18.0.0/CHANGELOG.md) | Two SDK helper names checked separately from REST names; explicit preview context needed |
| subscription-coupon-removed | [discount advisory](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-singular-coupon-promotion-code), [tagged v18 changelog](https://raw.githubusercontent.com/stripe/stripe-node/v18.0.0/CHANGELOG.md) | Only subscription create/update, correct argument positions; broader advisory intentionally not fully modeled |
| subscription-period-fields | [period advisory](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end), [tagged v18 changelog](https://raw.githubusercontent.com/stripe/stripe-node/v18.0.0/CHANGELOG.md) | Subscription-level fields removed; item fields retained; listed origins only |
| context-type-renamed | [v22 guide](https://github.com/stripe/stripe-node/wiki/Migration-guide-for-v22) | Type changes to StripeContextType; constructor remains StripeContext |
| legacy-usage-methods | [usage advisory](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-legacy-usage-based-billing), [tagged v18 changelog](https://raw.githubusercontent.com/stripe/stripe-node/v18.0.0/CHANGELOG.md) | Two helper removals; separately acknowledge documented RawRequest transition with pre-Basil version |

The [v18 migration guide](https://github.com/stripe/stripe-node/wiki/Migration-guide-for-v18) also confirms the Basil SDK/API association. Version ranges are selected source upgrade cohorts, not exhaustive historical claims. SDK and API versions remain separate. Runtime account, request and webhook versions are not established by registry review.

All records now have explicit assumptions apart from evidence summaries, symbols, selectors, migration instructions and review status. None opts in to capability-check matching. Drafts remain rejected on every official analysis/evaluation path; verified status still requires human attribution. Review metadata remains operator-controlled JSON, not a signed approval system.

Before production use, a Stripe/API expert should independently validate these scopes and corpus labels. This ledger records the development review performed, including its limits; it does not certify migration outcomes.
