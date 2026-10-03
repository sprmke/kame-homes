import type { ComponentType } from 'react';

import { Composition, Folder, Still } from 'remotion';

import { Carousel1, Carousel2, Carousel3, Carousel4, Carousel5 } from './stills/Carousel';
import {
  HeroStatement,
  InboxPoster,
  OvernightPoster,
  PricingPoster,
  ProfitPoster,
  ReplaceTheStack,
  StoryHero,
  SyncSquare,
  WorkflowPoster,
} from './stills/Posters';
import { FPS, size } from './theme';
import {
  FLOW_DURATION,
  FlowVideo,
  OVERNIGHT_DURATION,
  OvernightVideo,
  PROFIT_DURATION,
  ProfitVideo,
  REPLACE_DURATION,
  ReplaceVideo,
} from './videos/Videos';

type Format = keyof typeof size;

/** id → component + format. `render.mjs` reads ids from here via `remotion compositions`. */
const stills: [string, ComponentType, Format][] = [
  ['01-hero-statement', HeroStatement, 'portrait'],
  ['02-replace-the-stack', ReplaceTheStack, 'portrait'],
  ['03-workflow', WorkflowPoster, 'portrait'],
  ['04-overnight', OvernightPoster, 'portrait'],
  ['05-smart-pricing', PricingPoster, 'portrait'],
  ['06-real-profit', ProfitPoster, 'portrait'],
  ['07-airbnb-sync', SyncSquare, 'square'],
  ['08-inbox', InboxPoster, 'portrait'],
  ['09-story-hero', StoryHero, 'story'],
  ['10-carousel-1', Carousel1, 'portrait'],
  ['10-carousel-2', Carousel2, 'portrait'],
  ['10-carousel-3', Carousel3, 'portrait'],
  ['10-carousel-4', Carousel4, 'portrait'],
  ['10-carousel-5', Carousel5, 'portrait'],
];

const videos: [string, ComponentType, Format, number][] = [
  ['01-replace-the-stack', ReplaceVideo, 'story', REPLACE_DURATION],
  ['02-booking-flow', FlowVideo, 'story', FLOW_DURATION],
  ['03-overnight', OvernightVideo, 'portrait', OVERNIGHT_DURATION],
  ['04-real-profit', ProfitVideo, 'story', PROFIT_DURATION],
];

export function Root() {
  return (
    <>
      <Folder name="Stills">
        {stills.map(([id, C, f]) => (
          <Still key={id} id={`still-${id}`} component={C} {...size[f]} />
        ))}
      </Folder>
      <Folder name="Videos">
        {videos.map(([id, C, f, d]) => (
          <Composition key={id} id={`video-${id}`} component={C} durationInFrames={d} fps={FPS} {...size[f]} />
        ))}
      </Folder>
    </>
  );
}

