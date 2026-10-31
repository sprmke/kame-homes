import { z } from 'zod';

import { validateName } from '@/utils/text/helpers';

export const SD_BANKS = ['GCash', 'GoTyme', 'Maribank'] as const;
export type SdBank = (typeof SD_BANKS)[number];

export const refundBodySchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('same_phone'),
  }),
  z.object({
    method: z.literal('other_bank'),
    bank: z.enum(SD_BANKS, { required_error: 'Choose a bank' }),
    accountName: z
      .string()
      .trim()
      .min(1, 'Account name is required')
      .refine(
        (val) => validateName(val),
        'Please enter the complete name on the account (first and last name)'
      ),
    accountNumber: z
      .string()
      .trim()
      .min(1, 'Account number is required')
      .transform((val) => val.replace(/\s+/g, ''))
      .refine((val) => /^\d+$/.test(val), 'Account number must contain digits only')
      .refine((val) => val.length >= 5, 'Account number must be at least 5 digits')
      .refine((val) => val.length <= 20, 'Account number is too long'),
  }),
  z.object({
    method: z.literal('cash'),
  }),
]);

export type RefundBodyValues = z.infer<typeof refundBodySchema>;

export const sdFormSubmitSchema = z.object({
  refund: refundBodySchema,
});
