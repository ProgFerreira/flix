import { Prisma } from "@prisma/client"

type PaymentLike = {
  amount: Prisma.Decimal | number | string
  receiptPath?: string | null
  receiptMimeType?: string | null
  receiptSize?: number | null
}

export function serializePayment<T extends PaymentLike>(p: T) {
  const { receiptPath, receiptMimeType, receiptSize, ...rest } = p
  void receiptMimeType
  void receiptSize
  return {
    ...rest,
    amount: p.amount.toString(),
    hasReceipt: Boolean(receiptPath),
  }
}
