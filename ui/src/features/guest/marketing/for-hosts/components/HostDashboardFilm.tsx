import { Fragment } from 'react';

import { TransitionSeries, linearTiming, type TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { AbsoluteFill, Audio, Easing, Sequence, useVideoConfig } from 'remotion';

import { SceneDurationContext } from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { filmScenes } from '@/features/guest/marketing/for-hosts/components/film/scenes/filmScenes';
import {
  HOST_TOUR_NARRATION_START_DELAY,
  hostTourChapters,
  type HostTourTransitionType,
} from '@/features/guest/marketing/for-hosts/data/hostTourChapters';

/** Each presentation carries its own props type, so the element is built per case. */
function transitionElement(type: HostTourTransitionType, durationInFrames: number) {
  // Eased timing so slides accelerate/decelerate instead of starting and stopping abruptly.
  const timing = linearTiming({ durationInFrames, easing: Easing.inOut(Easing.cubic) });
  const build = <T extends Record<string, unknown>>(presentation: TransitionPresentation<T>) => (
    <TransitionSeries.Transition presentation={presentation} timing={timing} />
  );
  switch (type) {
    case 'push':
      return build(slide({ direction: 'from-right' }));
    case 'slide':
      return build(slide({ direction: 'from-bottom' }));
    case 'dissolve':
    default:
      // CSS-only cross-fade — `dissolve` needs Chrome's HTML-in-Canvas API and crashes elsewhere.
      return build(fade());
  }
}

export interface HostDashboardFilmProps {
  narrationMuted: boolean;
}

export function HostDashboardFilm({ narrationMuted }: HostDashboardFilmProps) {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill className="bg-[#f4f7f8] dark:bg-slate-950">
      <TransitionSeries>
        {hostTourChapters.map((chapter, index) => {
          const Scene = filmScenes[index] ?? filmScenes[0];
          return (
            <Fragment key={chapter.id}>
              {index > 0 && chapter.transitionInFrames > 0
                ? transitionElement(chapter.transitionType, chapter.transitionInFrames)
                : null}
              <TransitionSeries.Sequence
                durationInFrames={chapter.durationInFrames}
                premountFor={fps}
              >
                {/* Delay the voice line until the incoming transition has finished and the
                    previous chapter's line has ended — no two feature voices overlap. */}
                <Sequence from={HOST_TOUR_NARRATION_START_DELAY}>
                  <Audio src={chapter.audioSrc} muted={narrationMuted} />
                </Sequence>
                <SceneDurationContext.Provider value={chapter.durationInFrames}>
                  <Scene />
                </SceneDurationContext.Provider>
              </TransitionSeries.Sequence>
            </Fragment>
          );
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
