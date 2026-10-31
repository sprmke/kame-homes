import {
  Car,
  ClipboardList,
  FileCheck,
  FileText,
  Home,
  LogIn,
  LogOut,
  Mail,
  PawPrint,
  Send,
} from 'lucide-react';

import type { PropertyTemplateCategory } from '@/features/dashboard/bookings/hooks/usePropertyTemplates';

import type { LucideIcon } from 'lucide-react';

export type PropertyTemplateSectionMeta = {
  templateKey: string;
  label: string;
  icon: LucideIcon;
  category: PropertyTemplateCategory;
};

export const STANDARD_TEMPLATE_SECTIONS: PropertyTemplateSectionMeta[] = [
  { templateKey: 'house-rules', label: 'House Rules', icon: Home, category: 'standard' },
  {
    templateKey: 'check-in-instructions',
    label: 'Check-in Instructions',
    icon: LogIn,
    category: 'standard',
  },
  {
    templateKey: 'check-out-instructions',
    label: 'Check-out Instructions',
    icon: LogOut,
    category: 'standard',
  },
  {
    templateKey: 'parking-reminders',
    label: 'Parking Reminders',
    icon: Car,
    category: 'standard',
  },
];

export const EMAIL_TEMPLATE_SECTIONS: PropertyTemplateSectionMeta[] = [
  {
    templateKey: 'email-gaf-request',
    label: 'GAF Request',
    icon: FileCheck,
    category: 'email',
  },
  {
    templateKey: 'email-pet-request',
    label: 'Pet Request',
    icon: PawPrint,
    category: 'email',
  },
  {
    templateKey: 'email-parking-request',
    label: 'Parking Request',
    icon: Car,
    category: 'email',
  },
  {
    templateKey: 'email-new-booking-request',
    label: 'New Booking Request',
    icon: Mail,
    category: 'email',
  },
  {
    templateKey: 'email-booking-acknowledgement',
    label: 'Booking Acknowledgement',
    icon: Send,
    category: 'email',
  },
  {
    templateKey: 'email-ready-for-checkin',
    label: 'Ready for Check-in',
    icon: LogIn,
    category: 'email',
  },
  {
    templateKey: 'email-sd-refund-form-request',
    label: 'SD Refund Form Request',
    icon: FileText,
    category: 'email',
  },
];

export function iconForTemplateKey(templateKey: string): LucideIcon {
  const builtIn = [...STANDARD_TEMPLATE_SECTIONS, ...EMAIL_TEMPLATE_SECTIONS].find(
    (s) => s.templateKey === templateKey
  );
  return builtIn?.icon ?? ClipboardList;
}
