import Link from "next/link"
import { FolderOpen, Clapperboard } from "lucide-react"
import { PLAN_PRICE } from "@/lib/plans-public"
import { formatMoney } from "@/lib/money"
import { loginHref } from "@/lib/auth-redirect"

const PLANS = [
  { id: "free", name: "Free", price: "Grátis", blurb: "20 vídeos na biblioteca e catálogo gratuito" },
  { id: "premium", name: "Premium", price: `R$ ${formatMoney(PLAN_PRICE.premium.monthly)}/mês`, blurb: "Coleções colaborativas e até 100 vídeos" },
  { id: "pro", name: "Pro", price: `R$ ${formatMoney(PLAN_PRICE.pro.monthly)}/mês`, blurb: "Ilimitado, exportar biblioteca e prioridade" },
]

export function CreatorShowcase({ loggedIn = false }: { loggedIn?: boolean }) {
  return (
    <section className="vitrine" aria-label="O que o GEFlix faz">
      <div className="page-lead">
        <h1 className="page-title">Assine e assista às aulas do criador.</h1>
        <p className="page-sub">
          O catálogo é do criador: aulas gratuitas sem conta, Premium e Pro via PIX.
          Na biblioteca, você também organiza seus próprios vídeos do YouTube.
        </p>
      </div>

      <div className="vitrine-grid">
        <div className="vitrine-card">
          <p className="kicker kicker-inline"><FolderOpen size={14} /> Biblioteca</p>
          <h2>Organize o que você escolheu</h2>
          <p className="muted">Categorias, notas, coleções com link público e exportação. Você cura — não o algoritmo.</p>
        </div>
        <div className="vitrine-card">
          <p className="kicker kicker-inline"><Clapperboard size={14} /> Catálogo</p>
          <h2>O clube é do criador</h2>
          <p className="muted">Só o criador publica. Você assina e assiste conforme o plano. Free sem conta; Premium e Pro desbloqueiam o resto.</p>
        </div>
      </div>

      <p className="kicker">Planos · pagamento via PIX</p>
      <div className="vitrine-plans">
        {PLANS.map((p) => (
          <div key={p.id} className="vitrine-plan" data-plan={p.id}>
            <p className="list-row-title">{p.name}</p>
            <p className="plan-price">{p.price}</p>
            <p className="muted-2">{p.blurb}</p>
          </div>
        ))}
      </div>

      

      <div className="vitrine-cta">
        {loggedIn ? (
          <Link href="/plano" className="btn btn-accent">Ver meu plano e pagar via PIX</Link>
        ) : (
          <>
            <Link href={loginHref("/catalogo", true)} className="btn btn-accent">Criar conta gratuita</Link>
            <Link href="#catalogo-lista" className="btn btn-ghost">Ver o catálogo grátis</Link>
          </>
        )}
      </div>
    </section>
  )
}
