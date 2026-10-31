import { ShowcaseShell } from '@/features/guest/marketing/showcase/components/ShowcaseShell';
import { AtlasSections } from '@/features/guest/marketing/showcase/templates/atlas/AtlasSections';
import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

/** THESIS: A field dossier for a place — the stay documented like a survey:
 *  numbered sections, monospaced field labels, a running coordinates ribbon,
 *  corner ticks, and a map that carries real weight.
 *  OWN-WORLD: Space Grotesk display, mono captions, cool slate + paper,
 *  hard-edged plates, spec tables instead of pretty cards.
 *  FIRST VIEWPORT: hero image + report title + a spec row + coordinates strip. */
export function AtlasTemplate({ data }: { data: ShowcaseData }) {
  return (
    <ShowcaseShell data={data} variant="atlas">
      <AtlasSections data={data} />
    </ShowcaseShell>
  );
}
