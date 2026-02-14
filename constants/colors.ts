// Brand colors - use CSS variables for theme compatibility
export const BRAND_COLORS = {
  primary: "#15803D", // green-700
  secondary: "#3b82f6", // blue-500
  accent: "#10b981", // emerald-500
  neutral: "#64748b", // slate-500
  background: "#f8fafc", // slate-50
  white: "#ffffff",
} as const;

export type BrandColorKey = keyof typeof BRAND_COLORS;
