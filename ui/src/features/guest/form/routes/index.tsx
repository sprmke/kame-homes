import { Route } from 'react-router-dom';

import { GuestForm } from '@/features/guest/form/components/GuestForm';
import { GuestFormSuccess } from '@/features/guest/form/components/GuestFormSuccess';

export const guestFormRoutes = [
  <Route key="guest-form" path="form" element={<GuestForm />} />,
  <Route key="guest-success" path="success" element={<GuestFormSuccess />} />,
];
