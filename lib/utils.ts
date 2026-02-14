export type ClassValue =
  | string
  | number
  | null
  | undefined
  | boolean
  | ClassValue[]
  | { [key: string]: boolean | null | undefined }

function toClassString(input: ClassValue): string {
  if (!input) return ""
  if (typeof input === "string" || typeof input === "number") return String(input)
  if (Array.isArray(input)) return input.map(toClassString).filter(Boolean).join(" ")
  if (typeof input === "object") {
    return Object.entries(input)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key)
      .join(" ")
  }
  return ""
}

export function cn(...inputs: ClassValue[]) {
  return inputs.map(toClassString).filter(Boolean).join(" ")
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(amount)
}
