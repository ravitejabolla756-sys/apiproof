import type { DatabaseAdapter } from './db/types.js';
import { getDatabase } from './db/index.js';

export const DIGEST_CATEGORY = 'weekly_digest';

export interface ApprovedDigestSchedule {
  cadence: 'weekly';
  dayOfWeekUtc: number;
  hourUtc: number;
  minuteUtc: number;
  channel: 'email' | 'slack';
}

export interface DigestDispatchCandidate {
  userId: string;
  eventKey: string;
  category: typeof DIGEST_CATEGORY;
  channel: ApprovedDigestSchedule['channel'];
}

export class DigestSchedulingUnavailableError extends Error {
  readonly code = 'DIGEST_SCHEDULING_UNAVAILABLE';

  constructor(message = 'Digest scheduling is unavailable until an approved schedule and preference schema are configured.') {
    super(message);
    this.name = 'DigestSchedulingUnavailableError';
  }
}

function integerInRange(value: string | undefined, min: number, max: number): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

/** No cadence or recipient policy is assumed when the owner has not configured one. */
export function readApprovedDigestSchedule(environment: NodeJS.ProcessEnv = process.env): ApprovedDigestSchedule | null {
  if (environment.MY_OWL_DIGEST_CADENCE !== 'weekly') return null;
  const dayOfWeekUtc = integerInRange(environment.MY_OWL_DIGEST_DAY_UTC, 0, 6);
  const hourUtc = integerInRange(environment.MY_OWL_DIGEST_HOUR_UTC, 0, 23);
  const minuteUtc = integerInRange(environment.MY_OWL_DIGEST_MINUTE_UTC, 0, 59);
  const channel = environment.MY_OWL_DIGEST_CHANNEL;
  if (dayOfWeekUtc === null || hourUtc === null || minuteUtc === null || (channel !== 'email' && channel !== 'slack')) return null;
  return { cadence: 'weekly', dayOfWeekUtc, hourUtc, minuteUtc, channel };
}

export function isDigestWindow(now: Date, schedule: ApprovedDigestSchedule): boolean {
  return now.getUTCDay() === schedule.dayOfWeekUtc
    && now.getUTCHours() === schedule.hourUtc
    && now.getUTCMinutes() === schedule.minuteUtc;
}

function weekKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function requirePreferenceSchema(database: DatabaseAdapter): Promise<void> {
  try {
    await database.query('SELECT 1 FROM user_notification_preferences LIMIT 1');
  } catch {
    throw new DigestSchedulingUnavailableError('Digest scheduling is unavailable until migration 025 is installed.');
  }
}

/**
 * Plans recipients only. A later approved delivery worker must atomically claim
 * these event keys through the email/Slack ledger before sending anything.
 */
export async function planDueDigestDispatch(
  now: Date,
  schedule: ApprovedDigestSchedule,
  database: DatabaseAdapter = getDatabase(),
): Promise<DigestDispatchCandidate[]> {
  if (!isDigestWindow(now, schedule)) return [];
  await requirePreferenceSchema(database);
  const rows = await database.query<{ user_id: string }>(
    `SELECT user_id FROM user_notification_preferences
     WHERE category = ? AND channel = ? AND enabled = 1
     ORDER BY user_id`,
    [DIGEST_CATEGORY, schedule.channel],
  );
  const period = weekKey(now);
  return rows.map((row) => ({
    userId: row.user_id,
    eventKey: `digest:${period}:${row.user_id}:${schedule.channel}`,
    category: DIGEST_CATEGORY,
    channel: schedule.channel,
  }));
}
