import { seedOfficialProviderReviewQueue } from '../src/lib/server/provider-review-queue-seed.js';

const result = await seedOfficialProviderReviewQueue();
console.log(JSON.stringify({
  ...result,
  safety: 'evidence-only; all imported candidates remain needs_review',
}, null, 2));
