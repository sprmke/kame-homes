import { ShowcaseShell } from '@/features/guest/marketing/showcase/components/ShowcaseShell';
import { EditorialSections } from '@/features/guest/marketing/showcase/templates/editorial/EditorialSections';
import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

/** THESIS: Warm magazine chapter — asymmetric collage and chapter fades, not a product grid.
 * OWN-WORLD: Cormorant display, cream paper, espresso ink, Embla voices, map pin pulse.
 * STORY: Guest reads the stay and books.
 * FIRST VIEWPORT: Collage + serif title + dual CTAs.
 * FORM: Editorial (templates brief C). FINISH: reviewed against brief + build. */
export function EditorialTemplate({ data }: { data: ShowcaseData }) {
  return (
    <ShowcaseShell data={data} variant="editorial">
      <EditorialSections data={data} />
    </ShowcaseShell>
  );
}
