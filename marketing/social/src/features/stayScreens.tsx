import {
  Car,
  ChevronRight,
  DoorOpen,
  Gift,
  ImageIcon,
  KeyRound,
  Mail,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  SquareParking,
  Star,
  Timer,
  Wallet,
} from 'lucide-react';

import { Diamond } from '../primitives';
import { c } from '../theme';
import {
  Body,
  Btn,
  Card,
  CheckDot,
  HomeBar,
  IconTile,
  Label,
  Pill,
  Row,
  Screen,
  tab,
  TitleBar,
  useAnim,
  type ScreenAnim,
} from './kit';
import { ViewArt } from './guestScreens';

/* ------------------------------------------------------------------ *
 * Stay guide: what the guest opens in the lobby
 * ------------------------------------------------------------------ */

const chapters = [
  { icon: KeyRound, k: 'Check-in steps', s: 'Lobby, elevator, door code' },
  { icon: ScrollText, k: 'House rules', s: 'Quiet hours from 10 PM' },
  { icon: SquareParking, k: 'Parking', s: 'B2, slot 41 · show this pass' },
  { icon: DoorOpen, k: 'Check-out', s: 'Mon 11 AM · keys in the box' },
];

export function StayGuideScreen(a: ScreenAnim) {
  const { at } = useAnim(a);
  return (
    <Screen bg={c.white}>
      <Body top={58} gap={12}>
        <div style={at(0, 10)}>
          <ViewArt h={176} />
        </div>
        <div style={{ padding: '2px 4px 0', ...at(6, 10) }}>
          <Label>Skyline Suite 2604 · Oct 18 to 20</Label>
          <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-0.035em', marginTop: 4 }}>
            Welcome, Maria
          </div>
        </div>
        <div
          style={{
            borderRadius: 22,
            background: c.ink,
            color: c.white,
            padding: '14px 16px',
            ...at(14),
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <Diamond size={10} color={c.mint} /> Stay pass
            </span>
            <Pill tone="mint">KH-2381</Pill>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
            {[
              ['Check-in', 'Sat 2 PM'],
              ['Check-out', 'Mon 11 AM'],
              ['Wi-Fi', 'Skyline2604'],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 12, fontWeight: 600, color: c.nightSub }}>{k}</div>
                <div style={{ fontSize: 15.5, fontWeight: 700, marginTop: 2, ...tab }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <Card pad={14} style={{ paddingTop: 2, paddingBottom: 2 }}>
          {chapters.map((r, i) => (
            <div key={r.k} style={at(26 + i * 8, 12)}>
              <Row
                first={i === 0}
                lead={<IconTile icon={r.icon} size={36} />}
                title={r.k}
                sub={r.s}
                right={<ChevronRight size={18} color={c.muted} />}
              />
            </div>
          ))}
        </Card>
        <div style={{ display: 'flex', ...at(64) }}>
          <Btn tone="brand" style={{ height: 50 }}>
            <MessageCircle size={17} /> Need anything?
          </Btn>
        </div>
      </Body>
      <HomeBar />
    </Screen>
  );
}

/* ------------------------------------------------------------------ *
 * Deposit refund: review, a voucher for next time, refund details
 * ------------------------------------------------------------------ */

const REEL = ['₱300 off', '5% off', '₱500 off', 'Free late out', '₱500 off'];

export function DepositRefundScreen(a: ScreenAnim) {
  const { at, on, p, frame } = useAnim(a);
  const s0 = a.startAt ?? 0;
  const stars = Math.round(p(6, 30) * 5);
  const spin = p(52, 92);
  // Reel slows into the last item; settles once and holds.
  const reelPos =
    spin >= 1 ? REEL.length - 1 : Math.floor(spin * spin * (REEL.length - 1) * 3) % REEL.length;
  const submitted = on(118);
  const step = submitted ? 3 : on(52) ? 2 : 1;
  return (
    <Screen>
      <TitleBar
        title="Deposit refund"
        right={<Pill tone="muted">Step {Math.min(step, 3)} of 3</Pill>}
      />
      <Body top={118} gap={10}>
        <Card style={at(0, 12)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>1 · How was your stay?</Label>
            <CheckDot done={stars === 5} size={22} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                size={30}
                strokeWidth={1.8}
                color={i < stars ? c.sun : 'hsl(150 6% 82%)'}
                fill={i < stars ? c.sun : 'transparent'}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {['Spotless', 'Great view', 'Easy check-in'].map((t, i) => (
              <Pill key={t} tone={on(30 + i * 5) ? 'brand' : 'muted'}>
                {t}
              </Pill>
            ))}
          </div>
        </Card>
        <Card style={at(44, 12)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>2 · A thank-you for next time</Label>
            <Gift size={18} color={c.brandDeep} />
          </div>
          <div
            style={{
              marginTop: 10,
              height: 64,
              borderRadius: 16,
              background: c.tint,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: c.brandDeep,
                ...tab,
              }}
            >
              {frame >= s0 + 52 || frame > 50_000 ? REEL[reelPos] : '?'}
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: c.muted, marginTop: 8 }}>
            Voucher saved to your account for your next stay here
          </div>
        </Card>
        <Card style={at(98, 12)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>3 · Where should we send ₱2,000?</Label>
            <Wallet size={18} color={c.brandDeep} />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 14,
              border: `2px solid ${c.brand}`,
            }}
          >
            <CheckDot done size={20} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>GCash, same number</div>
              <div style={{ fontSize: 12.5, color: c.muted, ...tab }}>0917 ••• 4471</div>
            </div>
          </div>
          <div style={{ display: 'flex', marginTop: 12 }}>
            <Btn tone={submitted ? 'ghost' : 'dark'} style={{ height: 44 }}>
              {submitted ? 'Refund details sent' : 'Submit'}
            </Btn>
          </div>
        </Card>
      </Body>
      <HomeBar />
    </Screen>
  );
}

/* ------------------------------------------------------------------ *
 * Parking: a request comes in, the slot owner claims it
 * ------------------------------------------------------------------ */

const parkingSteps = [
  { icon: Wallet, k: 'Guest paid', s: '₱900 · 3 nights' },
  { icon: Mail, k: 'Endorsement sent', s: 'Emailed to the PMO, guest in CC' },
  { icon: Car, k: 'Access note shared', s: 'Ramp entrance, show plate ABC 1234' },
];

export function ParkingClaimScreen(a: ScreenAnim) {
  const { at, on, frame } = useAnim(a);
  const s0 = a.startAt ?? 0;
  const accepted = on(44);
  const left = frame > 50_000 ? 0 : Math.max(0, 14 * 60 + 52 - Math.floor((frame - s0) / 6));
  const stepAt = (i: number) => 64 + i * 18;
  const all = on(stepAt(2) + 6);
  return (
    <Screen>
      <TitleBar back="Parking" title="B2 · Slot 41" />
      <Body top={140}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pill
              tone={accepted ? (all ? 'brand' : 'soft') : 'sun'}
              icon={accepted ? ShieldCheck : Timer}
            >
              {accepted ? (all ? 'Confirmed' : 'Awaiting payment') : 'New request'}
            </Pill>
            {!accepted ? (
              <span style={{ fontSize: 14, fontWeight: 700, color: c.inkSoft, ...tab }}>
                {String(Math.floor(left / 60)).padStart(2, '0')}:
                {String(left % 60).padStart(2, '0')} left
              </span>
            ) : (
              <Label>Skyline Tower</Label>
            )}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 12 }}>
            Oct 18 to 21 · SUV
          </div>
          <div style={{ fontSize: 13.5, color: c.muted, marginTop: 4 }}>
            Matched to your slot · cheapest eligible first
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
            {[
              ['Rate', '₱300 / night'],
              ['You earn', '₱900'],
            ].map(([k, v]) => (
              <div key={k}>
                <Label style={{ fontSize: 12 }}>{k}</Label>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2, ...tab }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {accepted ? (
              <Btn tone="ghost" style={{ height: 44 }}>
                Accepted
              </Btn>
            ) : (
              <>
                <Btn tone="ghost" style={{ height: 44 }}>
                  Decline
                </Btn>
                <Btn tone="brand" style={{ height: 44 }}>
                  Accept
                </Btn>
              </>
            )}
          </div>
        </Card>
        <div
          style={{ fontSize: 15, fontWeight: 700, margin: '8px 4px 0', ...at(stepAt(0) - 6, 10) }}
        >
          After you accept
        </div>
        <Card pad={14} style={{ paddingTop: 4, paddingBottom: 4, ...at(stepAt(0) - 4, 12) }}>
          {parkingSteps.map((r, i) => (
            <div key={r.k} style={at(stepAt(i), 12)}>
              <Row
                first={i === 0}
                lead={<IconTile icon={r.icon} size={36} />}
                title={r.k}
                sub={r.s}
                right={<CheckDot done={on(stepAt(i) + 6)} size={22} />}
              />
            </div>
          ))}
        </Card>
      </Body>
      <HomeBar />
    </Screen>
  );
}

/* ------------------------------------------------------------------ *
 * Guest side of a payment: upload the receipt, done
 * ------------------------------------------------------------------ */

export function GuestUploadScreen(a: ScreenAnim) {
  const { at, on, p } = useAnim(a);
  const up = p(14, 40);
  const sent = on(48);
  return (
    <Screen bg={c.white}>
      <TitleBar back="Your booking" title="Payment" />
      <Body top={140} gap={12}>
        <Card style={{ background: c.paper }}>
          <Label>Skyline Suite 2604</Label>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: 6,
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 700 }}>Oct 18 to 20</span>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', ...tab }}>
              ₱8,400
            </span>
          </div>
        </Card>
        <Label style={{ margin: '4px 4px 0' }}>Payment receipt</Label>
        <div
          style={{
            borderRadius: 22,
            border: `2px ${up >= 1 ? 'solid' : 'dashed'} ${up >= 1 ? c.brand : c.line}`,
            padding: 14,
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            ...at(4),
          }}
        >
          <div
            style={{
              width: 92,
              height: 124,
              borderRadius: 12,
              background: c.paper,
              border: `1px solid ${c.line}`,
              padding: 10,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              opacity: 0.25 + 0.75 * up,
            }}
          >
            <span style={{ width: 22, height: 22, borderRadius: 99, background: c.brand }} />
            <span style={{ fontSize: 13, fontWeight: 800, ...tab }}>₱8,400</span>
            {[60, 48, 66, 40].map((w, i) => (
              <span key={i} style={{ width: w, height: 5, borderRadius: 3, background: c.line }} />
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              <ImageIcon size={16} /> receipt.jpg
            </div>
            <div style={{ fontSize: 12.5, color: c.muted, marginTop: 4 }}>
              Bank transfer · 1.2 MB
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 6,
                background: c.paper,
                marginTop: 12,
                overflow: 'hidden',
              }}
            >
              <div style={{ width: `${up * 100}%`, height: '100%', background: c.brand }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 4, ...at(10) }}>
          <Btn tone={sent ? 'ghost' : 'brand'} style={{ height: 52, fontSize: 16.5 }}>
            {sent ? 'Sent to your host' : 'Submit receipt'}
          </Btn>
        </div>
        {sent ? (
          <div style={{ textAlign: 'center', ...at(48, 8) }}>
            <Pill tone="soft" icon={Mail}>
              We will email you once it is confirmed
            </Pill>
          </div>
        ) : null}
      </Body>
      <HomeBar />
    </Screen>
  );
}
