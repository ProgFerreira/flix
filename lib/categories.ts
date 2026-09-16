import { prisma } from "@/lib/prisma"

/** Devolve só os IDs de categoria que realmente pertencem ao usuário. */
export async function ownedCategoryIds(userId: number, ids: number[] | undefined): Promise<number[]> {
  if (!ids?.length) return []
  const rows = await prisma.category.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}
