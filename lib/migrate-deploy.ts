import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

const g = globalThis as unknown as {
  __flixMigrate?: { ok: boolean; message: string }
}

export function lastMigrateResult(): { ok: boolean; message: string } | undefined {
  return g.__flixMigrate
}

function prismaBin(): string {
  const local = path.join(process.cwd(), "node_modules", ".bin", "prisma")
  return existsSync(local) ? local : "npx"
}

export function runMigrateDeploy(): Promise<{ ok: boolean; message: string }> {
  if (g.__flixMigrate) return Promise.resolve(g.__flixMigrate)
  const bin = prismaBin()
  const args = bin.endsWith("prisma") || bin.endsWith("prisma.cmd")
    ? ["migrate", "deploy"]
    : ["prisma", "migrate", "deploy"]
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let out = ""
    child.stdout?.on("data", (chunk) => { out += String(chunk) })
    child.stderr?.on("data", (chunk) => { out += String(chunk) })
    child.on("error", (err) => {
      const result = { ok: false, message: err.message }
      g.__flixMigrate = result
      resolve(result)
    })
    child.on("exit", (code) => {
      const message = out.trim().slice(-500)
      const result = { ok: code === 0, message: message || `exit ${code}` }
      g.__flixMigrate = result
      if (result.ok) console.info("[db] prisma migrate deploy ok")
      else console.error("[db] prisma migrate deploy falhou", result.message)
      resolve(result)
    })
  })
}
