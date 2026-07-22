// Global type declaration for Google reCAPTCHA v3
// Centralised here to avoid duplicate-declaration TS errors across pages.

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (
        container: string | HTMLElement,
        parameters: Record<string, unknown>,
      ) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

export {};
