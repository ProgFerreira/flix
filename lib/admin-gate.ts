export type AdminGateUser = { role: string; status: string } | null

/**
 * Destino de quem bate em `/admin` depois de olhar a linha viva no banco.
 * `null` = deixa passar. Usuário inexistente ou bloqueado vai pro login;
 * quem não é admin volta pra home.
 */
export function adminGateDestination(user: AdminGateUser): "/login" | "/" | null {
  if (!user || user.status === "blocked") return "/login"
  if (user.role !== "admin") return "/"
  return null
}
