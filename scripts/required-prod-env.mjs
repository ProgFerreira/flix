export const REQUIRED_PROD_ENV = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"]

export function missingRequiredProdEnv(env = process.env) {
  return REQUIRED_PROD_ENV.filter((key) => !String(env[key] ?? "").trim())
}
