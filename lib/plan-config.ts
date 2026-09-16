/** Shared product definitions: UI and billing must use the same values. */
export const PLAN_PRICES: Record<string, Record<string, number>> = {
  premium: { monthly: 10, annual: 96 },
  pro: { monthly: 17.9, annual: 171.84 },
}
export const PLAN_LIMITS: Record<string, number> = { free: 20, premium: 100, pro: Infinity }
export const PLAN_FEATURES = {
  free: ["Até 20 vídeos na biblioteca", "Categorias e favoritos", "Compartilhamento", "Catálogo gratuito"],
  premium: ["Até 100 vídeos na biblioteca", "Todos os recursos do Free", "Coleções colaborativas e link público", "Catálogo Free e Premium"],
  pro: ["Vídeos ilimitados na biblioteca", "Todos os recursos do Premium", "Exportação e prioridade no suporte", "Acesso a todos os níveis do catálogo"],
}
