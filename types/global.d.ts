// Global type declarations
interface Window {
  grecaptcha: {
    ready: (callback: () => void) => void;
    execute: (
      siteKey: string,
      options: { action: string }
    ) => Promise<string>;
    render: (
      container: string | HTMLElement,
      parameters: Record<string, any>
    ) => number;
    reset: (widgetId?: number) => void;
  };
}