import type { ReactNode } from 'react';

import {
  Check,
  Clapperboard,
  Download,
  ImageIcon,
  LayoutTemplate,
  Plus,
  Send,
  Sparkles,
  Waves,
  Wifi,
} from 'lucide-react';
import { useCurrentFrame } from 'remotion';

import {
  Btn,
  CARD,
  Chip,
  Cursor,
  ease,
  Field,
  FilmScene,
  PhotoTile,
  popIn,
  reveal,
  Segmented,
  Toast,
  TierPill,
  typewriter,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/** Content Studio top bar: builder title, inline mode tabs, Download / Publish. */
function StudioBar({ mode, children }: { mode: string; children?: ReactNode }) {
  return (
    <div className={cn(CARD, 'mb-4 flex items-center gap-4 px-4 py-3')}>
      <p className="text-foreground text-base font-semibold">Content Studio</p>
      <Segmented options={['Calendar', 'Design', 'Video', 'Generate']} active={mode} />
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

/* ---------------- Content Studio builders ---------------- */

export function MarketingStudioScene() {
  const frame = useCurrentFrame();
  const mode = frame < 62 ? 'Calendar' : frame < 124 ? 'Design' : 'Video';
  const local = mode === 'Calendar' ? frame : mode === 'Design' ? frame - 62 : frame - 124;
  const published = frame >= 170;

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 40, x: 0.58, y: 0.56, zoom: 1.1 },
      ]}
    >
      <FilmShell context="property" active="Marketing" dense>
        <StudioBar mode={mode}>
          <Btn icon={Download}>Download</Btn>
          <Btn variant="primary" icon={Send}>
            Publish
          </Btn>
        </StudioBar>
        <div className="grid grid-cols-[220px_1fr] gap-4">
          <div className={cn(CARD, 'space-y-2 p-3')}>
            <p className="text-muted-foreground px-1 text-xs font-semibold uppercase tracking-wide">
              Templates
            </p>
            {[0, 1, 2, 3].map((index) => (
              <PhotoTile
                key={index}
                variant={index}
                className={cn('h-[96px]', index === 0 && 'ring-primary ring-2 ring-offset-2')}
              />
            ))}
          </div>
          <div className="bg-muted/50 flex h-[540px] items-center justify-center rounded-xl">
            <div key={mode} style={popIn(frame, frame - local, 14)}>
              {mode === 'Calendar' ? (
                <div className="w-[420px] rounded-2xl bg-[#0f3b3a] p-6 text-white shadow-xl">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-teal-200">
                    Monaco 2604
                  </p>
                  <p className="mt-1 text-[28px] font-bold">October openings</p>
                  <div className="mt-4 grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 35 }, (_, index) => {
                      const free = [5, 6, 7, 13, 14, 19, 20, 26, 27, 28].includes(index);
                      return (
                        <span
                          key={index}
                          className={cn(
                            'flex h-8 items-center justify-center rounded-md text-[11px] font-semibold',
                            free ? 'bg-teal-300 text-[#0f3b3a]' : 'bg-white/10 text-white/50'
                          )}
                        >
                          {index + 1 <= 31 ? index + 1 : ''}
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-sm text-teal-100">
                    Book direct and save. Message us today.
                  </p>
                </div>
              ) : mode === 'Design' ? (
                <PhotoTile variant={0} className="h-[440px] w-[352px] shadow-xl">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute inset-x-6 bottom-6 text-white">
                    <p className="text-[34px] font-extrabold leading-tight">Weekend escape</p>
                    <p className="mt-1 text-sm text-white/85">Pool · City view · Fast Wi-Fi</p>
                    <span className="bg-primary mt-3 inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold">
                      From ₱3,200 a night
                    </span>
                  </div>
                </PhotoTile>
              ) : (
                <div className="w-[560px]">
                  <PhotoTile variant={3} className="h-[315px] shadow-xl">
                    <div className="absolute inset-x-6 bottom-6 text-white">
                      <p className="text-[30px] font-extrabold drop-shadow">Your pool is waiting</p>
                    </div>
                  </PhotoTile>
                  <div className="mt-4 flex gap-1.5">
                    {[0, 1, 2, 3].map((clip) => (
                      <PhotoTile key={clip} variant={clip} className="h-14 flex-1 rounded-lg" />
                    ))}
                  </div>
                  <div className="bg-border mt-2 h-1 rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${ease(frame, 124, 200) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </FilmShell>
      <div className="absolute right-[40px] top-[96px]">
        <Toast
          icon={Check}
          title="Published"
          body="Posted to Facebook and Instagram"
          style={published ? reveal(frame, 170, 12) : { opacity: 0 }}
        />
      </div>
      <Cursor
        path={[
          { at: 40, x: 560, y: 60 },
          { at: 58, x: 503, y: 52, click: true },
          { at: 120, x: 572, y: 52, click: true },
          { at: 164, x: 1196, y: 52, click: true },
        ]}
      />
    </FilmScene>
  );
}

/* ---------------- AI Studio: photos and posts ---------------- */

const PROMPT = 'Bright living room at golden hour, city view';

function GenerateComposer({
  kind,
  frame,
  children,
  tier,
}: {
  kind: 'Photo' | 'Video';
  frame: number;
  children: ReactNode;
  tier: string;
}) {
  return (
    <div className={cn(CARD, 'flex h-[512px] w-[380px] shrink-0 flex-col p-5')}>
      <div className="mb-4 flex items-center gap-2">
        <div className="bg-muted inline-flex rounded-lg p-1">
          {[
            { label: 'AI Post', icon: LayoutTemplate },
            { label: 'Photo', icon: ImageIcon },
            { label: 'Video', icon: Clapperboard },
          ].map(({ label, icon: Icon }) => (
            <span
              key={label}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold',
                label === kind ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </span>
          ))}
        </div>
        <TierPill tier={tier} />
      </div>
      <div className="min-h-0 flex-1 space-y-4">{children}</div>
      <span
        className="bg-primary text-primary-foreground flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold shadow-sm"
        style={{ opacity: 0.7 + ease(frame, 60, 80) * 0.3 }}
      >
        <Sparkles className="size-4" />
        Generate
      </span>
    </div>
  );
}

function Generating({ frame, from }: { frame: number; from: number }) {
  const sweep = ((frame - from) % 40) / 40;
  return (
    <div className="bg-muted relative h-full w-full overflow-hidden rounded-xl">
      <div
        className="via-background/70 absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent to-transparent"
        style={{ left: `${-50 + sweep * 150}%` }}
      />
    </div>
  );
}

export function AiPhotoScene() {
  const frame = useCurrentFrame();
  const generating = frame >= 84 && frame < 124;
  const done = frame >= 124;

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 50, x: 0.36, y: 0.5, zoom: 1.12 },
        { at: 140, x: 0.68, y: 0.5, zoom: 1.12 },
      ]}
    >
      <FilmShell context="property" active="Marketing" dense>
        <StudioBar mode="Generate" />
        <div className="flex gap-4">
          <GenerateComposer kind="Photo" frame={frame} tier="Pro">
            <Field
              multiline
              label="Describe the photo"
              value={typewriter(PROMPT, frame, 8, 50)}
              caret={frame < 54}
            />
            <div>
              <p className="text-foreground mb-1.5 text-[13px] font-medium">Your photos</p>
              <div className="flex gap-2">
                {[0, 1, 2].map((index) => (
                  <PhotoTile
                    key={index}
                    variant={index}
                    className="size-16 rounded-lg"
                    style={reveal(frame, 30 + index * 5)}
                  />
                ))}
                <span className="border-border text-muted-foreground flex size-16 items-center justify-center rounded-lg border border-dashed">
                  <Plus className="size-5" />
                </span>
              </div>
            </div>
            <div>
              <p className="text-foreground mb-1.5 text-[13px] font-medium">Look</p>
              <div className="flex flex-wrap gap-1.5">
                {['Golden hour', 'Bright and airy', 'Evening glow'].map((look, index) => (
                  <span
                    key={look}
                    className={cn(
                      'rounded-full border px-3 py-1 text-[13px] font-medium',
                      index === 0 && frame >= 58
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-foreground'
                    )}
                  >
                    {look}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-foreground mb-1.5 text-[13px] font-medium">Quality</p>
              <Segmented options={['Draft', 'Standard']} active="Standard" />
            </div>
          </GenerateComposer>

          <div className="grid h-[512px] flex-1 grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((index) => {
              if (!generating && !done) {
                return (
                  <div
                    key={index}
                    className="border-border flex items-center justify-center rounded-xl border border-dashed"
                  >
                    {index === 0 ? <Sparkles className="text-muted-foreground size-6" /> : null}
                  </div>
                );
              }
              if (generating) return <Generating key={index} frame={frame} from={84 + index * 4} />;
              const post = index % 2 === 1;
              return (
                <PhotoTile
                  key={index}
                  variant={index === 0 ? 0 : index === 1 ? 1 : index === 2 ? 2 : 0}
                  className="h-full"
                  style={popIn(frame, 124 + index * 6)}
                >
                  {post ? (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                      <div className="absolute inset-x-4 bottom-4 text-white">
                        <p className="text-xl font-extrabold leading-tight">
                          {index === 1 ? 'Slow mornings' : 'Your city escape'}
                        </p>
                        <div className="mt-2 flex gap-2 text-[11px] font-semibold">
                          <span className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5">
                            <Waves className="size-3" /> Pool
                          </span>
                          <span className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5">
                            <Wifi className="size-3" /> Wi-Fi
                          </span>
                        </div>
                      </div>
                    </>
                  ) : null}
                  <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {post ? 'AI Post' : 'Photo'}
                  </span>
                </PhotoTile>
              );
            })}
          </div>
        </div>
      </FilmShell>
      <Cursor
        path={[
          { at: 50, x: 300, y: 400 },
          { at: 58, x: 310, y: 432, click: true },
          { at: 80, x: 420, y: 588, click: true },
          { at: 150, x: 860, y: 380 },
        ]}
      />
    </FilmScene>
  );
}

/* ---------------- AI Studio: video ---------------- */

const CAMERA_MOVES = ['Push in', 'Pull back', 'Pan', 'Orbit', 'Rise', 'Walkthrough'];

export function AiVideoScene() {
  const frame = useCurrentFrame();
  const generating = frame >= 74 && frame < 110;
  const done = frame >= 110;
  // The finished clip plays a slow push-in on the source photo.
  const play = ease(frame, 112, 228, (t) => t);

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 46, x: 0.36, y: 0.52, zoom: 1.12 },
        { at: 130, x: 0.68, y: 0.48, zoom: 1.14 },
      ]}
    >
      <FilmShell context="property" active="Marketing" dense>
        <StudioBar mode="Generate" />
        <div className="flex gap-4">
          <GenerateComposer kind="Video" frame={frame} tier="Business">
            <div>
              <p className="text-foreground mb-1.5 text-[13px] font-medium">Start from a photo</p>
              <PhotoTile variant={3} className="ring-primary h-[110px] ring-2 ring-offset-2" />
            </div>
            <div>
              <p className="text-foreground mb-1.5 text-[13px] font-medium">Camera move</p>
              <div className="grid grid-cols-3 gap-1.5">
                {CAMERA_MOVES.map((move, index) => (
                  <span
                    key={move}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-center text-[13px] font-medium',
                      index === 0 && frame >= 40
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-foreground'
                    )}
                  >
                    {move}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-foreground mb-1.5 text-[13px] font-medium">Sound</p>
                <Segmented options={['Ambient', 'Music']} active="Ambient" />
              </div>
              <div>
                <p className="text-foreground mb-1.5 text-[13px] font-medium">Resolution</p>
                <Segmented options={['720p', '1080p']} active="1080p" />
              </div>
            </div>
          </GenerateComposer>

          <div className={cn(CARD, 'flex h-[512px] flex-1 flex-col p-4')}>
            <div className="relative flex-1 overflow-hidden rounded-xl">
              {done ? (
                <div className="absolute inset-0" style={popIn(frame, 110)}>
                  <PhotoTile
                    variant={3}
                    className="absolute inset-0 rounded-none"
                    style={{ transform: `scale(${1 + play * 0.18})`, transformOrigin: '50% 60%' }}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                    <div className="h-1 overflow-hidden rounded-full bg-white/30">
                      <div
                        className="h-full rounded-full bg-white"
                        style={{ width: `${play * 100}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs font-semibold text-white">
                      <span>0:0{Math.min(8, Math.floor(play * 8))}</span>
                      <span>0:08</span>
                    </div>
                  </div>
                </div>
              ) : generating ? (
                <Generating frame={frame} from={74} />
              ) : (
                <div className="border-border flex h-full items-center justify-center rounded-xl border border-dashed">
                  <Clapperboard className="text-muted-foreground size-7" />
                </div>
              )}
            </div>
            <div
              className="mt-3 flex items-center gap-2"
              style={done ? reveal(frame, 120) : { opacity: 0 }}
            >
              <Chip tone="primary">8s · 1080p</Chip>
              <Chip>Push in</Chip>
              <div className="ml-auto flex gap-2">
                <Btn icon={Download} className="h-9">
                  Download
                </Btn>
                <Btn variant="primary" icon={Send} className="h-9">
                  Publish
                </Btn>
              </div>
            </div>
          </div>
        </div>
      </FilmShell>
      <Cursor
        path={[
          { at: 26, x: 300, y: 330 },
          { at: 38, x: 318, y: 300, click: true },
          { at: 70, x: 420, y: 588, click: true },
          { at: 130, x: 860, y: 360 },
        ]}
      />
    </FilmScene>
  );
}
