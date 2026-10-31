import type { ComponentType } from 'react';

import type { PublicHostSocialLinks } from '@/features/guest/marketing/properties/hooks/usePublicHost';

import { cn } from '@/lib/utils';

type Props = {
  links: PublicHostSocialLinks;
  className?: string;
};

type SocialKey = keyof PublicHostSocialLinks;

const SOCIAL_CONFIG: Array<{
  key: SocialKey;
  label: string;
  shell: string;
  iconClass: string;
  Icon: ComponentType<{ className?: string }>;
}> = [
  {
    key: 'facebookUrl',
    label: 'Facebook',
    shell: 'bg-blue-500/10 ring-blue-500/15',
    iconClass: 'text-[#1877F2]',
    Icon: FacebookIcon,
  },
  {
    key: 'instagramUrl',
    label: 'Instagram',
    shell: 'bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 ring-pink-500/15',
    iconClass: 'text-pink-600 dark:text-pink-400',
    Icon: InstagramIcon,
  },
  {
    key: 'airbnbUrl',
    label: 'Airbnb',
    shell: 'bg-[#FF385C]/10 ring-[#FF385C]/20',
    iconClass: 'text-[#FF385C]',
    Icon: AirbnbIcon,
  },
  {
    key: 'tiktokUrl',
    label: 'TikTok',
    shell: 'bg-foreground/[0.06] ring-border/70',
    iconClass: 'text-foreground',
    Icon: TikTokIcon,
  },
];

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function AirbnbIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12.004 6.376c-.516 0-.969.236-1.269.609-.3-.373-.753-.609-1.269-.609-.941 0-1.704.763-1.704 1.704 0 .345.103.666.28.934.442.684 1.693 2.586 2.693 4.148 1-1.562 2.251-3.464 2.693-4.148.177-.268.28-.589.28-.934 0-.941-.763-1.704-1.704-1.704zm0-4.376c2.729 0 5.004 2.009 5.372 4.669.368 2.66-1.277 5.331-5.372 9.331-4.095-4-5.74-6.671-5.372-9.331.368-2.66 2.643-4.669 5.372-4.669z" />
    </svg>
  );
}

export function HostPublicSocialLinks({ links, className }: Props) {
  const items = SOCIAL_CONFIG.flatMap(({ key, label, shell, iconClass, Icon }) => {
    const href = links[key];
    if (!href) return [];

    return [
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={cn(
          'inline-flex size-11 items-center justify-center rounded-full ring-1 ring-inset transition-opacity hover:opacity-80',
          shell
        )}
      >
        <Icon className={cn('size-[18px]', iconClass, key === 'airbnbUrl' && 'size-5')} />
      </a>,
    ];
  });

  if (items.length === 0) return null;

  return <div className={cn('flex flex-wrap items-center gap-2.5', className)}>{items}</div>;
}
