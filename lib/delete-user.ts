import { randomBytes } from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { removeVideoFiles } from "@/lib/video-storage"
import { ANON_NAME, anonymizedEmail } from "@/lib/lgpd"

/**
 * Anonimiza a conta (LGPD) sem apagar o histórico financeiro.
 * Pagamentos e comprovantes em disco permanecem. Conteúdo pessoal
 * (biblioteca, coleções, uploads) é removido.
 */
export async function deleteUserAccount(userId: number) {
  const uploads = await prisma.video.findMany({
    where: { userId, source: "upload" },
    select: { filePath: true, previewPath: true, playbackPath: true, thumbPath: true },
  })
  const password = await bcrypt.hash(randomBytes(32).toString("hex"), 10)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.collection.deleteMany({ where: { ownerId: userId } })
    await tx.collectionMember.deleteMany({ where: { userId } })
    await tx.videoShare.deleteMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    })
    await tx.video.deleteMany({ where: { userId } })
    await tx.passwordResetToken.deleteMany({ where: { userId } })
    await tx.emailVerificationToken.deleteMany({ where: { userId } })
    await tx.subscription.updateMany({
      where: { userId, status: { not: "cancelled" } },
      data: { status: "cancelled", cancelledAt: now },
    })
    await tx.planChangeRequest.updateMany({
      where: { userId, status: "pending" },
      data: { status: "cancelled" },
    })
    await tx.user.update({
      where: { id: userId },
      data: {
        name: ANON_NAME,
        email: anonymizedEmail(userId),
        phone: null,
        password,
        status: "blocked",
        plan: "free",
        emailVerifiedAt: null,
        deletadoEm: now,
      },
    })
  })

  for (const row of uploads) await removeVideoFiles(row)
}
