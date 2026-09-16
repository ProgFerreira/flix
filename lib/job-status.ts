import { mkdir, writeFile, rename, readFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

export type JobStatus = { finishedAt: string; ok: boolean }
const directory = path.join(process.cwd(), "storage", "job-status")
export async function recordJobStatus(job: "billing" | "videos", ok: boolean) {
  try {
    await mkdir(directory, { recursive: true })
    const temp = path.join(directory, `${job}-${randomUUID()}.tmp`)
    await writeFile(temp, JSON.stringify({ finishedAt: new Date().toISOString(), ok }))
    await rename(temp, path.join(directory, `${job}.json`))
  } catch { console.error("[jobs] Não foi possível registrar o estado de", job) }
}
export async function readJobStatus(job: "billing" | "videos"): Promise<JobStatus | null> {
  try { return JSON.parse(await readFile(path.join(directory, `${job}.json`), "utf8")) }
  catch { return null }
}
