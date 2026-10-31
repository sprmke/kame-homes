import { Gift, Star, Wallet } from 'lucide-react';

import type { GuestFormStepConfig } from '@/features/guest/form/lib/guestFormSteps';

export const SD_FORM_STEPS: GuestFormStepConfig[] = [
  {
    id: 1,
    title: 'Review',
    hint: 'Share your experience',
    icon: Star,
  },
  {
    id: 2,
    title: 'Surprise',
    hint: 'Spin for your next stay',
    icon: Gift,
  },
  {
    id: 3,
    title: 'Refund',
    hint: 'Receive your deposit',
    icon: Wallet,
  },
];
