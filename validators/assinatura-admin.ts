import { z } from "zod"

export const adminAssinaturaPatchSchema = z.object({
  action: z.enum(["renew", "cancel", "reactivate"]),
  note: z.string().max(500).optional(),
  method: z.enum(["pix", "card", "boleto", "manual"]).optional(),
})
