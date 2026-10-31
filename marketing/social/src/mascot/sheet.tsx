import { AbsoluteFill } from 'remotion';

import { SETTLED } from '../motion';
import { FONT } from '../theme';
import { Kame } from './Kame';
import { pose, type PoseName } from './poses';
import type { Prop } from './Kame';

/** Reference sheet: every pose and prop, for picking and for on-model checks. */
const CELLS: [PoseName, Prop, string][] = [
  ['idle', 'none', 'idle'],
  ['wave', 'none', 'wave'],
  ['cheer', 'none', 'cheer'],
  ['pointR', 'none', 'pointR'],
  ['pointL', 'none', 'pointL'],
  ['talk', 'none', 'talk'],
  ['show', 'receipt', 'show · receipt'],
  ['show', 'key', 'show · key'],
  ['hold', 'phone', 'hold · phone'],
  ['show', 'coin', 'show · coin'],
  ['love', 'none', 'love'],
  ['proud', 'none', 'proud'],
  ['sleepy', 'none', 'sleepy'],
];

export const SHEET_BG = 'hsl(36 70% 90%)';

export function PoseSheet() {
  const cols = 5;
  const cw = 384;
  const ch = 470;
  return (
    <AbsoluteFill style={{ background: SHEET_BG, fontFamily: FONT, padding: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', width: cols * cw }}>
        {CELLS.map(([name, prop, label], i) => (
          <div key={i} style={{ width: cw, height: ch, position: 'relative' }}>
            <Kame
              w={cw}
              h={ch - 50}
              pose={pose(name, SETTLED, { prop, seed: i, still: true })}
              look={{ shadow: 'hsl(30 45% 55%)', shadowOpacity: 0.3 }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 14,
                width: '100%',
                textAlign: 'center',
                fontSize: 26,
                fontWeight: 700,
                color: 'hsl(25 40% 25%)',
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
