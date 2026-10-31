import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { documentAiValidationPatchForAssetType } from './receiptValidationService.ts';

Deno.test("guest 2-5 valid IDs write their own verdict columns, not the primary guest's", () => {
  assertEquals(
    documentAiValidationPatchForAssetType('guest3_valid_id', {
      verdict: 'invalid',
      summary: 'Blurry',
    }),
    { guest3_valid_id_ai_verdict: 'invalid', guest3_valid_id_ai_summary: 'Blurry' }
  );
  assertEquals(
    documentAiValidationPatchForAssetType('valid_id', { verdict: 'valid', summary: 'OK' }),
    { valid_id_ai_verdict: 'valid', valid_id_ai_summary: 'OK' }
  );
});

Deno.test('null result clears the verdict so a replaced receipt never inherits it', () => {
  assertEquals(documentAiValidationPatchForAssetType('guest_balance_payment_receipt', null), {
    balance_receipt_ai_verdict: null,
    balance_receipt_ai_summary: null,
  });
  assertEquals(documentAiValidationPatchForAssetType('payment_receipt', null), {
    dp_receipt_ai_verdict: null,
    dp_receipt_ai_summary: null,
  });
});

Deno.test('assets without AI checks get no patch', () => {
  assertEquals(documentAiValidationPatchForAssetType('pet_image', null), null);
});
