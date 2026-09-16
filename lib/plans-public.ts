/** Public presentation settings. Prices are shared with the server. */
export const PIX_KEY = (process.env.NEXT_PUBLIC_PIX_KEY ?? "contato@geflix.app").trim()
export const SUPPORT_EMAIL = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "suporte@geflix.app").trim()

export { PLAN_PRICES as PLAN_PRICE } from "@/lib/plan-config"
