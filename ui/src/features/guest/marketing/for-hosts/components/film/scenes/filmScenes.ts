import type { ComponentType } from 'react';

import type { HostTourNarrationId } from '@/features/guest/marketing/for-hosts/data/hostTourNarration';

import { IntroScene, OutroScene } from './SceneBookends';
import {
  BookingsBoardScene,
  BookingWorkflowScene,
  ChannelSyncScene,
  DataImportScene,
} from './SceneBookings';
import {
  AiReceptionistScene,
  GuestInboxScene,
  PublicPagesScene,
  TemplatesScene,
} from './SceneGuests';
import { GuestBookingScene, GuestJourneyScene } from './SceneGuestSite';
import { AiPhotoScene, AiVideoScene, MarketingStudioScene } from './SceneMarketing';
import { AnalyticsScene, FinanceScene, MaintenanceScene, PricingScene } from './SceneMoney';
import { CommandCenterScene, PortfolioScene, SetupGuideScene } from './SceneStart';
import { AiModeScene, NotificationsScene, PlansBillingScene, TeamScene } from './SceneTeam';

/** One scene per chapter id in `data/hostTourChapters.ts`. Keyed, so reordering chapters is safe. */
export const filmScenes: Record<HostTourNarrationId, ComponentType> = {
  intro: IntroScene,
  'setup-guide': SetupGuideScene,
  portfolio: PortfolioScene,
  'command-center': CommandCenterScene,
  'booking-workflow': BookingWorkflowScene,
  'bookings-board': BookingsBoardScene,
  'data-import': DataImportScene,
  'channel-sync': ChannelSyncScene,
  pricing: PricingScene,
  finance: FinanceScene,
  maintenance: MaintenanceScene,
  analytics: AnalyticsScene,
  'guest-inbox': GuestInboxScene,
  'ai-receptionist': AiReceptionistScene,
  'public-pages': PublicPagesScene,
  'guest-booking': GuestBookingScene,
  'guest-journey': GuestJourneyScene,
  templates: TemplatesScene,
  'marketing-studio': MarketingStudioScene,
  'ai-photo': AiPhotoScene,
  'ai-video': AiVideoScene,
  team: TeamScene,
  notifications: NotificationsScene,
  'ai-mode': AiModeScene,
  'plans-billing': PlansBillingScene,
  outro: OutroScene,
};
