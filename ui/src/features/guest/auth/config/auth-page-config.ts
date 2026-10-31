/**
 * Auth page configuration per audience (host vs guest).
 * Used by reusable auth page components so routes can share the same UI with different copy and links.
 */

export type AuthAudience = 'host' | 'guest';

export interface AuthPageConfig {
  audience: AuthAudience;
  login: {
    badge: string;
    title: string;
    subtitle: string;
    registerHref: string;
    successRedirect: string;
  };
  register: {
    title: string;
    subtitle: string;
    loginHref: string;
  };
}

const hostBase = '/for-hosts';
const guestBase = '/for-guests';

export const AUTH_PAGE_CONFIG: Record<AuthAudience, AuthPageConfig> = {
  host: {
    audience: 'host',
    login: {
      badge: 'Host / Property Manager',
      title: 'Welcome back',
      subtitle: 'Sign in to manage your properties and bookings',
      registerHref: `${hostBase}/register`,
      successRedirect: '/dashboard',
    },
    register: {
      title: 'Create an account',
      subtitle: 'Start managing your properties in minutes',
      loginHref: `${hostBase}/login`,
    },
  },
  guest: {
    audience: 'guest',
    login: {
      badge: 'Guest / Explore',
      title: 'Welcome back',
      subtitle: 'Sign in to browse and book your next stay',
      registerHref: `${guestBase}/register`,
      successRedirect: '/',
    },
    register: {
      title: 'Create an account',
      subtitle: 'Sign up to browse and book your next stay',
      loginHref: `${guestBase}/login`,
    },
  },
};
