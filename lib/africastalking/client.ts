import AfricasTalking from 'africastalking';

/**
 * Africa's Talking Integration Client
 * - Environment-aware (sandbox | production) — mirrors lib/dusupay/client.ts pattern
 * - Per-env credentials with fallbacks to generic vars for backward compatibility
 * - Lazy initialization (constructor validates credentials but doesn't throw early)
 * - Production migration = env vars only, no code changes
 */

export type AfricasTalkingEnvironment = 'sandbox' | 'production';

export class AfricasTalkingClient {
  private environment: AfricasTalkingEnvironment;
  private smsClient: ReturnType<typeof AfricasTalking>['SMS'] | null = null;

  constructor() {
    this.environment = (process.env.AT_ENVIRONMENT as AfricasTalkingEnvironment) === 'production'
      ? 'production'
      : 'sandbox';
  }

  getEnvironment(): AfricasTalkingEnvironment {
    return this.environment;
  }

  private getApiKey(): string {
    return this.environment === 'production'
      ? process.env.AT_PRODUCTION_API_KEY ??
        process.env.AT_API_KEY ??
        ''
      : process.env.AT_SANDBOX_API_KEY ??
        process.env.AT_API_KEY ??
        '';
  }

  private getUsername(): string {
    return this.environment === 'production'
      ? process.env.AT_PRODUCTION_USERNAME ??
        process.env.AT_USERNAME ??
        ''
      : process.env.AT_SANDBOX_USERNAME ??
        process.env.AT_USERNAME ??
        '';
  }

  private getSmsClient(): ReturnType<typeof AfricasTalking>['SMS'] {
    if (!this.smsClient) {
      const apiKey = this.getApiKey();
      const username = this.getUsername();

      if (!apiKey || !username) {
        throw new Error(
          `Africa's Talking credentials not configured for environment: ${this.environment}. ` +
          `Set AT_${this.environment.toUpperCase()}_API_KEY and AT_${this.environment.toUpperCase()}_USERNAME, ` +
          `or fall back to AT_API_KEY and AT_USERNAME.`,
        );
      }

      const at = AfricasTalking({ apiKey, username });
      this.smsClient = at.SMS;
    }
    return this.smsClient;
  }

  async send(options: { to: string; message: string; from?: string }): Promise<Record<string, unknown>> {
    return this.getSmsClient().send(options) as unknown as Promise<Record<string, unknown>>;
  }
}

// Single instance — all consumers use this
export const atsClient = new AfricasTalkingClient();
