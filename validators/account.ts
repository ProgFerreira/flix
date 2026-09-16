import { z } from "zod"
import { passwordSchema } from "./password"

export const accountPatchSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(80).optional(),
  currentPassword: z.string().optional(),
  newPassword: passwordSchema.optional(),
}).refine((d) => d.name !== undefined || d.newPassword !== undefined, {
  message: "Nada para atualizar",
}).refine((d) => !d.newPassword || !!d.currentPassword, {
  message: "Informe a senha atual para trocar a senha",
})
