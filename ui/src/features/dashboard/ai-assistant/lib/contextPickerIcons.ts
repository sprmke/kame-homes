import type { ComponentType } from 'react';

import {
  Bell,
  Building2,
  CalendarDays,
  FileText,
  Gift,
  LayoutTemplate,
  LifeBuoy,
  MessageSquare,
  Palette,
  Star,
  ParkingSquare,
  Ticket,
  Users,
  Wrench,
} from 'lucide-react';

import type { AttachedContextType } from '@/features/dashboard/ai-assistant/lib/attachedContext';

export const ATTACHED_CONTEXT_ICONS: Record<
  AttachedContextType,
  ComponentType<{ className?: string }>
> = {
  booking: CalendarDays,
  property: Building2,
  parking_booking: ParkingSquare,
  team_member: Users,
  finance_item: Ticket,
  maintenance_item: Wrench,
  pricing_date: CalendarDays,
  inbox_conversation: MessageSquare,
  marketing_template: LayoutTemplate,
  marketing_theme: Palette,
  review: Star,
  voucher: Gift,
  notification_module: Bell,
  public_page: FileText,
  ticket: LifeBuoy,
  property_template: LayoutTemplate,
};
