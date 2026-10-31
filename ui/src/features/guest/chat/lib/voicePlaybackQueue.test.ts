import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { int16ToBase64 } from './voiceAudioCodec';
import {
  VOICE_PLAYBACK_IDLE_GRACE_MS,
  VOICE_PLAYBACK_LEAD_IN_SECONDS,
  VOICE_PLAYBACK_SAMPLE_RATE,
  VoicePlaybackQueue,
} from './voicePlaybackQueue';

class FakeSource {
  buffer: { duration: number } | null = null;
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stopped = false;
  connect() {}
  disconnect() {}
  start(at: number) {
    this.startedAt = at;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeContext {
  static instances: FakeContext[] = [];
  currentTime = 0;
  state: AudioContextState = 'running';
  sources: FakeSource[] = [];
  destination = {};
  constructor() {
    FakeContext.instances.push(this);
  }
  createAnalyser() {
    return { fftSize: 0, connect() {}, disconnect() {}, getByteTimeDomainData() {} };
  }
  createBuffer(_channels: number, length: number, rate: number) {
    return { duration: length / rate, copyToChannel() {} };
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

/** 100 ms of PCM16 at the playback rate. */
const chunk = int16ToBase64(new Int16Array(VOICE_PLAYBACK_SAMPLE_RATE / 10));

function setup() {
  const onStart = vi.fn();
  const onIdle = vi.fn();
  const queue = new VoicePlaybackQueue(
    { onStart, onIdle },
    FakeContext as unknown as new () => AudioContext
  );
  return { queue, onStart, onIdle };
}

describe('VoicePlaybackQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeContext.instances = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules chunks back to back after a short lead-in', () => {
    const { queue, onStart } = setup();
    queue.enqueue(chunk);
    queue.enqueue(chunk);
    const [first, second] = FakeContext.instances[0]!.sources;

    expect(first!.startedAt).toBeCloseTo(VOICE_PLAYBACK_LEAD_IN_SECONDS);
    expect(second!.startedAt).toBeCloseTo(VOICE_PLAYBACK_LEAD_IN_SECONDS + 0.1);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('waits out network jitter before reporting idle', () => {
    const { queue, onStart, onIdle } = setup();
    queue.enqueue(chunk);
    FakeContext.instances[0]!.sources[0]!.onended?.();

    vi.advanceTimersByTime(VOICE_PLAYBACK_IDLE_GRACE_MS - 50);
    queue.enqueue(chunk);
    vi.advanceTimersByTime(VOICE_PLAYBACK_IDLE_GRACE_MS);
    expect(onIdle).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledTimes(1);

    FakeContext.instances[0]!.sources[1]!.onended?.();
    vi.advanceTimersByTime(VOICE_PLAYBACK_IDLE_GRACE_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(queue.isPlaying).toBe(false);
  });

  it('interrupt stops queued audio but keeps the unlocked context', () => {
    const { queue, onIdle } = setup();
    queue.unlock();
    queue.enqueue(chunk);
    queue.enqueue(chunk);
    queue.interrupt();

    const context = FakeContext.instances[0]!;
    expect(context.sources.every((source) => source.stopped)).toBe(true);
    expect(context.state).toBe('running');
    vi.advanceTimersByTime(VOICE_PLAYBACK_IDLE_GRACE_MS * 2);
    expect(onIdle).not.toHaveBeenCalled();

    queue.enqueue(chunk);
    expect(FakeContext.instances).toHaveLength(1);
  });
});
