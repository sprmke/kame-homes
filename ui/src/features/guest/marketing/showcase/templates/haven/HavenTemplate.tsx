import { ShowcaseShell } from '@/features/guest/marketing/showcase/components/ShowcaseShell';
import { HavenSections } from '@/features/guest/marketing/showcase/templates/haven/HavenSections';
import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

/** THESIS: The warm, welcoming version — a stay that feels like a friend's
 *  place. Soft sand paper, rounded "postcard" cards, a gentle serif, and a
 *  little postage-stamp badge. Nothing sharp, nothing loud.
 *  OWN-WORLD: Fraunces display + Figtree body, pastel gradient blooms,
 *  pill controls, generous rounding, soft shadows.
 *  FIRST VIEWPORT: gradient hero + friendly headline + stamp + rounded photo. */
export function HavenTemplate({ data }: { data: ShowcaseData }) {
  return (
    <ShowcaseShell data={data} variant="haven">
      <HavenSections data={data} />
    </ShowcaseShell>
  );
}
