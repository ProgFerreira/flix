import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const u = await prisma.user.findFirst({ orderBy: { id: "asc" } })
if (!u) { console.log("Nenhum usuário"); process.exit(0) }
const updated = await prisma.user.update({ where: { id: u.id }, data: { role: "admin" } })
console.log("Admin definido:", updated.email)
await prisma.$disconnect()
