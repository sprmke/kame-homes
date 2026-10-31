import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react';

import { Link } from 'react-router-dom';

import { isExternalHref } from '@/features/guest/trip/lib/guestTripLinks';
import { scrollToTripSection } from '@/features/guest/trip/lib/guestTripScroll';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };

/**
 * Router `Link` for app paths, plain `<a>` for http / tel / mailto, and smooth in-page
 * scrolling for `#section` anchors. Works under `asChild`.
 */
export const GuestTripSmartLink = forwardRef<HTMLAnchorElement, Props>(function GuestTripSmartLink(
  { to, children, onClick, ...rest },
  ref
) {
  if (to.startsWith('#')) {
    return (
      <a
        ref={ref}
        href={to}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          scrollToTripSection(to);
        }}
        {...rest}
      >
        {children}
      </a>
    );
  }
  if (isExternalHref(to)) {
    const newTab = /^https?:/i.test(to);
    return (
      <a
        ref={ref}
        href={to}
        onClick={onClick}
        {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <Link ref={ref} to={to} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
});
