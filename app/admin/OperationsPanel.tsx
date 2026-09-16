"use client"
import { useQuery } from "@tanstack/react-query"
import type { JobStatus } from "@/lib/job-status"

type Operations = { ffmpeg: boolean; processing: number; failed: number; stale: number; freeBytes: number | null; jobs: { billing: JobStatus | null; videos: JobStatus | null } }
function jobLabel(job: JobStatus | null) {
  if (!job) return "Ainda sem registro"
  return `${job.ok ? "Concluído" : "Falhou"} · ${new Date(job.finishedAt).toLocaleString("pt-BR")}`
}
export function OperationsPanel() {
  const query = useQuery<Operations>({ queryKey: ["admin", "operations"], queryFn: async () => {
    const res = await fetch("/api/admin/operations")
    if (!res.ok) throw new Error("Falha ao consultar operação")
    return res.json()
  }, staleTime: 60_000 })
  const data = query.data
  return <section className="operations-panel" aria-label="Saúde da operação">
    <div className="page-head"><div><h2 className="page-title">Saúde da operação</h2><p className="page-sub">Processamento de vídeos, armazenamento e rotinas agendadas.</p></div><button className="btn btn-ghost" onClick={() => query.refetch()} disabled={query.isFetching}>Atualizar diagnóstico</button></div>
    {query.isLoading && <p role="status">Verificando...</p>}
    {query.isError && <p role="alert" className="field-error">Não foi possível consultar. Tente atualizar.</p>}
    {data && <>
      {(!data.ffmpeg || data.stale > 0 || data.failed > 0) && <p className="alert banner-warn">Há itens que precisam de atenção no processamento. Consulte a gestão de vídeos.</p>}
      <dl className="operations-grid">
        <div><dt>Processador de vídeos</dt><dd>{data.ffmpeg ? "Disponível" : "Indisponível"}</dd></div>
        <div><dt>Em processamento</dt><dd>{data.processing}</dd></div>
        <div><dt>Há mais de 3 horas</dt><dd>{data.stale}</dd></div>
        <div><dt>Falhas de processamento</dt><dd>{data.failed}</dd></div>
        <div><dt>Espaço livre no servidor</dt><dd>{data.freeBytes === null ? "Indisponível" : `${(data.freeBytes / 1024 ** 3).toFixed(1)} GB`}</dd></div>
        <div><dt>Última rotina de cobrança</dt><dd>{jobLabel(data.jobs.billing)}</dd></div>
        <div><dt>Último reenfileiramento de vídeos</dt><dd>{jobLabel(data.jobs.videos)}</dd></div>
      </dl>
    </>}
  </section>
}
