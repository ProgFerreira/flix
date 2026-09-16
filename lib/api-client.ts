export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export function apiErrorMessage(err: unknown, fallback = "Não foi possível concluir a operação") {
  return err instanceof ApiError ? err.message : fallback
}

/**
 * Fetch JSON same-origin com tratamento de 401 (volta ao login) e mensagem
 * de erro da API. Usar no client no lugar de fetch cru.
 */
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data: unknown = await res.json().catch(() => null)
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login"
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "Não foi possível concluir a operação"
    throw new ApiError(message, res.status)
  }
  return data as T
}
