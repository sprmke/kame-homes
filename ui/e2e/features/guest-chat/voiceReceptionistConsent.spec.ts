import { expect, test } from '@playwright/test';

import { seedSupabaseAuthSession } from '../../shared/authSeam';
import { E2E_GUEST_USER_ID } from '../../shared/ids';

import type { Page, Route } from '@playwright/test';

async function fulfillJson(route: Route, data: Record<string, unknown>) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

async function installVoiceReceptionistMocks(
  page: Page,
  options: {
    liveSession?: boolean;
    providerUnavailable?: boolean;
    maxSessionSeconds?: number;
  } = {}
) {
  await seedSupabaseAuthSession(page, 'guest');
  await page.addInitScript(() => {
    window.localStorage.removeItem('guest-voice-receptionist-consent-v1');
  });

  await page.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: E2E_GUEST_USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'guest@example.com',
        app_metadata: { provider: 'google', providers: ['google'] },
        user_metadata: { full_name: 'E2E Guest' },
      }),
    });
  });

  await page.route('**/functions/v1/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname.split('/').pop();
    if (endpoint === 'guest-web-chat-start') {
      await fulfillJson(route, {
        conversationId: '00000000-0000-4000-8000-000000000121',
        property: { id: '00000000-0000-4000-8000-000000000122', slug: 'solea', name: 'Solea' },
        host: {
          organizationName: 'Kame Homes',
          ownerName: 'Host',
          ownerAvatarUrl: null,
        },
        voiceReceptionistEnabled: true,
        stayGuideUrl: null,
      });
      return;
    }
    if (endpoint === 'guest-web-chat-messages') {
      await fulfillJson(route, { messages: [], hasMore: false, replyStatus: 'idle' });
      return;
    }
    if (options.providerUnavailable && endpoint === 'voice-receptionist-start') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Voice receptionist is temporarily unavailable.',
        }),
      });
      return;
    }
    if (options.liveSession && endpoint === 'voice-receptionist-start') {
      await fulfillJson(route, {
        sessionId: '00000000-0000-4000-8000-000000000123',
        ephemeralToken: 'mock-token',
        model: 'gemini-3.8-live',
        voiceId: 'Kore',
        maxSessionSeconds: options.maxSessionSeconds ?? 540,
        protocolVersion: 'gemini-live-v1beta-2026-09',
        webSocketBaseUrl:
          'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained',
        clientSetup: { model: 'models/gemini-3.8-live' },
        lockedSessionConfig: true,
      });
      return;
    }
    if (options.liveSession && endpoint === 'voice-receptionist-session') {
      await fulfillJson(route, { updated: true });
      return;
    }
    if (options.liveSession && endpoint === 'voice-receptionist-tool') {
      await fulfillJson(route, {
        toolName: 'get_property_facts',
        spokenText: 'The pool closes at 9 PM.',
        actions: [
          { type: 'open_property', label: 'Open property', url: '/properties/solea' },
          { type: 'open_property', label: 'Unsafe', url: 'https://example.com' },
        ],
      });
      return;
    }
    if (options.liveSession && endpoint === 'voice-receptionist-end') {
      await fulfillJson(route, {
        endedAt: '2026-09-23T00:00:00.000Z',
        durationSeconds: 1,
        transitioned: true,
      });
      return;
    }
    await route.continue();
  });
}

async function installLiveBrowserMocks(page: Page) {
  await page.addInitScript(() => {
    const track = {
      addEventListener: () => undefined,
      stop: () => undefined,
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.resolve({ getTracks: () => [track] }) },
    });

    class MockAudioContext {
      state = 'running';
      audioWorklet = { addModule: () => Promise.resolve() };
      createMediaStreamSource() {
        return { connect: () => undefined, disconnect: () => undefined };
      }
      close() {
        return Promise.resolve();
      }
    }
    class MockAudioWorkletNode {
      port = { onmessage: null, close: () => undefined };
      connect() {}
      disconnect() {}
    }

    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      static voiceInstanceCount = 0;
      readyState = MockWebSocket.CONNECTING;
      instanceNumber: number;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      listeners = new Map<string, Array<(event: Event) => void>>();

      constructor(url: string) {
        const isVoice = url.includes('generativelanguage.googleapis.com');
        if (isVoice) MockWebSocket.voiceInstanceCount += 1;
        this.instanceNumber = isVoice ? MockWebSocket.voiceInstanceCount : 0;
        if (isVoice) {
          document.documentElement.dataset.mockVoiceConnections = String(
            MockWebSocket.voiceInstanceCount
          );
        }
        window.setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          const event = new Event('open');
          this.onopen?.(event);
          for (const listener of this.listeners.get('open') ?? []) listener(event);
        }, 0);
      }

      addEventListener(type: string, listener: (event: Event) => void) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }

      send(raw: string) {
        const message = JSON.parse(raw) as Record<string, unknown>;
        if (message.setup) {
          window.setTimeout(() => {
            this.onmessage?.(
              new MessageEvent('message', { data: JSON.stringify({ setupComplete: {} }) })
            );
          }, 0);
        }
        const realtimeInput = message.realtimeInput as { text?: string } | undefined;
        if (realtimeInput?.text) {
          window.setTimeout(() => {
            this.onmessage?.(
              new MessageEvent('message', {
                data: JSON.stringify({
                  serverContent: {
                    outputTranscription: { text: 'How can I help with your stay?' },
                    turnComplete: true,
                  },
                }),
              })
            );
            this.onmessage?.(
              new MessageEvent('message', {
                data: JSON.stringify({
                  toolCall: {
                    functionCalls: [
                      { id: 'tool-1', name: 'get_property_facts', args: { topic: 'pool' } },
                    ],
                  },
                }),
              })
            );
            if (this.instanceNumber === 1) {
              this.onmessage?.(
                new MessageEvent('message', {
                  data: JSON.stringify({ serverContent: { interrupted: true } }),
                })
              );
              this.onmessage?.(
                new MessageEvent('message', {
                  data: JSON.stringify({
                    sessionResumptionUpdate: { newHandle: 'resume-1', resumable: true },
                  }),
                })
              );
              this.onmessage?.(
                new MessageEvent('message', {
                  data: JSON.stringify({ goAway: { timeLeft: '5s' } }),
                })
              );
            }
          }, 10);
        }
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
      }
    }

    Object.defineProperty(window, 'AudioContext', { configurable: true, value: MockAudioContext });
    Object.defineProperty(window, 'AudioWorkletNode', {
      configurable: true,
      value: MockAudioWorkletNode,
    });
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: MockWebSocket });
  });
}

test.describe('@smoke @ci voice receptionist consent', () => {
  test('requires disclosure acceptance before requesting microphone access', async ({ page }) => {
    await installVoiceReceptionistMocks(page);
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByText('Talk to receptionist', { exact: true }).click();

    await expect(page.getByRole('heading', { name: 'AI voice receptionist' })).toBeVisible();
    await expect(page.getByText(/Uses your microphone and Google Gemini/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start call' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'End call' })).toHaveCount(0);
    const startCallBox = await page.getByRole('button', { name: 'Start call' }).boundingBox();
    expect(startCallBox?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth)
    );
    const viewport = page.viewportSize();
    if (viewport && viewport.height > viewport.width) {
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      await expect(page.getByRole('button', { name: 'Start call' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        await page.evaluate(() => document.documentElement.clientWidth)
      );
    }
  });

  test('recovers from denied microphone access with text handoff', async ({ page }) => {
    await installVoiceReceptionistMocks(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () =>
            Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
        },
      });
    });
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByText('Talk to receptionist', { exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();

    await expect(page.getByRole('alert')).toContainText('Microphone access is blocked');
    await expect(page.getByRole('button', { name: 'Message host' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('shows streaming captions and safe server action cards', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByText('Talk to receptionist', { exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();

    await expect(page.getByText('How can I help with your stay?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open property' })).toHaveAttribute(
      'href',
      '/properties/solea'
    );
    await expect(page.getByRole('link', { name: 'Unsafe' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'End call' })).toBeVisible();
    await expect
      .poll(() => page.locator('html').getAttribute('data-mock-voice-connections'))
      .toBe('2');
    await expect(page.getByText('How can I help with your stay?')).toBeVisible();
    await page.getByRole('button', { name: 'Message host' }).click();
    await expect(page.getByRole('heading', { name: 'AI voice receptionist' })).toHaveCount(0);
  });

  test('falls back to text when the provider is unavailable', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { providerUnavailable: true });
    await installLiveBrowserMocks(page);
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByText('Talk to receptionist', { exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();

    await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
    await expect(page.getByRole('button', { name: 'Message host' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('ends cleanly at the server session limit', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true, maxSessionSeconds: 1 });
    await installLiveBrowserMocks(page);
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByText('Talk to receptionist', { exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();

    await expect(page.getByText('Call ended')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  });

  test('ends an inactive call without losing its captions', async ({ page }) => {
    await installVoiceReceptionistMocks(page, { liveSession: true });
    await installLiveBrowserMocks(page);
    await page.goto('/properties/solea/messages?checkInDate=2026-10-01&checkOutDate=2026-10-03');

    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByText('Talk to receptionist', { exact: true }).click();
    await page.getByRole('button', { name: 'Start call' }).click();
    await expect(page.getByText('How can I help with your stay?')).toBeVisible();
    await expect
      .poll(() => page.locator('html').getAttribute('data-mock-voice-connections'))
      .toBe('2');

    await page.clock.install();
    await page.clock.fastForward(46_000);

    await expect(page.getByText('Ended the call due to inactivity.')).toBeVisible();
    await expect(page.getByText('How can I help with your stay?')).toBeVisible();
  });
});
