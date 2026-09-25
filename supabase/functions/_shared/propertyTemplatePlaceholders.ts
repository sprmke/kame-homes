/**
 * Property template {{placeholders}} — reference lines + sample preview values.
 * Keep in sync with `ui/src/features/dashboard/bookings/lib/propertyTemplatePlaceholders.ts`.
 */

export const PROPERTY_TEMPLATE_PLACEHOLDERS_REFERENCE: readonly string[] = [
  '{{primary_guest_name}} — primary guest name',
  '{{guest_phone}} — guest phone',
  '{{guest_email}} — guest email',
  '{{guest_facebook_name}} — Guest display name',
  '{{guest_name}} — guest display name',
  '{{check_in_date}} — check-in date',
  '{{check_out_date}} — check-out date',
  '{{check_in_time}} — check-in time',
  '{{check_out_time}} — check-out time',
  '{{nights}} — number of nights',
  '{{pax}} — number of guests',
  '{{tower_and_unit_number}} — tower and unit',
  '{{unit_number}} — unit number',
  '{{property_name}} — property name',
  '{{booking_source}} — booking channel',
  '{{booking_link}} — admin booking URL',
  '{{decor_status}} — decor: "🎉 Yes" or "No"',
  '{{pet_status}} — pets: "🐶 Yes" or "No"',
  '{{has_decor}} — plain "Yes" or "No" for decor',
  '{{has_pets}} — plain "Yes" or "No" for pets',
  '{{decor_flag}} — "🎉 Has decor" or empty',
  '{{pet_flag}} — "🐶 Has pets" or empty',
  '{{special_requests}} — guest requests or "None"',
  '{{pet_name}} — pet name',
  '{{pet_type}} — pet type',
  '{{pet_breed}} — pet breed',
  '{{pet_age}} — pet age',
  '{{car_brand_model}} — vehicle make/model',
  '{{car_color}} — vehicle color',
  '{{car_plate_number}} — plate number',
  '{{total_guest_balance}} — guest balance due (₱ formatted)',
  '{{sd_form_url}} — guest SD refund form URL',
  '{{security_deposit}} — security deposit (₱ formatted)',
  '{{facebook_page_url}} — Facebook page URL (property → org)',
  '{{airbnb_url}} — Airbnb listing URL (property → org)',
  '{{contact_name}} — contact person name (property → org)',
  '{{contact_phone}} — contact phone (property → org)',
  '{{contact_email}} — contact email (property → org)',
  '{{social_contact_mentions}} — “message us on Facebook or Airbnb” (platform names linked)',
  '{{urgent_notice}} — same-day check-in urgent banner (empty when not same-day)',
  '{{update_notice}} — GAF/pet/parking resubmit notice (empty on first send)',
  '{{booking_vehicle_copy}} — parking broadcast copy block (parking email only)',
  '{{pet_details_section}} — pet details table (pet request email)',
  '{{pet_attachments_section}} — attachments included list (pet request email)',
  '{{parking_reply_callout_section}} — parking reply-with-rate callout',
  '{{email_signature_section}} — Best regards sign-off (unit owner from settings)',
  '{{booking_acknowledgement_flow_section}} — summary + What’s next steps',
  '{{ready_for_checkin_booking_summary_section}} — booking summary table',
  '{{ready_for_checkin_contact_section}} — contact us block (property/org social + contact)',
  '{{new_booking_detail_tables}} — stay/guest/notable detail tables (new booking email)',
  '{{downpayment_receipt_ai_section}} — AI receipt check table (empty when no AI data)',
  '{{booking_link_cta}} — admin “View Booking Details” button',
  '{{document_reminders_section}} — GAF/parking/pet reminder card (ready for check-in)',
  '{{payment_breakdown_section}} — payment table (empty when total balance is 0)',
  '{{gcash_payment_section}} — payment accounts (+ QR when uploaded; empty when total balance is 0)',
  '{{sd_refund_checklist_section}} — check-out checklist table (SD refund email)',
  '{{sd_refund_details_section}} — SD refund amount + form CTA (SD refund email)',
];

export const PROPERTY_TEMPLATE_SAMPLE_VARS: Record<string, string> = {
  primary_guest_name: 'Jane Guest',
  guest_phone: '09171234567',
  guest_email: 'jane.guest@example.com',
  guest_facebook_name: 'Jane Guest',
  guest_name: 'Jane Guest',
  check_in_date: 'July 10, 2026',
  check_out_date: 'July 12, 2026',
  check_in_time: '2:00 PM',
  check_out_time: '11:00 AM',
  nights: '2',
  pax: '2',
  tower_and_unit_number: 'Monaco 2604',
  unit_number: 'Monaco 2604',
  property_name: 'Sample Property',
  booking_source: 'Airbnb',
  booking_link: 'https://kamehomes.space/bookings/00000000-0000-4000-8000-000000000001',
  decor_status: 'No',
  pet_status: 'No',
  has_decor: 'No',
  has_pets: 'No',
  decor_flag: '',
  pet_flag: '',
  special_requests: 'None',
  pet_name: 'Buddy',
  pet_type: 'Dog',
  pet_breed: 'Shih Tzu',
  pet_age: '2',
  car_brand_model: 'Toyota Vios',
  car_color: 'White',
  car_plate_number: 'ABC 1234',
  total_guest_balance: '₱3,599',
  sd_form_url:
    'https://kamehomes.space/properties/azure-north/sd-form?bookingId=00000000-0000-4000-8000-000000000001',
  security_deposit: '₱3,000.00',
  facebook_page_url: 'https://www.facebook.com/example',
  airbnb_url: 'https://www.airbnb.com/rooms/example',
  contact_name: 'Jane Host',
  contact_phone: '09171234567',
  contact_email: 'host@example.com',
  social_contact_mentions:
    'message us on <a href="https://www.facebook.com/example">Facebook</a> or <a href="https://www.airbnb.com/rooms/example">Airbnb</a>',
};

export function applyPropertyTemplateSamplePlaceholders(html: string): string {
  let out = html;
  for (const [key, value] of Object.entries(PROPERTY_TEMPLATE_SAMPLE_VARS)) {
    out = out.split(`{{${key}}}`).join(value);
    const hyphenKey = key.replace(/_/g, '-');
    if (hyphenKey !== key) {
      out = out.split(`{{${hyphenKey}}}`).join(value);
    }
  }
  return out;
}
