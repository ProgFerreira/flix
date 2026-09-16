import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

const g = globalThis as unknown as {
  __flixMigrate?: { ok: boolean; message: string }
}

export function lastMigrateResult(): { ok: boolean; message: string } | undefined {
  return g.__flixMigrate
}

export function projectRootWithPrisma(cwd = process.cwd()): string {
  let dir = cwd
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, "prisma", "schema.prisma"))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return cwd
}

export function prismaMigrateArgs(): { cmd: string; args: string[] } {
  // Evita require.resolve("prisma/package.json"): esse arquivo roda dentro do
  // instrumentation.ts, que o Next empacota com webpack. Um require dinâmico
  // nesse contexto pode devolver um id de módulo do bundle (um número) em vez
  // do caminho real, e path.dirname() quebra com "path argument must be of
  // type string. Received type number". Monta o caminho na mão a partir da
  // raiz do projeto, sem passar pelo resolvedor de módulos.
  const root = projectRootWithPrisma()
  const cli = path.join(root, "node_modules", "prisma", "build", "index.js")
  if (!existsSync(cli)) {
    throw new Error(`Prisma CLI não encontrada em ${cli}`)
  }
  return { cmd: process.execPath, args: [cli, "migrate", "deploy"] }
}

export function runMigrateDeploy(): Promise<{ ok: boolean; message: string }> {
  if (g.__flixMigrate) return Promise.resolve(g.__flixMigrate)
  let invocation: { cmd: string; args: string[] }
  try {
    invocation = prismaMigrateArgs()
  } catch (err) {
    const result = { ok: false, message: err instanceof Error ? err.message : "prisma CLI ausente" }
    g.__flixMigrate = result
    return Promise.resolve(result)
  }
  const cwd = projectRootWithPrisma()
  return new Promise((resolve) => {
    const child = spawn(invocation.cmd, invocation.args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let out = ""
    child.stdout?.on("data", (chunk) => { out += String(chunk) })
    child.stderr?.on("data", (chunk) => { out += String(chunk) })
    child.on("error", (error) => {
      const result = { ok: false, message: error.message }
      g.__flixMigrate = result
      resolve(result)
    })
    child.on("exit", (code) => {
      // O topo da saída costuma trazer a mensagem de erro real do Prisma;
      // o final é mais stack trace. Corta do início, não do fim.
      const message = out.trim().slice(0, 4000)
      const result = { ok: code === 0, message: message || `exit ${code}` }
      g.__flixMigrate = result
      if (result.ok) console.info("[db] prisma migrate deploy ok")
      else console.error("[db] prisma migrate deploy falhou", result.message)
      resolve(result)
    })
  })
}
