import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  HOST_TOUR_CHAPTER_STARTS,
  HOST_TOUR_DURATION_IN_FRAMES,
  HOST_TOUR_FEATURE_COUNT,
  HOST_TOUR_FPS,
  HOST_TOUR_NARRATION_START_DELAY,
  hostTourChapterIndexAtFrame,
  hostTourChapters,
} from '@/features/guest/marketing/for-hosts/data/hostTourChapters';
import { hostTourNarration } from '@/features/guest/marketing/for-hosts/data/hostTourNarration';

const PUBLIC_DIR = join(__dirname, '../../../../../../public');

describe('host tour chapters', () => {
  it('has one chapter per narration line, in order', () => {
    expect(hostTourChapters.map((chapter) => chapter.id)).toEqual(
      hostTourNarration.map((line) => line.id)
    );
  });

  it('opens and closes on bookend title cards', () => {
    expect(hostTourChapters[0].bookend).toBe(true);
    expect(hostTourChapters.at(-1)?.bookend).toBe(true);
    expect(HOST_TOUR_FEATURE_COUNT).toBe(hostTourChapters.length - 2);
  });

  it('ships an MP3 for every chapter', () => {
    for (const chapter of hostTourChapters) {
      expect(existsSync(join(PUBLIC_DIR, chapter.audioSrc)), chapter.audioSrc).toBe(true);
    }
  });

  it('gives every voice line room to finish before the next chapter', () => {
    const manifest = JSON.parse(
      readFileSync(join(PUBLIC_DIR, 'marketing/for-hosts/narration/manifest.json'), 'utf8')
    ) as { id: string; seconds: number | null }[];
    for (const chapter of hostTourChapters) {
      const seconds = manifest.find((entry) => entry.id === chapter.id)?.seconds;
      expect(seconds, chapter.id).toBeTypeOf('number');
      const voiceEnd = HOST_TOUR_NARRATION_START_DELAY + Math.ceil((seconds ?? 0) * HOST_TOUR_FPS);
      // The next chapter's transition overlaps the last frames of this one.
      expect(voiceEnd, chapter.id).toBeLessThanOrEqual(chapter.durationInFrames - 20);
    }
  });

  it('keeps captions short and free of dash clause breaks', () => {
    for (const chapter of hostTourChapters) {
      expect(chapter.caption.split(' ').length, chapter.id).toBeLessThanOrEqual(6);
      for (const text of [chapter.caption, chapter.title, chapter.description, chapter.narration]) {
        expect(text, chapter.id).not.toMatch(/[–—]/);
      }
    }
  });

  it('maps frames back to the right chapter', () => {
    expect(hostTourChapterIndexAtFrame(0)).toBe(0);
    HOST_TOUR_CHAPTER_STARTS.forEach((start, index) => {
      expect(hostTourChapterIndexAtFrame(start)).toBe(index);
    });
    expect(hostTourChapterIndexAtFrame(HOST_TOUR_DURATION_IN_FRAMES - 1)).toBe(
      hostTourChapters.length - 1
    );
  });
});
