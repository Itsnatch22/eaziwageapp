const DAY_MS = 24 * 60 * 60 * 1000;

const RESPONSE_COOLDOWN_DAYS = 120;
const HARD_DISMISS_COOLDOWN_DAYS = 30;
const PASSIVE_DISMISS_COOLDOWN_DAYS = 14;
const EXPONENTIAL_LOCK_THRESHOLD = 2;
const EXPONENTIAL_LOCK_DAYS = 90;

export interface SatisfactionPromptStateRow {
  prompt_count: number;
  last_prompted_at: string | null;
  last_response_at: string | null;
  last_dismissed_at: string | null;
  dismissal_count: number;
  last_dismiss_type: 'hard' | 'passive' | null;
}

export type EligibilityReason =
  | 'never_prompted'
  | 'response_cooldown'
  | 'hard_dismiss_cooldown'
  | 'passive_dismiss_cooldown'
  | 'exponential_lock';

export interface EligibilityResult {
  eligible: boolean;
  reason?: EligibilityReason;
  nextEligibleAt?: Date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Evaluates every applicable cooldown independently and takes whichever
 * resolves latest ("most restrictive wins"), rather than treating the
 * exponential lock as a replacement for the 30-day hard-dismiss cooldown.
 * Both are anchored to the same last_dismissed_at, so once dismissal_count
 * exceeds the threshold the 90-day lock naturally dominates the 30-day one
 * for that same event — no special-casing needed. A more recent
 * last_response_at is never overridden by a stale, shorter dismissal
 * cooldown, since each candidate is compared on its own resolved date.
 */
export function isEligibleForPrompt(
  state: SatisfactionPromptStateRow | null,
  now: Date = new Date(),
): EligibilityResult {
  if (!state) return { eligible: true, reason: 'never_prompted' };

  const candidates: { reason: EligibilityReason; until: Date }[] = [];

  if (state.last_response_at) {
    candidates.push({
      reason: 'response_cooldown',
      until: addDays(new Date(state.last_response_at), RESPONSE_COOLDOWN_DAYS),
    });
  }

  if (state.last_dismissed_at) {
    const dismissedAt = new Date(state.last_dismissed_at);

    // Legacy rows written before this migration have no dismiss type — treat
    // as the lighter cooldown rather than assuming the stricter one.
    candidates.push(
      state.last_dismiss_type === 'hard'
        ? { reason: 'hard_dismiss_cooldown', until: addDays(dismissedAt, HARD_DISMISS_COOLDOWN_DAYS) }
        : { reason: 'passive_dismiss_cooldown', until: addDays(dismissedAt, PASSIVE_DISMISS_COOLDOWN_DAYS) },
    );

    if (state.dismissal_count > EXPONENTIAL_LOCK_THRESHOLD) {
      candidates.push({ reason: 'exponential_lock', until: addDays(dismissedAt, EXPONENTIAL_LOCK_DAYS) });
    }
  }

  const blocking = candidates
    .filter((c) => c.until > now)
    .sort((a, b) => b.until.getTime() - a.until.getTime())[0];

  return blocking
    ? { eligible: false, reason: blocking.reason, nextEligibleAt: blocking.until }
    : { eligible: true };
}
