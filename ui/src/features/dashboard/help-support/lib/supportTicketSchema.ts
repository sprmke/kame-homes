import { z } from 'zod';

export const SUPPORT_TICKET_CATEGORIES = [
  'bug_report',
  'feature_suggestion',
  'general_inquiry',
  'business_inquiry',
] as const;
export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];

export const SUPPORT_TICKET_SEVERITIES = ['low', 'medium', 'high'] as const;
export type SupportTicketSeverity = (typeof SUPPORT_TICKET_SEVERITIES)[number];

export type SupportTicketAttachmentDraft = {
  name: string;
  mimeType: string;
  size: number;
  path: string;
};

const attachmentsSchema = z
  .array(
    z.object({
      name: z.string(),
      mimeType: z.string(),
      size: z.number(),
      path: z.string(),
    })
  )
  .max(3, 'Attach up to 3 files')
  .default([]);

export const supportTicketDraftSchema = z
  .object({
    category: z.enum(SUPPORT_TICKET_CATEGORIES),
    subject: z
      .string()
      .trim()
      .min(1, 'Subject is required')
      .max(200, 'Subject must be 200 characters or fewer'),
    description: z
      .string()
      .trim()
      .min(1, 'Details are required')
      .max(5000, 'Details must be 5000 characters or fewer'),
    severity: z.enum(SUPPORT_TICKET_SEVERITIES),
    contactPreference: z.string().trim().max(200, 'Must be 200 characters or fewer'),
  })
  .superRefine((data, ctx) => {
    if (data.category === 'business_inquiry' && !data.contactPreference.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tell us how to reach you',
        path: ['contactPreference'],
      });
    }
  });

export type SupportTicketDraftValues = z.infer<typeof supportTicketDraftSchema>;

export const supportTicketFormSchema = z.discriminatedUnion('category', [
  z.object({
    category: z.literal('bug_report'),
    subject: z.string().trim().min(1, 'Subject is required').max(200),
    description: z.string().trim().min(1, 'Details are required').max(5000),
    pageUrl: z.string().trim().max(500).optional(),
    browserInfo: z.string().trim().max(500).optional(),
    severity: z.enum(SUPPORT_TICKET_SEVERITIES),
    attachments: attachmentsSchema,
  }),
  z.object({
    category: z.literal('feature_suggestion'),
    subject: z.string().trim().min(1, 'Subject is required').max(200),
    description: z.string().trim().min(1, 'Details are required').max(5000),
  }),
  z.object({
    category: z.literal('general_inquiry'),
    subject: z.string().trim().min(1, 'Subject is required').max(200),
    description: z.string().trim().min(1, 'Details are required').max(5000),
  }),
  z.object({
    category: z.literal('business_inquiry'),
    subject: z.string().trim().min(1, 'Subject is required').max(200),
    description: z.string().trim().min(1, 'Details are required').max(5000),
    contactPreference: z
      .string()
      .trim()
      .min(1, 'Tell us how to reach you')
      .max(200, 'Must be 200 characters or fewer'),
  }),
]);

export type SupportTicketFormValues = z.infer<typeof supportTicketFormSchema>;

export function isSupportTicketDraftComplete(values: {
  subject: string;
  description: string;
  category?: SupportTicketCategory;
  contactPreference?: string;
}): boolean {
  if (!values.subject.trim() || !values.description.trim()) return false;
  if (values.category === 'business_inquiry' && !values.contactPreference?.trim()) return false;
  return true;
}

export const SUPPORT_TICKET_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  bug_report: 'Broken',
  feature_suggestion: 'Idea',
  general_inquiry: 'Question',
  business_inquiry: 'Business',
};

export const SUPPORT_TICKET_CATEGORY_DESCRIPTIONS: Record<SupportTicketCategory, string> = {
  bug_report: "A page or feature isn't working",
  feature_suggestion: "A feature you'd like added",
  general_inquiry: 'How a page or feature works',
  business_inquiry: 'Billing, plans, or partnerships',
};

export const SUPPORT_TICKET_SEVERITY_LABELS: Record<
  (typeof SUPPORT_TICKET_SEVERITIES)[number],
  string
> = {
  low: 'Not urgent',
  medium: 'Soon',
  high: 'Blocking me',
};
