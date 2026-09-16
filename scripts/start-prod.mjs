import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
process.env.NODE_ENV = process.env.NODE_ENV || "production"

function loadEnv(file) {
  const full = path.join(root, file)
  if (!existsSync(full)) return
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
}

loadEnv(".env.production")
loadEnv(".env")

function run(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: root,
      env: process.env,
      shell: true,
      stdio: "inherit",
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${code}`))
    })
  })
}

const port = process.env.PORT || "3003"

try {
  await run("npx prisma migrate deploy")
} catch (err) {
  console.error("[db] migrate deploy falhou; o app sobe mesmo assim", err)
}
await run(`npx next start -H 0.0.0.0 -p ${port}`)
