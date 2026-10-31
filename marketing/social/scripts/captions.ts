/**
 * Ready-to-paste post captions. Plain, specific, no hype words, no em dashes.
 * Feature captions are built from the same copy the creative uses (registry + kitCopy).
 */
import { featureSpecs } from '../src/features/registry';
import { kitCopy } from '../src/features/kitCopy';

const TAGS = '#KameSpace #CondoHost #AirbnbHostPH';
const LINK = 'Start free at kamehomes.space';

export const campaignCaptions: Record<string, string> = {
  '01-lockscreen':
    'Receipts checked, building approvals filed and guests briefed while you sleep. Kame Space runs the admin side of your rental overnight.',
  '02-path':
    'Every booking follows the same six steps: booked, documents, check-in, check-out, deposit, completed. Kame Space moves each one forward so nothing slips.',
  '03-bento':
    'Bookings, receipts, channel sync, pricing, inbox and finance. One app for condo hosts.',
  '04-before-after':
    'Five tabs open, or one workspace. Kame Space keeps bookings, receipts, approvals and guest messages in one place.',
  '05-inbox':
    'Messenger, Instagram and web chat in one inbox, with a reply drafted from your house info. You check it and send.',
  '06-finance':
    'Every paid booking records itself. Add your expenses and see what you really made this month.',
  '07-offer': 'Start free and set up your first property today.',
  '08-carousel':
    'Follow one booking from start to finish. Swipe to see what Kame Space handles at each step.',
  '09-group-chat':
    'Cleaner, co-host and building admin all asking the same things in one group chat? Give them the booking instead. Receipt, GAF, parking and check-out time in one place.',
  '10-day':
    'A Saturday with Kame Space: receipt verified at 2 AM, stay guide sent, a guest question answered, the cleaner pinged and Airbnb synced. Sample day, real features.',
  '11-versus':
    'Same rentals, less admin. What changes when your bookings move out of group chats and spreadsheets.',
  '12-two-sides':
    'Your guest uploads the payment receipt. By the time you open the app, it is already matched to the booking.',
  '13-checklist':
    'Five things every guest needs before check-in. Save this for your next booking, and swipe to the end to see who sends all five for you.',
  '14-manifesto': 'You started hosting for the guests. Kame Space handles the rest.',
  '14-kinetic':
    'You started hosting for the guests, not for receipts and spreadsheets. Kame Space does the admin.',
  '15-question': "Be honest. Where do your guests' payment receipts end up? Comment A, B, C or D.",
  '16-journey': 'One booking from the first tap to income recorded. Six steps, all in Kame Space.',
  '17-meet-kame':
    "Say hi to Kame. Bookings, receipts, building approvals and guest questions are Kame's job now, so yours can be the guests.",
  '18-carry':
    'A turtle carries its home. Kame carries your admin: every booking takes the same six steps, and Kame moves each one forward.',
  '19-night-shift':
    'Receipt verified at 2 AM. Pet approval filed at 3. Check-in guide sent at 6:30. You slept through all of it.',
  '20-ask-kame':
    'Where do I park? What time is check-in? Guests ask Kame, and Kame answers from your house guide, day or night.',
  '21-crew':
    'One turtle, five jobs: greets guests, checks receipts, sends check-in info, pings your team and tracks your profit.',
  '22-meet-carousel':
    'Five jobs Kame takes off your plate. Swipe to meet the turtle doing your admin.',
  '23-kame-reel': 'Hosting is a lot of admin. Kame takes it, so you keep the guests.',
};

export const featureCaptions: Record<
  string,
  { ad: string; hook: string; carousel: string; reel: string }
> = Object.fromEntries(
  featureSpecs.map((s) => {
    const k = kitCopy[s.slug];
    const question = k.hookWide.join(' ');
    const steps = k.steps.map((st, i) => `${i + 1}. ${st.title}: ${st.text}`).join('\n');
    return [
      s.slug,
      {
        ad: `${s.module}. ${s.sub}`,
        hook: `${question} ${k.answer}`,
        carousel: `How ${s.module} works in Kame Space:\n${steps}`,
        reel: `${question} ${k.answer} ${s.sub}`,
      },
    ];
  })
);

export const withFooter = (text: string) => `${text}\n\n${LINK}\n${TAGS}`;
