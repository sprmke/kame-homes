import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('voice PCM worklet contract', () => {
  it('coalesces 32 ms PCM16 packets before transfer', () => {
    const source = readFileSync(
      new URL('../../../../../public/worklets/voice-pcm-recorder.js', import.meta.url),
      'utf8'
    );
    expect(source).toContain('this.chunkSize = 512');
    expect(source).toContain('new Int16Array(this.chunkSize)');
    expect(source).toContain('{ pcm: chunk, rms:');
    expect(source).toContain('[chunk.buffer]');
  });
});
