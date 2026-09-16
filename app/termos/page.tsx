import Link from "next/link"

export default function TermosPage() {
  return (
    <div className="page">
      <main className="page-wrap page-wrap--sm" id="conteudo">
        <Link href="/login" className="link">Voltar ao login</Link>
        <h1 className="page-title" style={{ marginTop: 16 }}>Termos de uso</h1>
        <p className="page-sub">Versão 2026-09-15</p>
        <div className="card" style={{ padding: 20, marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <p>O GEFlix é um clube de criador: biblioteca pessoal de vídeos do YouTube e catálogo por assinatura, com cobrança via PIX registrada pela gestão.</p>
          <p>Ao criar conta você concorda em usar o serviço de boa-fé, não publicar conteúdo ilegal e manter o e-mail verdadeiro para recuperação da conta.</p>
          <p>Planos pagos só são ativados depois que a gestão confirma o pagamento. A exclusão da conta anonimiza seus dados pessoais e preserva o histórico financeiro exigido para a operação.</p>
        </div>
      </main>
    </div>
  )
}
