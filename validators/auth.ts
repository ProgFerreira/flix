import { z } from "zod"
import { passwordSchema } from "./password"

export const signupSchema = z.object({
  email: z.string().email("Email inválido"),
  password: passwordSchema,
  name: z.string().min(1, "Nome obrigatório").optional(),
  acceptedTerms: z.boolean().refine((v) => v === true, {
    message: "Aceite os termos de uso e a política de privacidade",
  }),
})

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Informe a senha"),
  remember: z.boolean().optional(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

export const resetPasswordFormSchema = z.object({
  password: passwordSchema,
  confirm: z.string().min(1, "Confirme a senha"),
}).refine((d) => d.password === d.confirm, {
  message: "As senhas não coincidem",
  path: ["confirm"],
})

