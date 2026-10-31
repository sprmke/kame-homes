import { ShowcaseShell } from '@/features/guest/marketing/showcase/components/ShowcaseShell';
import { VersoSections } from '@/features/guest/marketing/showcase/templates/verso/VersoSections';
import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

/** THESIS: A fashion lookbook, not a landing page — the property photographed
 *  like a collection: chromeless full-bleed frames, hairline captions, and
 *  thin uppercase display type that gets out of the image's way.
 *  OWN-WORLD: monochrome ground + one accent, letter-spaced labels, plate numbers,
 *  a filmstrip gallery, near-zero UI chrome.
 *  FIRST VIEWPORT: full-bleed hero image + oversized thin name + two square CTAs. */
export function VersoTemplate({ data }: { data: ShowcaseData }) {
  return (
    <ShowcaseShell data={data} variant="verso">
      <VersoSections data={data} />
    </ShowcaseShell>
  );
}
