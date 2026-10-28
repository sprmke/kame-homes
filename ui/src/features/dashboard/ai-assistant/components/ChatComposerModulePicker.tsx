import { useMemo } from 'react';

import { useLocation, useParams } from 'react-router-dom';

import { ChatComposerBookingPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerBookingPicker';
import { ChatComposerFinancePicker } from '@/features/dashboard/ai-assistant/components/ChatComposerFinancePicker';
import { ChatComposerInboxPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerInboxPicker';
import { ChatComposerMaintenancePicker } from '@/features/dashboard/ai-assistant/components/ChatComposerMaintenancePicker';
import { ChatComposerMarketingPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerMarketingPicker';
import { ChatComposerNotificationPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerNotificationPicker';
import { ChatComposerParkingBookingPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerParkingBookingPicker';
import { ChatComposerPricingPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerPricingPicker';
import { ChatComposerPropertyPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerPropertyPicker';
import { ChatComposerPublicPagePicker } from '@/features/dashboard/ai-assistant/components/ChatComposerPublicPagePicker';
import { ChatComposerReviewPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerReviewPicker';
import { ChatComposerTeamPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerTeamPicker';
import { ChatComposerThemePicker } from '@/features/dashboard/ai-assistant/components/ChatComposerThemePicker';
import { ChatComposerTicketPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerTicketPicker';
import { useAssistantContextPicker } from '@/features/dashboard/ai-assistant/hooks/useAssistantContextPicker';
import {
  ASSISTANT_NOTIFICATION_MODULE_IDS,
  type ComposerPickerSharedProps,
  type ContextPickerKey,
} from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

type Props = ComposerPickerSharedProps & {
  pageBookingId?: string | null;
};

function ticketIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/tickets\/([^/]+)/);
  return match?.[1] ?? null;
}

function notificationModuleFromSearch(search: string): string | null {
  const module = new URLSearchParams(search).get('module');
  return module && module.length > 0 ? module : null;
}

function usePageEntityId(picker: ContextPickerKey, pageBookingId?: string | null): string | null {
  const { bookingId } = useParams<{ bookingId?: string }>();
  const propertyId = usePropertyIdParam();
  const { pathname, search } = useLocation();

  return useMemo(() => {
    switch (picker) {
      case 'booking':
      case 'parking_booking':
        return pageBookingId ?? bookingId ?? null;
      case 'property':
        return propertyId;
      case 'ticket':
        return ticketIdFromPath(pathname);
      case 'notification_module': {
        const moduleId = notificationModuleFromSearch(search);
        return moduleId && ASSISTANT_NOTIFICATION_MODULE_IDS.has(moduleId) ? moduleId : null;
      }
      default:
        return null;
    }
  }, [picker, pageBookingId, bookingId, propertyId, pathname, search]);
}

export function ChatComposerModulePicker({ pageBookingId, ...props }: Props) {
  const { picker } = useAssistantContextPicker();
  const pageEntityId = usePageEntityId(picker, pageBookingId);
  const shared = { ...props, pageEntityId };

  switch (picker) {
    case 'property':
      return <ChatComposerPropertyPicker {...shared} />;
    case 'team_member':
      return <ChatComposerTeamPicker {...shared} />;
    case 'finance_item':
      return <ChatComposerFinancePicker {...shared} />;
    case 'maintenance_item':
      return <ChatComposerMaintenancePicker {...shared} />;
    case 'parking_booking':
      return <ChatComposerParkingBookingPicker {...shared} />;
    case 'inbox_conversation':
      return <ChatComposerInboxPicker {...shared} />;
    case 'marketing_template':
      return (
        <>
          <ChatComposerMarketingPicker {...shared} />
          <ChatComposerThemePicker {...shared} />
        </>
      );
    case 'review':
      return <ChatComposerReviewPicker {...shared} />;
    case 'pricing_date':
      return <ChatComposerPricingPicker {...shared} />;
    case 'notification_module':
      return <ChatComposerNotificationPicker {...shared} />;
    case 'public_page':
      return <ChatComposerPublicPagePicker {...shared} />;
    case 'property_template':
      // Templates are picked from the shared context hub; no inline picker.
      return null;
    case 'ticket':
      return <ChatComposerTicketPicker {...shared} />;
    case 'booking':
    default:
      return <ChatComposerBookingPicker {...shared} pageBookingId={pageEntityId} />;
  }
}
