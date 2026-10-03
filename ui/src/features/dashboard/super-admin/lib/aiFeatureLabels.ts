const AI_FEATURE_LABELS: Record<string, string> = {
  receipt_validation: 'Receipt validation',
  inbox_suggest: 'Inbox suggest',
  inbox_auto_reply: 'Inbox auto-reply',
  marketing_caption: 'Marketing caption',
  marketing_template: 'Marketing template',
  marketing_image_generate: 'Marketing image',
  marketing_video_generate: 'Marketing video',
  marketing_image_prompt_enhance: 'Image auto-improve',
  marketing_video_prompt_enhance: 'Video auto-improve',
  import_column_map: 'Import mapping',
  voice_polish: 'Voice polish',
  voice_receptionist: 'Voice receptionist',
  dashboard_assistant: 'Dashboard assistant',
  ai_integration_verify: 'Integration verify',
  booking_ai_summary_guests: 'Booking review: guests',
  booking_ai_summary_pets: 'Booking review: pets',
  booking_ai_summary_pricing: 'Booking review: pricing',
  smart_pricing: 'Smart pricing',
  host_analytics: 'Host analytics',
};

export const AI_FEATURE_LABEL_KEYS = Object.keys(AI_FEATURE_LABELS);

export function labelAiFeature(feature: string): string {
  return AI_FEATURE_LABELS[feature] ?? feature.replace(/_/g, ' ');
}
