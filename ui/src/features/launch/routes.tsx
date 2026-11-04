import { Route } from 'react-router-dom';

import { LAUNCH_PATH } from '@/features/launch/lib/launchRouting';
import { AppLaunchPage } from '@/features/launch/pages/AppLaunchPage';


/**
 * `/app` sits outside the marketing shell and the admin layout: it must resolve
 * for a signed-out guest, a signed-in host and a super admin alike, with no chrome
 * flashing before the redirect.
 */
export const launchRoutes = [<Route key="launch" path={LAUNCH_PATH} element={<AppLaunchPage />} />];
