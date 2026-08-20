import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({ where: { email: credentials.email } })
        if (!user) return null
        if (user.status === "blocked") return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null
        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          plan: user.plan,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.role = (user as { role?: string }).role
        token.plan = (user as { plan?: string }).plan
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.name = token.name as string
        ;(session.user as { role?: string }).role = token.role as string
        ;(session.user as { plan?: string }).plan = token.plan as string
      }
      return session
    },
  },
  // maxAge curto porque o middleware (edge) só consegue checar o JWT, não o
  // banco — isso limita a janela em que uma conta bloqueada/rebaixada ainda
  // abre as telas de admin antes do redirect. As rotas de API já revalidam
  // contra o banco a cada chamada via requireUserId/requireAdmin.
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
}
