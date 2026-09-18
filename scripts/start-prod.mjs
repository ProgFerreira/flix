import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { missingRequiredProdEnv } from "./required-prod-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
process.env.NODE_ENV = process.env.NODE_ENV || "production"

function loadEnv(file) {
  const full = path.join(root, file)
  if (!existsSync(full)) {
    console.warn(`[env] ${file} não encontrado`)
    return
  }
  for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
  console.info(`[env] carregou ${file}`)
}

loadEnv(".env.production")
loadEnv(".env")

const missingEnv = missingRequiredProdEnv(process.env)
if (missingEnv.length) {
  console.error(`[env] variáveis obrigatórias ausentes: ${missingEnv.join(", ")}`)
  console.error("[env] No hPanel: Node.js → Environment variables. Sem NEXTAUTH_SECRET o NextAuth responde Configuration error.")
  process.exit(1)
}

function runFile(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env: process.env,
      shell: false,
      stdio: "inherit",
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`))
    })
  })
}

const port = process.env.PORT || "3003"

try {
  const { createRequire } = await import("node:module")
  const require = createRequire(import.meta.url)
  const prismaCli = path.join(path.dirname(require.resolve("prisma/package.json")), "build", "index.js")
  await runFile(process.execPath, [prismaCli, "migrate", "deploy"])
} catch (err) {
  console.error("[db] migrate deploy falhou; o app sobe mesmo assim", err)
}

const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next")
await runFile(process.execPath, [nextCli, "start", "-H", "0.0.0.0", "-p", String(port)])

