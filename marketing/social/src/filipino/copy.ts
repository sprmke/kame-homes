import type { ManifestoCopy } from '../angles/kinetic';
import type { QuestionCopy } from '../angles/question';
import type { StudioCopy } from '../copy';

/**
 * Filipino (Taglish) copy. Written the way Filipino brands talk on social, not translated:
 * - Tagalog grammar and particles (na, pa, lang, mo, 'di ba), with the English nouns hosts
 *   actually say (booking, resibo, check-in, Wi-Fi, GCash). No deep or formal Tagalog
 *   ("pamahalaan", "makabagong") that reads like a government notice or a machine.
 * - Hooks come from real host life: "Hi po" at midnight, "Ate, ano po ang Wi-Fi password?",
 *   the suki who still pays platform fees, the matumal week, the long weekend rate.
 * - Brand line: "Kame na bahala." Said out loud it is "kami na bahala" (we'll handle it).
 * - Guests speak with "po". The host is addressed as "mo/ka", like a friend.
 * Same rules as the English set: product-true, no hype, no em dashes.
 * Layout limits: tall lines ≤ 13 characters, wide lines ≤ 19.
 */

export const filipinoCopy: StudioCopy = {
  cta: 'Subukan nang libre',
  swipe: 'I-swipe',
  howItWorks: 'Paano gumagana',
  stepOf: (n, total) => `Step ${n} of ${total}`,
  tryFree: ['Subukan mo', 'nang libre.'],
  offer: ['Libre lang', 'magsimula.'],
  offerSub: 'Walang card na kailangan · Sa phone mo lang · Cancel anytime',
};

export const BRAND_LINE = 'Kame na bahala.';

/** Per-module Filipino copy. Step icons come from the English kit, in the same order. */
export interface FilipinoFeatureCopy {
  tall: string[];
  wide: string[];
  accentTall: number;
  accentWide: number;
  sub: string;
  hook: string[];
  hookWide: string[];
  answer: string;
  steps: [string, string][];
}

export const featureCopy: Record<string, FilipinoFeatureCopy> = {
  '01-bookings': {
    tall: ['Booking mo,', 'kusa nang', 'umaandar.'],
    wide: ['Booking mo,', 'kusa nang umaandar.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'Form, resibo, approval at guest emails. Tuloy-tuloy ang bawat stay, hindi mo na kailangang habulin.',
    hook: ['Mano-mano mo', 'pa rin ba', 'ang booking?'],
    hookWide: ['Mano-mano pa rin', 'ba ang booking?'],
    answer: 'Kame na bahala sa next step ng bawat stay.',
    steps: [
      ['Nag-book si guest', 'Pasok ang form, ID at bayad sa booking link mo.'],
      ['Chine-check ni Kame', 'Itinutugma ang resibo at building approval sa booking.'],
      ['Ready na si guest', 'Lalabas ang check-in email, at may notif ka agad.'],
    ],
  },
  '02-receipt-check': {
    tall: ['Resibo?', 'Na-check', 'na ni Kame.'],
    wide: ['Resibo?', 'Na-check na.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'Binabasa ng AI ang resibo at tinitingnan kung tugma ang amount, reference at petsa sa booking.',
    hook: ['Ilang resibo', 'na ang ni-zoom', 'mo ngayon?'],
    hookWide: ['Ilang resibo na', 'ang ni-zoom mo?'],
    answer: 'AI na ang babasa at magtutugma nito sa booking.',
    steps: [
      ['Mag-upload si guest', 'Ia-attach niya ang resibo sa booking niya.'],
      ['Babasahin ng AI', 'Chine-check ang amount, reference number at petsa.'],
      ['Tuloy ang booking', 'Kapag tugma, uusad ang stay. Kapag may mali, hihintayin ka.'],
    ],
  },
  '03-channel-sync': {
    tall: ['Wala nang', 'double', 'booking.'],
    wide: ['Wala nang', 'double booking.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'Two-way sync sa Airbnb, Booking.com at Vrbo, kaya walang gabing nabebenta nang doble.',
    hook: ['Na-double', 'book ka', 'na ba?'],
    hookWide: ['Na-double book', 'ka na ba?'],
    answer: 'Iisang calendar para sa Airbnb, Booking.com at Vrbo.',
    steps: [
      ['I-paste ang link', 'Ilagay ang calendar link ng bawat channel.'],
      ['Sync both ways', 'Pasok at labas ang bookings at blocked dates.'],
      ['Iisang calendar', 'Lahat ng booking, kita mo sa phone mo.'],
    ],
  },
  '04-smart-pricing': {
    tall: ['Tamang', 'presyo kada', 'gabi.'],
    wide: ['Tamang presyo', 'kada gabi.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'Ikaw ang mag-set ng rates, o hayaang mag-suggest ang AI ng presyo para sa bawat gabi.',
    hook: ['Same rate pa', 'rin kahit', 'long weekend?'],
    hookWide: ['Same rate pa rin', 'kahit long weekend?'],
    answer: 'May suggested rate ka na para sa bawat gabi.',
    steps: [
      ['I-set ang rules', 'Base rate, minimum, weekend at last-minute rules.'],
      ['May suggested rate', 'Bawat gabi may presyo base sa demand at petsa.'],
      ['Ikaw o autopilot', 'I-apply mo mismo, o hayaang tumakbo ang autopilot gabi-gabi.'],
    ],
  },
  '05-ai-receptionist': {
    tall: ['Tanong', 'ni guest,', 'sagot ni Kame.'],
    wide: ['Tanong ni guest,', 'sagot ni Kame.'],
    accentTall: 2,
    accentWide: 1,
    sub: 'Parking, check-in, house rules. Masasagot kahit madaling-araw.',
    hook: ['Paulit-ulit', 'na lang ba', 'ang tanong?'],
    hookWide: ['Paulit-ulit na', 'lang ba ang tanong?'],
    answer: 'Ipasagot mo na sa AI receptionist.',
    steps: [
      ['Mag-tap si guest', 'Magsisimula siya ng voice chat sa chat page mo.'],
      ['Magtanong lang', 'Parking, check-in, house rules, sa sarili niyang salita.'],
      ['Sagot, naka-save', 'Galing sa house guide mo ang sagot. Nasa inbox mo ang transcript.'],
    ],
  },
  '06-booking-site': {
    tall: ['Diretso na', "sa'yo", 'mag-book.'],
    wide: ["Diretso na sa'yo", 'mag-book.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'Sariling booking page mo, may live na dates at presyo, at kasama na ang guest form.',
    hook: ['Nagbabayad', 'ka pa ng fees', 'sa suki mo?'],
    hookWide: ['May fees pa rin', 'kahit suki mo na?'],
    answer: 'Papuntahin mo na sila sa sarili mong booking page.',
    steps: [
      ['Pumili ng template', 'Photos, rates at rules mo sa sarili mong page.'],
      ['Live na dates at presyo', 'Kita agad ni guest kung ano ang bakante at magkano.'],
      ['Book direct si guest', 'Kasama na ang guest form at ang bayad.'],
    ],
  },
  '07-content-studio': {
    tall: ['Ipakita', 'ang ganda ng', 'unit mo.'],
    wide: ['Ipakita ang ganda', 'ng unit mo.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'Ilagay ang photos mo, sabihin kung para saan ang post, at i-publish sa Facebook at Instagram.',
    hook: ['Walang time', 'mag-post', 'para sa unit?'],
    hookWide: ['Walang time', 'mag-post?'],
    answer: 'Gawing post ang photos mo, ilang minuto lang.',
    steps: [
      ['Ilagay ang photos', 'Simulan sa photos na meron ka na.'],
      ['Sabihin ang gusto', 'Sabihin kung para saan. AI ang susulat at mag-aayos ng layout.'],
      ['I-publish', 'I-post sa Facebook at Instagram mula sa dashboard.'],
    ],
  },
  '08-insights': {
    tall: ['Alam mo', 'na ang', 'next move mo.'],
    wide: ['Alam mo na ang', 'next move mo.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'Occupancy, rates at trends ng guests, may simpleng tips kung ano ang aayusin.',
    hook: ['Tumataas ba', 'o bumababa', 'ang occupancy?'],
    hookWide: ['Pataas o pababa', 'ang occupancy mo?'],
    answer: 'Makikita mo agad, may tips pa kung ano ang babaguhin.',
    steps: [
      ['Occupancy at rates', 'Gaano ka-full at magkano ang kita mo kada gabi.'],
      ['Kada buwan', 'Ikumpara ang mga buwan at makita agad ang matumal na linggo.'],
      ['Simpleng tips', 'Mga suggestion kung ano ang susunod na aayusin.'],
    ],
  },
  '09-team': {
    tall: ['Team mo.', 'Rules', 'mo.'],
    wide: ['Team mo.', 'Rules mo.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'I-invite ang cleaner, co-host at staff. Ikaw ang bahala kung ano ang kaya nilang makita at gawin.',
    hook: ['Iisang login', 'lang kayo ng', 'cleaner mo?'],
    hookWide: ['Iisang login lang', 'kayo ng cleaner mo?'],
    answer: 'Bigyan ng sariling access ang bawat isa.',
    steps: [
      ['I-invite by email', 'Idagdag ang cleaners, co-hosts at staff.'],
      ['Pumili ng role', 'Built-in role, o ikaw ang pumili ng bawat permission.'],
      ['Kanya-kanyang view', 'Makikita lang nila ang pinapayagan ng role nila.'],
    ],
  },
  '10-maintenance': {
    tall: ['Upkeep,', 'laging', 'on time.'],
    wide: ['Upkeep,', 'laging on time.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'Recurring tasks, reminders at malinaw na done list para sa bawat unit.',
    hook: ['Kailan huling', 'nalinis ang', 'aircon?'],
    hookWide: ['Kailan huling', 'nalinis ang aircon?'],
    answer: 'May recurring task at reminder na para sa bawat unit.',
    steps: [
      ['Mag-add ng task', 'Ano ang gagawin at gaano kadalas.'],
      ['I-assign', 'Sino ang gagawa at para sa aling unit.'],
      ['May reminder', 'Darating ang reminder on time. I-mark as done kapag tapos na.'],
    ],
  },
  '11-telegram-alerts': {
    tall: ['Unang', 'alam ng', 'team mo.'],
    wide: ['Unang alam', 'ng team mo.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'Bagong booking, guest message at maintenance, diretso sa tamang Telegram group.',
    hook: ['Na-miss na', 'naman ng team', 'ang booking?'],
    hookWide: ['Na-miss na naman', 'ng team ang booking?'],
    answer: 'Diretso na ang alerts sa Telegram groups ninyo.',
    steps: [
      ['I-connect ang Telegram', 'I-link ang team groups sa settings.'],
      ['Piliin ang events', 'Bagong booking, guest message, maintenance.'],
      ['Tamang group, agad', 'Bawat alert, sa group na kailangan nito.'],
    ],
  },
  '12-ai-mode': {
    tall: ['Itanong', 'mo lang.', 'Alam ni Kame.'],
    wide: ['Itanong mo lang.', 'Alam ni Kame.'],
    accentTall: 2,
    accentWide: 1,
    sub: 'Magtanong sa simpleng salita. Galing sa live bookings at finance mo ang sagot.',
    hook: ['Magkano', 'ang kinita mo', 'last month?'],
    hookWide: ['Magkano kinita mo', 'last month?'],
    answer: 'Itanong kay Kame. Galing sa totoong numbers mo ang sagot.',
    steps: [
      ['Itanong lang', '"Kumusta ang October kumpara sa September?"'],
      ['Binabasa ang data', 'Bookings, finance at calendar, live.'],
      ['Malinaw na sagot', 'Ang numbers, maikling summary at chart.'],
    ],
  },
  '13-stay-guide': {
    tall: ['Isang link.', 'Kumpleto', 'na lahat.'],
    wide: ['Isang link.', 'Kumpleto na lahat.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'Check-in steps, house rules, parking at Wi-Fi. Kusang naipapadala kapag ready na ang stay.',
    hook: ['"Ate, ano po', 'ang Wi-Fi', 'password?"'],
    hookWide: ['"Ate, ano po ang', 'Wi-Fi password?"'],
    answer: 'Isang guide lang, nandoon na lahat ng kailangan nila.',
    steps: [
      ['Pumili ng template', 'Anim na design. I-set ang kulay, font at sections.'],
      ['Ilagay ang details', 'Check-in steps, house rules, parking at Wi-Fi.'],
      ['Kusang naipapadala', 'Lalabas ang link kapag ready na for check-in ang booking.'],
    ],
  },
  '14-deposit-refund': {
    tall: ['Deposit', 'refund, wala', 'nang habulan.'],
    wide: ['Deposit refund,', 'wala nang habulan.'],
    accentTall: 2,
    accentWide: 1,
    sub: 'Review, voucher para sa susunod na stay, at si guest ang pipili kung paano ibabalik ang deposit.',
    hook: ['Hinahabol mo', 'pa ang refund', 'details?'],
    hookWide: ['Hinahabol mo pa', 'ang refund details?'],
    answer: 'Si guest na ang magfi-fill out ng maikling form after checkout.',
    steps: [
      ['Mag-review si guest', 'Stars at quick tags, nasa form na.'],
      ['May pa-voucher', 'Thank-you na magagamit sa susunod niyang stay.'],
      ['Siya ang pipili', 'GCash, bank o cash pickup. Kita mo sa booking.'],
    ],
  },
  '15-parking': {
    tall: ['Parking mo,', 'pwede', 'nang kumita.'],
    wide: ['Parking mo,', 'pwede nang kumita.'],
    accentTall: 1,
    accentWide: 1,
    sub: "Tanggapin ang request sa isang tap. Magbabayad si guest at ipapadala ang PMO endorsement para sa'yo.",
    hook: ['Bakante ang', 'parking slot', 'buong linggo?'],
    hookWide: ['Bakante ang parking', 'buong linggo?'],
    answer: 'I-list ito at tumanggap ng request mula sa guests sa malapit.',
    steps: [
      ['I-list ang slot', 'I-set ang rate at kung kailan bakante.'],
      ['Tanggapin ang request', 'May timer ang bawat request. Isang tap lang para tanggapin.'],
      ['Bayad na, alam ng PMO', 'Kusang ipinapadala ang endorsement email.'],
    ],
  },
  '16-guest-inbox': {
    tall: ['Sagot agad,', 'bago pa', 'mag-follow up.'],
    wide: ['Sagot agad, bago', 'pa mag-follow up.'],
    accentTall: 1,
    accentWide: 1,
    sub: "Messenger, Instagram at web chat sa iisang inbox, may naka-draft na reply para sa'yo.",
    hook: ['Tatlong app', 'para sa', 'isang guest?'],
    hookWide: ['Tatlong app para', 'sa isang guest?'],
    answer: 'Lahat ng message sa iisang inbox, may draft na ang reply.',
    steps: [
      ['Iisang inbox', 'Magkakasama ang Messenger, Instagram at web chat.'],
      ['May draft na', 'Gagawa ang AI ng reply mula sa house info mo.'],
      ['I-send o i-edit', 'I-check mo, baguhin kung gusto, tapos send.'],
    ],
  },
  '17-finance': {
    tall: ['Ang kita mo,', 'kitang-kita', 'mo na.'],
    wide: ['Ang kita mo,', 'kitang-kita na.'],
    accentTall: 1,
    accentWide: 1,
    sub: 'Kusang naitatala ang kita mula sa bawat booking. Ilagay ang gastos at i-export ang report.',
    hook: ['Alam mo ba', 'ang totoong', 'kita mo?'],
    hookWide: ['Alam mo ba ang', 'totoong kita mo?'],
    answer: 'Kusang naitatala ang income. Ilagay ang gastos, kita mo agad ang natira.',
    steps: [
      ['Kita mula sa booking', 'Naitatala ang bawat bayad na booking.'],
      ['Ilagay ang gastos', 'Linis, repairs at bills, pwedeng recurring.'],
      ['I-export ang report', 'Monthly PDF na pwedeng i-share o i-file.'],
    ],
  },
};

/* ------------------------------------------------------------------ *
 * Campaign concepts
 * ------------------------------------------------------------------ */

export const manifestoFilipino: ManifestoCopy = {
  kicker: 'Kaya ka nag-host',
  chores: ['Resibo.', 'Screenshot.', 'GAF.', 'Excel.'],
  big: 'Guests.',
  sub: 'Sa iba, Kame na bahala.',
  open: ['Nag-host ka', 'para sa', 'guests,'],
  notFor: 'hindi sa',
  close: ['Sa admin?', 'Kame na', 'bahala.'],
  closeAccent: 1,
  outro: 'Ikaw, sa guests lang.',
};

export const questionFilipino: QuestionCopy = {
  kicker: 'Tanong lang, mga host',
  lines: ['Saan napupunta', 'ang mga resibo?'],
  options: [
    'Sa GC, lunod na sa chat',
    'Sa gallery, katabi ng memes',
    'Sa Drive na hindi ko na mahanap',
    'Naka-match na sa booking, sa Kame',
  ],
  comment: 'Comment ka ng letra',
};

export const lockFilipino = {
  tall: ['Tulog ka.', 'Gising', 'si Kame.'],
  wide: ['Tulog ka.', 'Gising si Kame.'],
  sub: 'Habang tulog ka, na-check na ang resibo, na-file ang approval at may guide na ang guests.',
};
