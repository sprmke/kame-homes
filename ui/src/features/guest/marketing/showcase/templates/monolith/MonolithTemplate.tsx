import { ShowcaseShell } from '@/features/guest/marketing/showcase/components/ShowcaseShell';
import { MonolithSections } from '@/features/guest/marketing/showcase/templates/monolith/MonolithSections';
import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

/** THESIS: Brutalist-lux monument — oversized type and grid, not soft hospitality cards.
 * OWN-WORLD: Instrument Serif, ink canvas, grain, marquee, cursor spotlight.
 * STORY: Guest feels presence and books.
 * FIRST VIEWPORT: Monument title over image + spotlight + amenity marquee.
 * FORM: Monolith (templates brief B). FINISH: reviewed against brief + build. */
export function MonolithTemplate({ data }: { data: ShowcaseData }) {
  return (
    <ShowcaseShell data={data} variant="monolith">
      <MonolithSections data={data} />
    </ShowcaseShell>
  );
}
