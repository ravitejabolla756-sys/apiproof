import { runVerificationWorker } from '../src/lib/server/migration-verification-worker.js';

const workerId = process.env.APIPROOF_VERIFICATION_WORKER_ID;
if (!workerId) throw new Error('APIPROOF_VERIFICATION_WORKER_ID is required.');

const controller = new AbortController();
process.once('SIGINT', () => controller.abort());
process.once('SIGTERM', () => controller.abort());

await runVerificationWorker({ workerId, workerToken: process.env.APIPROOF_VERIFICATION_WORKER_TOKEN, signal: controller.signal });
