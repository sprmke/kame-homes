import { CalendarClock, Lightbulb, Sparkles, Wand2 } from 'lucide-react';

import { ease } from '../motion';
import { c } from '../theme';
import { ViewArt } from './guestScreens';
import {
  Body,
  Btn,
  Card,
  CheckDot,
  HomeBar,
  Label,
  Pill,
  Screen,
  tab,
  TitleBar,
  useAnim,
  type ScreenAnim,
} from './kit';

/* ------------------------------------------------------------------ *
 * Content Studio: describe a post, get one that looks like your place
 * ------------------------------------------------------------------ */

const PROMPT = 'Weekend post for the balcony view. Warm, short, one line about booking direct.';
const CAPTION =
  'Golden hour from the 26th floor. October weekends are open. Book direct at the link in bio.';

export function ContentStudioScreen(a: ScreenAnim) {
  const { at, frame, p, on } = useAnim(a);
  const typed = p(4, 34);
  const shown = PROMPT.slice(0, Math.round(PROMPT.length * typed));
  const made = p(44, 66);
  return (
    <Screen>
      <TitleBar
        title="Content Studio"
        right={
          <Pill tone="soft" icon={Sparkles}>
            AI
          </Pill>
        }
      />
      <Body top={116}>
        <Card pad={14}>
          <Label>Describe the post</Label>
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.4,
              marginTop: 6,
              minHeight: 63,
              letterSpacing: '-0.01em',
            }}
          >
            {frame > 50_000 ? PROMPT : shown}
            {typed > 0 && typed < 1 ? (
              <span style={{ color: c.brand, fontWeight: 700 }}>|</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Pill tone="muted">3 photos added</Pill>
            <Pill tone={on(38) ? 'brand' : 'dark'} icon={Wand2}>
              {on(38) ? 'Made' : 'Make post'}
            </Pill>
          </div>
        </Card>
        <Card
          pad={0}
          style={{
            overflow: 'hidden',
            opacity: made,
            transform: `translateY(${(1 - made) * 20}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
            <span style={{ width: 30, height: 30, borderRadius: 99, background: c.brand }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Skyline Suite 2604</div>
              <div style={{ fontSize: 11.5, color: c.muted }}>Preview</div>
            </div>
          </div>
          <ViewArt w={361} h={190} r={0} />
          <div
            style={{
              padding: '12px 14px 14px',
              fontSize: 14,
              lineHeight: 1.4,
              letterSpacing: '-0.01em',
            }}
          >
            {CAPTION}
          </div>
        </Card>
        <Card pad={14} style={{ paddingTop: 10, paddingBottom: 10, ...at(74) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 14, fontSize: 14, fontWeight: 700 }}>
              {['Facebook', 'Instagram'].map((k) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <CheckDot done size={18} /> {k}
                </span>
              ))}
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 13,
                fontWeight: 600,
                color: c.muted,
              }}
            >
              <CalendarClock size={14} /> Fri 6 PM
            </span>
          </div>
        </Card>
        <div style={{ display: 'flex', ...at(82, 10) }}>
          <Btn tone={on(100) ? 'brand' : 'dark'}>{on(100) ? 'Scheduled' : 'Schedule post'}</Btn>
        </div>
      </Body>
      <HomeBar />
    </Screen>
  );
}

/* ------------------------------------------------------------------ *
 * Insights: numbers plus a plain tip
 * ------------------------------------------------------------------ */

const occ = [
  { w: 'Mon', v: 42 },
  { w: 'Tue', v: 38 },
  { w: 'Wed', v: 46 },
  { w: 'Thu', v: 64 },
  { w: 'Fri', v: 96 },
  { w: 'Sat', v: 100 },
  { w: 'Sun', v: 82 },
];

export function InsightsScreen(a: ScreenAnim) {
  const { at, frame } = useAnim(a);
  const s0 = a.startAt ?? 0;
  return (
    <Screen>
      <TitleBar title="Insights" right={<Pill tone="muted">October</Pill>} />
      <Body top={116}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            ['Occupancy', '78%', '+6 pts'],
            ['Avg. nightly rate', '₱3,450', '+₱150'],
          ].map(([k, v, d], i) => (
            <Card key={k} pad={14} style={at(i * 6, 12)}>
              <Label>{k}</Label>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  marginTop: 4,
                  ...tab,
                }}
              >
                {v}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: c.brandDeep, marginTop: 2 }}>
                {d} vs Sep
              </div>
            </Card>
          ))}
        </div>
        <Card style={at(12)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Occupancy by weekday</div>
            <Label>Oct</Label>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 9, height: 150, marginTop: 16 }}
          >
            {occ.map((o, i) => {
              const g = ease(frame, s0 + 16 + i * 3, s0 + 40 + i * 3);
              const low = o.v < 50;
              return (
                <div
                  key={o.w}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: low ? 'hsl(32 70% 36%)' : c.inkSoft,
                      opacity: g,
                      ...tab,
                    }}
                  >
                    {o.v}%
                  </span>
                  <span
                    style={{
                      width: '100%',
                      height: `${o.v * 0.72 * g}%`,
                      borderRadius: 8,
                      background: low ? c.sun : c.brand,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 8 }}>
            {occ.map((o) => (
              <span
                key={o.w}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: c.muted,
                }}
              >
                {o.w}
              </span>
            ))}
          </div>
        </Card>
        <Card style={{ background: c.night, border: 'none', color: c.white, ...at(56) }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: c.mint,
            }}
          >
            <Lightbulb size={14} /> What to try
          </div>
          <div
            style={{
              fontSize: 16,
              lineHeight: 1.4,
              fontWeight: 600,
              marginTop: 8,
              letterSpacing: '-0.015em',
            }}
          >
            Mon to Wed sit under half full. A midweek rate 10% lower could fill about 4 more nights.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Btn tone="mint" style={{ height: 40, fontSize: 14 }}>
              Open Pricing
            </Btn>
          </div>
        </Card>
      </Body>
      <HomeBar />
    </Screen>
  );
}
