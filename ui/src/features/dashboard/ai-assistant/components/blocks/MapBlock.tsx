import { ChatMapLinkCard } from '@/components/chat/ChatMapLinkCard';

type Props = {
  href: string;
  lat: number | null;
  lng: number | null;
  label: string;
};

export function MapBlock({ href, lat, lng, label }: Props) {
  const safeHref = href.trim();
  if (!safeHref) return null;
  return <ChatMapLinkCard href={safeHref} lat={lat} lng={lng} label={label || 'Location'} />;
}
