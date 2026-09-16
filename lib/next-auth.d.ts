import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role?: string
      plan?: string
      status?: string
      emailVerified?: boolean
    }
  }

  interface User {
    role?: string
    plan?: string
    status?: string
    emailVerified?: boolean
    staySignedIn?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    plan?: string
    status?: string
    emailVerified?: boolean
    staySignedIn?: boolean
    sessionEndsAt?: number
  }
}
