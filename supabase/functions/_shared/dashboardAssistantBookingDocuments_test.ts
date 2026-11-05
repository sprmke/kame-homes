import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { selectDocumentsForMessage } from './dashboardAssistantBookingDocuments.ts';

Deno.test('selectDocumentsForMessage treats a gaf-group file as the approved GAF', () => {
  const selected = selectDocumentsForMessage(
    [
      {
        id: 'doc-gaf-1',
        label: 'Approved GAF',
        group: 'gaf',
        kind: 'pdf',
        url: 'https://files.example.test/bookings/b1/approved-gaf.pdf',
      },
    ],
    "Show me Maria's approved GAF"
  );
  assertEquals(selected.missingLabels, []);
  assertEquals(selected.files[0]?.url, 'https://files.example.test/bookings/b1/approved-gaf.pdf');
});

Deno.test('selectDocumentsForMessage reports missing GAF when the booking has no files', () => {
  const selected = selectDocumentsForMessage([], 'Did Ana Reyes upload her GAF yet?');
  assertEquals(selected.files, []);
  assertEquals(selected.missingLabels, ['Approved GAF']);
});
