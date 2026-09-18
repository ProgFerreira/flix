import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  collectionDeleteMany,
  collectionMemberDeleteMany,
  videoShareDeleteMany,
  courseFavoriteDeleteMany,
  courseReviewDeleteMany,
  videoDeleteMany,
  passwordResetDeleteMany,
  emailTokenDeleteMany,
  subscriptionUpdateMany,
  planChangeUpdateMany,
  userUpdate,
  videoFindMany,
} = vi.hoisted(() => ({
  collectionDeleteMany: vi.fn(),
  collectionMemberDeleteMany: vi.fn(),
  videoShareDeleteMany: vi.fn(),
  courseFavoriteDeleteMany: vi.fn(),
  courseReviewDeleteMany: vi.fn(),
  videoDeleteMany: vi.fn(),
  passwordResetDeleteMany: vi.fn(),
  emailTokenDeleteMany: vi.fn(),
  subscriptionUpdateMany: vi.fn(),
  planChangeUpdateMany: vi.fn(),
  userUpdate: vi.fn(),
  videoFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    video: { findMany: videoFindMany },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        collection: { deleteMany: collectionDeleteMany },
        collectionMember: { deleteMany: collectionMemberDeleteMany },
        videoShare: { deleteMany: videoShareDeleteMany },
        courseFavorite: { deleteMany: courseFavoriteDeleteMany },
        courseReview: { deleteMany: courseReviewDeleteMany },
        video: { deleteMany: videoDeleteMany },
        passwordResetToken: { deleteMany: passwordResetDeleteMany },
        emailVerificationToken: { deleteMany: emailTokenDeleteMany },
        subscription: { updateMany: subscriptionUpdateMany },
        planChangeRequest: { updateMany: planChangeUpdateMany },
        user: { update: userUpdate },
      })
    }),
  },
}))
vi.mock("@/lib/video-storage", () => ({
  removeVideoFiles: vi.fn(async () => undefined),
}))
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(async () => "anon-hash") },
  hash: vi.fn(async () => "anon-hash"),
}))

import { deleteUserAccount } from "@/lib/delete-user"
import { ANON_NAME, anonymizedEmail } from "@/lib/lgpd"

describe("deleteUserAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    videoFindMany.mockResolvedValue([])
    collectionDeleteMany.mockResolvedValue({ count: 1 })
    collectionMemberDeleteMany.mockResolvedValue({ count: 1 })
    videoShareDeleteMany.mockResolvedValue({ count: 2 })
    courseFavoriteDeleteMany.mockResolvedValue({ count: 1 })
    courseReviewDeleteMany.mockResolvedValue({ count: 1 })
    videoDeleteMany.mockResolvedValue({ count: 3 })
    passwordResetDeleteMany.mockResolvedValue({ count: 0 })
    emailTokenDeleteMany.mockResolvedValue({ count: 0 })
    subscriptionUpdateMany.mockResolvedValue({ count: 1 })
    planChangeUpdateMany.mockResolvedValue({ count: 0 })
    userUpdate.mockResolvedValue({ id: 7 })
  })

  it("anonymizes the user and keeps the row instead of deleting it", async () => {
    await deleteUserAccount(7)

    expect(collectionDeleteMany).toHaveBeenCalledWith({ where: { ownerId: 7 } })
    expect(courseFavoriteDeleteMany).toHaveBeenCalledWith({ where: { userId: 7 } })
    expect(courseReviewDeleteMany).toHaveBeenCalledWith({ where: { userId: 7 } })
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        name: ANON_NAME,
        email: anonymizedEmail(7),
        phone: null,
        status: "blocked",
        plan: "free",
        deletadoEm: expect.any(Date),
      }),
    })
    expect(userUpdate.mock.calls[0]?.[0]).not.toHaveProperty("delete")
  })

  it("cancels the subscription instead of removing payment history", async () => {
    await deleteUserAccount(7)
    expect(subscriptionUpdateMany).toHaveBeenCalledWith({
      where: { userId: 7, status: { not: "cancelled" } },
      data: expect.objectContaining({ status: "cancelled" }),
    })
  })
})
