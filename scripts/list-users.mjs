import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, plan: true, status: true } })
users.forEach(u => console.log(`id:${u.id} | ${u.email} | role:${u.role} | plan:${u.plan} | status:${u.status}`))
await prisma.$disconnect()
