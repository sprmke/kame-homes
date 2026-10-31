import { ShowcaseShell } from '@/features/guest/marketing/showcase/components/ShowcaseShell';
import { AuroraSections } from '@/features/guest/marketing/showcase/templates/aurora/AuroraSections';
import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

/** THESIS: Cinematic depth — spring-smoothed layered parallax hero and stable CTAs, not a flat listing card.
 * OWN-WORLD: Outfit display, soft mesh light, teal primary, sticky progress rail.
 * STORY: Guest feels arrival and books.
 * FIRST VIEWPORT: Hero image + name + dual CTAs + scroll cue.
 * FORM: Aurora (templates brief A). FINISH: reviewed against brief + build. */
export function AuroraTemplate({ data }: { data: ShowcaseData }) {
  return (
    <ShowcaseShell data={data} variant="aurora">
      <AuroraSections data={data} />
    </ShowcaseShell>
  );
}
