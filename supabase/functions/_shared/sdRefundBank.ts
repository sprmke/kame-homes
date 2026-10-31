/** Allowed `guest_submissions.sd_refund_bank` when `sd_refund_method = other_bank`. */
const SD_REFUND_BANKS = ['GCash', 'GoTyme', 'Maribank'] as const;
export type SdRefundBank = (typeof SD_REFUND_BANKS)[number];

export function isSdRefundBank(value: unknown): value is SdRefundBank {
  return typeof value === 'string' && (SD_REFUND_BANKS as readonly string[]).includes(value);
}
