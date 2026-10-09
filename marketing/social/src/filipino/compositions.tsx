import type { ComponentType } from 'react';

import { Composition, Folder, Still } from 'remotion';

import { CopyProvider } from '../copy';
import { HOOK_FRAMES, KIT_SLIDES } from '../features/extras';
import { formats, FPS, type FormatId } from '../theme';
import { makeVideo, videoLength } from '../videos';
import { filipinoCopy } from './copy';
import { filipinoFeatures, filipinoStills, filipinoVideos } from './registry';

/** Every Filipino composition renders inside the Filipino UI strings (CTA, end card, carousel). */
function fil(C: ComponentType) {
  return function Filipino() {
    return (
      <CopyProvider value={filipinoCopy}>
        <C />
      </CopyProvider>
    );
  };
}

const FEATURE_STILLS: FormatId[] = ['story', 'portrait', 'square', 'landscape'];
const FEATURE_VIDEOS: FormatId[] = ['story', 'landscape'];
const FEATURE_HOOKS: FormatId[] = ['story', 'portrait', 'square'];

/**
 * Filipino set. Ids carry a `fil-` prefix; scripts/render.mjs writes them to out/filipino/.
 */
export function FilipinoFolder() {
  return (
    <Folder name="filipino">
      {filipinoStills.map(([id, C, fmts]) => (
        <Folder key={id} name={`fil${id}`}>
          {fmts.map((fid) => {
            const fmt = formats[fid];
            return (
              <Still
                key={fid}
                id={`still-fil-${id}-${fid}`}
                component={fil(() => (
                  <C format={fmt} />
                ))}
                width={fmt.width}
                height={fmt.height}
              />
            );
          })}
        </Folder>
      ))}
      {filipinoVideos.flatMap(([id, C, fmts, body]) =>
        fmts.map((fid) => {
          const fmt = formats[fid];
          return (
            <Composition
              key={`${id}-${fid}`}
              id={`video-fil-${id}-${fid}`}
              component={fil(makeVideo(C, fmt, body))}
              durationInFrames={videoLength(body)}
              fps={FPS}
              width={fmt.width}
              height={fmt.height}
            />
          );
        })
      )}
      {filipinoFeatures.map(({ spec, Concept, Hook, Slide, Reel }) => (
        <Folder key={spec.slug} name={`filf${spec.slug}`}>
          {FEATURE_STILLS.map((fid) => {
            const fmt = formats[fid];
            return (
              <Still
                key={fid}
                id={`still-fil-feature-${spec.slug}-${fid}`}
                component={fil(() => (
                  <Concept format={fmt} />
                ))}
                width={fmt.width}
                height={fmt.height}
              />
            );
          })}
          {FEATURE_HOOKS.map((fid) => {
            const fmt = formats[fid];
            return (
              <Still
                key={`h-${fid}`}
                id={`still-fil-fhook-${spec.slug}-${fid}`}
                component={fil(() => (
                  <Hook format={fmt} />
                ))}
                width={fmt.width}
                height={fmt.height}
              />
            );
          })}
          {Array.from({ length: KIT_SLIDES }, (_, i) => (
            <Still
              key={`s-${i}`}
              id={`still-fil-fsteps-${spec.slug}-${i + 1}`}
              component={fil(() => (
                <Slide index={i} format={formats.portrait} />
              ))}
              width={1080}
              height={1350}
            />
          ))}
          <Composition
            id={`video-fil-freel-${spec.slug}-story`}
            component={fil(makeVideo(Reel, formats.story, HOOK_FRAMES + spec.video))}
            durationInFrames={videoLength(HOOK_FRAMES + spec.video)}
            fps={FPS}
            width={1080}
            height={1920}
          />
          {FEATURE_VIDEOS.map((fid) => {
            const fmt = formats[fid];
            return (
              <Composition
                key={`v-${fid}`}
                id={`video-fil-feature-${spec.slug}-${fid}`}
                component={fil(makeVideo(Concept, fmt, spec.video))}
                durationInFrames={videoLength(spec.video)}
                fps={FPS}
                width={fmt.width}
                height={fmt.height}
              />
            );
          })}
        </Folder>
      ))}
    </Folder>
  );
}
