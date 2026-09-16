import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { logAdminAction } from "@/lib/audit"

// 5 tentativas por conta e por IP a cada 15 minutos. Duas chaves separadas:
// por e-mail impede que alguém tente força bruta numa conta específica
// trocando de IP; por IP impede varredura de várias contas de um só lugar.
const LOGIN_ATTEMPT_LIMIT = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

// Cookie de sessão explícito: httpOnly, SameSite=Lax e Secure em produção.
// Sem isso, os atributos ficam só nos padrões do NextAuth e podem mudar
// silenciosamente com o ambiente. O prefixo __Secure- é exigido pelos
// browsers quando Secure=true (ver cookie-prefixes).
const useSecureCookies = process.env.NODE_ENV === "production"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
        remember: { label: "Manter conectado", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        const ip = getClientIp(req?.headers)
        const byIp = await checkRateLimit(`login:ip:${ip}`, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS)
        const byEmail = await checkRateLimit(`login:email:${credentials.email}`, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS)
        if (!byIp.allowed || !byEmail.allowed) return null

        let user: Awaited<ReturnType<typeof prisma.user.findUnique>>
        try {
          user = await prisma.user.findUnique({ where: { email: credentials.email } })
        } catch {
          return null
        }
        if (!user || user.deletadoEm) {
          await logAdminAction({ action: "auth.login_fail", targetType: "auth", meta: { ip } })
          return null
        }
        if (user.status === "blocked") {
          await logAdminAction({ action: "auth.login_fail", targetType: "auth", meta: { ip } })
          return null
        }
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) {
          await logAdminAction({ action: "auth.login_fail", targetType: "auth", meta: { ip } })
          return null
        }
        await logAdminAction({
          adminId: user.id,
          action: "auth.login",
          targetType: "auth",
          targetId: user.id,
          meta: { ip },
        })
        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          plan: user.plan,
          status: user.status,
          emailVerified: !!user.emailVerifiedAt,
          staySignedIn: credentials.remember === "true",
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.role = (user as { role?: string }).role
        token.plan = (user as { plan?: string }).plan
        token.status = (user as { status?: string }).status
        token.emailVerified = (user as { emailVerified?: boolean }).emailVerified
        const stay = Boolean((user as { staySignedIn?: boolean }).staySignedIn)
        token.staySignedIn = stay
        token.sessionEndsAt = Math.floor(Date.now() / 1000) + (stay ? 30 * 24 * 60 * 60 : 24 * 60 * 60)
      } else if (typeof token.sessionEndsAt !== "number") {
        token.sessionEndsAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60
      }
      if (trigger === "update" && session) {
        const s = session as { name?: string; emailVerified?: boolean }
        if (typeof s.name === "string") token.name = s.name
        if (typeof s.emailVerified === "boolean") token.emailVerified = s.emailVerified
      }
      if (typeof token.sessionEndsAt === "number" && Math.floor(Date.now() / 1000) > token.sessionEndsAt) {
        token.status = "blocked"
        token.role = "user"
        token.emailVerified = false
        return token
      }
      if (token.id) {
        try {
          const db = await prisma.user.findUnique({
            where: { id: Number(token.id) },
            select: { status: true, role: true, plan: true, name: true, emailVerifiedAt: true, deletadoEm: true },
          })
          if (!db || db.deletadoEm) {
            token.status = "blocked"
            token.role = "user"
            token.emailVerified = false
            return token
          }
          token.status = db.status
          token.role = db.role
          token.plan = db.plan
          token.name = db.name ?? token.name
          token.emailVerified = !!db.emailVerifiedAt
        } catch {
          // Sem isso o GET /api/auth/session volta vazio e o client quebra no json().
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.name = token.name as string
        session.user.role = token.role
        session.user.plan = token.plan
        session.user.status = token.status
        session.user.emailVerified = token.emailVerified
      }
      return session
    },
  },
  // Cookie pode durar 30 dias ("manter conectado"). Sem o checkbox, o JWT
  // expira em 24h via sessionEndsAt — a API já revalida status/role no banco.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  cookies: {
    sessionToken: {
      name: `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
}
