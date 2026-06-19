export {};

declare global {
  type AppRouteContext<TParams extends Record<string, string> = Record<string, string>> = {
    params: Promise<TParams>;
  };

  type IdRouteContext = AppRouteContext<{ id: string }>;
}
