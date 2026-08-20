import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()
const password = await bcrypt.hash("test1234", 10)

const admin = await prisma.user.upsert({
  where: { email: "test-admin@flix.local" },
  update: { password, role: "admin", plan: "pro", status: "active" },
  create: { email: "test-admin@flix.local", name: "Test Admin", password, role: "admin", plan: "pro" },
})

const freeUser = await prisma.user.upsert({
  where: { email: "test-free@flix.local" },
  update: { password, plan: "free", status: "active" },
  create: { email: "test-free@flix.local", name: "Test Free", password, plan: "free" },
})

const premiumUser = await prisma.user.upsert({
  where: { email: "test-premium@flix.local" },
  update: { password, plan: "premium", status: "active" },
  create: { email: "test-premium@flix.local", name: "Test Premium", password, plan: "premium" },
})

const nextBillingDate = new Date()
nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
await prisma.subscription.upsert({
  where: { userId: premiumUser.id },
  update: { plan: "premium", status: "active", nextBillingDate },
  create: { userId: premiumUser.id, plan: "premium", billing: "monthly", amount: 10, nextBillingDate, status: "active" },
})

console.log("admin:", admin.email, "| free:", freeUser.email, "| premium:", premiumUser.email, "| senha: test1234")
await prisma.$disconnect()
