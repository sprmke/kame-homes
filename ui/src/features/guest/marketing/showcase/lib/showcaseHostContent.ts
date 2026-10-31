import type {
  ShowcaseData,
  ShowcaseResolvedSection,
} from '@/features/guest/marketing/showcase/types/showcase';

const HOST_PREVIEW_SNIPPET = 'Your host profile and contact details appear here';

export function hasShowcaseHostContent(data: ShowcaseData): boolean {
  const { host, guestContact } = data;
  if (guestContact.contactPhone.trim() || guestContact.contactEmail.trim()) return true;
  if (host.ownerAvatarUrl || host.organizationLogoUrl) return true;
  const name = (guestContact.contactName.trim() || host.ownerName).trim();
  if (name && name !== 'Host') return true;
  const org = host.organizationName.trim();
  return Boolean(org && org !== 'Host');
}

export function resolveShowcaseHostContent(data: ShowcaseData, section: ShowcaseResolvedSection) {
  const { host, guestContact } = data;
  const avatar = host.ownerAvatarUrl || host.organizationLogoUrl;
  const displayName = guestContact.contactName || host.ownerName;
  const phone = guestContact.contactPhone.trim();
  const email = guestContact.contactEmail.trim();
  const rawBody = section.body?.trim() ?? '';
  const rawSub = section.subheading?.trim() ?? '';
  const isPreviewCopy = rawBody.includes(HOST_PREVIEW_SNIPPET) || rawBody.startsWith('Lorem ipsum');
  const blurb = isPreviewCopy ? '' : rawBody || rawSub;
  const showPreviewBanner = section.usesPreviewMock && !hasShowcaseHostContent(data);
  const badge = host.verifiedBadge ? 'Verified host' : host.isSuperhost ? 'Superhost' : null;

  return {
    avatar,
    displayName,
    phone,
    email,
    blurb,
    showPreviewBanner,
    badge,
    host,
    guestContact,
    hostPublicPath: data.hostPublicPath,
    contactPath: data.contactPath,
  };
}
