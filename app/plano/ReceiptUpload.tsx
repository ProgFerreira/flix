"use client"
import { useState } from "react"

export function ReceiptUpload({ requestId, hasReceipt, onSaved }: { requestId: number; hasReceipt: boolean; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setMessage("O comprovante deve ter até 8 MB."); return }
    setBusy(true); setMessage("")
    try {
      const body = new FormData(); body.set("file", file)
      const response = await fetch("/api/plano/comprovante", { method: "POST", body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Não foi possível enviar.")
      setMessage("Comprovante recebido. Aguarde a análise do pagamento."); onSaved()
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha de conexão. Tente novamente.") }
    finally { setBusy(false) }
  }
  return <form onSubmit={upload} className="receipt-upload">
    <h3 className="list-row-title">{hasReceipt ? "Comprovante recebido" : "Envie seu comprovante"}</h3>
    {hasReceipt && <a className="link" href={`/api/plano/comprovante?id=${requestId}`}>Baixar comprovante enviado</a>}
    <label className="field-label" htmlFor="receipt-file">{hasReceipt ? "Substituir arquivo (opcional)" : "Comprovante de pagamento"}</label>
    <input id="receipt-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} aria-describedby="receipt-help" />
    <p id="receipt-help" className="page-sub">JPEG, PNG, WebP ou PDF, até 8 MB. O envio não ativa o plano automaticamente.</p>
    <button type="submit" className="btn btn-primary" disabled={!file || busy}>{busy ? "Enviando..." : hasReceipt ? "Substituir comprovante" : "Enviar comprovante"}</button>
    {message && <p role={/não|falha|deve ter/i.test(message) ? "alert" : "status"} className={/não|falha|deve ter/i.test(message) ? "field-error" : undefined}>{message}</p>}
  </form>
}
