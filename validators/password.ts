import { z } from "zod"

export const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres")
