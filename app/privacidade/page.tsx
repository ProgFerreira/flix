import Link from "next/link"

export default function PrivacidadePage() {
  return (
    <div className="page">
      <main className="page-wrap page-wrap--sm" id="conteudo">
        <Link href="/login" className="link">Voltar ao login</Link>
        <h1 className="page-title" style={{ marginTop: 16 }}>Política de privacidade</h1>
        <p className="page-sub">Versão 2026-09-15</p>
        <div className="card" style={{ padding: 20, marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <p>Tratamos e-mail, nome, telefone, histórico de reprodução e pagamentos para operar o clube e a cobrança PIX.</p>
          <p>Você pode exportar seus dados em Conta e solicitar a exclusão (anonimização). Pagamentos são retidos pelo tempo necessário à gestão financeira.</p>
          <p>Não vendemos seus dados. Compartilhamos apenas o necessário para enviar e-mail transacional (Resend) e o que você mesmo publica no catálogo.</p>
        </div>
      </main>
    </div>
  )
}
