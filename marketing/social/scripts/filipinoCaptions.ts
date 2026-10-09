/**
 * Ready-to-paste Taglish captions for the Filipino set. Same rules as captions.ts:
 * plain, product-true, no hype, no em dashes. Written like a PH page talks to its
 * followers (relatable first line, a nudge to comment or tag a co-host).
 * Feature captions are built from the Filipino copy the creative uses.
 */
import { featureSpecs } from '../src/features/registry';
import { featureCopy } from '../src/filipino/copy';

const TAGS = '#KameHomes #AirbnbHostPH #CondoHostPH #KameNaBahala';
const LINK = 'Libre lang magsimula sa kamehomes.space';

export const filipinoCampaignCaptions: Record<string, string> = {
  '01-kame-na-bahala':
    'Hatinggabi na pero sunod-sunod pa rin ang "Hi po!" 😅 Resibo, Wi-Fi password, GAF at refund. Sa Kame Homes, may sagot at may status na ang bawat isa, kahit tulog ka. Kame na bahala.\n\nI-tag ang co-host mong laging gising nang 2 AM.',
  '02-noon-ngayon':
    'Noon: resibo sa GC, Excel na luma na, gising nang 2 AM. Ngayon: verified na ang resibo, iisang calendar, at AI ang sumasagot sa guests.\n\nIkaw, noon pa rin o ngayon na? Comment mo sa baba.',
  '03-tulog-ka':
    'Matulog ka nang mahimbing. Habang tulog ka, chine-check ng Kame Homes ang resibo, fina-file ang building approval at pinapadala ang guide sa guests mo.',
  '04-manifesto':
    'Nag-host ka para sa guests, hindi para sa resibo, screenshot at spreadsheets. Sa iba, Kame na bahala.',
  '04-kinetic':
    'Nag-host ka para sa guests, hindi sa resibo. Sa admin? Kame na bahala. Ikaw, sa guests lang.',
  '05-tanong':
    'Aminin na natin 😂 Saan talaga napupunta ang mga resibo ng guests mo? Comment ka ng A, B, C o D.',
  '06-offer':
    'Libre lang magsimula. I-set up ang unang property mo ngayon, gamit lang ang phone mo.',
};

export const filipinoFeatureCaptions: Record<
  string,
  { ad: string; hook: string; carousel: string; reel: string }
> = Object.fromEntries(
  featureSpecs.map((s) => {
    const k = featureCopy[s.slug];
    const question = k.hookWide.join(' ');
    const headline = k.wide.join(' ');
    const steps = k.steps.map(([title, text], i) => `${i + 1}. ${title}: ${text}`).join('\n');
    return [
      s.slug,
      {
        ad: `${headline} ${k.sub}`,
        hook: `${question} ${k.answer}`,
        carousel: `Paano gumagana ang ${s.module} sa Kame Homes:\n${steps}\n\nI-save mo 'to para sa susunod mong booking.`,
        reel: `${question} ${k.answer} ${k.sub}`,
      },
    ];
  })
);

export const withFilipinoFooter = (text: string) => `${text}\n\n${LINK}\n${TAGS}`;
