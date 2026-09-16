"use client"
import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { PIX_KEY, SUPPORT_EMAIL } from "@/lib/plans-public"
export function PixBox() {
  const [message, setMessage] = useState("")
  const copy = async () => {
    try { await navigator.clipboard.writeText(PIX_KEY); setMessage("Chave PIX copiada.") }
    catch { setMessage("Selecione a chave abaixo e copie manualmente.") }
  }
  return <div className="pix-box vitrine-pix">
    <p>Chave PIX</p>
    <div className="pix-key-row"><code>{PIX_KEY}</code><button type="button" className="btn btn-primary" onClick={copy}>
      {message === "Chave PIX copiada." ? <Check size={16} /> : <Copy size={16} />} Copiar chave
    </button></div>
    <span role="status" className="page-sub">{message}</span>
    <p className="muted">Após pagar, envie o comprovante abaixo. A confirmação pode levar até 24 horas. <a className="link" href={"mailto:" + SUPPORT_EMAIL}>Falar com o suporte</a></p>
  </div>
}
