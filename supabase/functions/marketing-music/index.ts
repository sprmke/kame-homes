/**
 * marketing-music — Jamendo browse/search + cache audio to property-media for video export.
 * Auth: serveAuthenticated + marketing.* property-team RBAC.
 *
 * GET  ?q=&order=popularity_week&limit=20 — browse Jamendo (requires JAMENDO_CLIENT_ID)
 * POST JSON { action: 'import-jamendo', trackId } | { action: 'import-url', url }
 * POST multipart file= — upload own audio
 */

import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import {
  fetchJamendoTrackById,
  fetchJamendoTracks,
  JamendoApiError,
  readJamendoClientId,
} from '../_shared/jamendoMusic.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  extensionForAudioMime,
  fetchRemoteAudioBytes,
  uploadMarketingAudioBytes,
} from '../_shared/marketingMusicStorage.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

type ImportedMusic = {
  url: string;
  title?: string;
  artist?: string;
  source: 'jamendo' | 'upload' | 'url';
  trackId?: string;
};

serveAuthenticated('marketing-music', async (req) => {
  const sb = createServiceClient();
  const url = new URL(req.url);
  let propertyId: string;

  if (req.method === 'GET') {
    try {
      const scoped = await resolveScopedPropertyAccess(req, 'marketing:view');
      propertyId = scoped.property.id;
      await requirePropertyPermissionAndFeature(
        req,
        propertyId,
        'marketing:view',
        'marketingStudio'
      );
    } catch (err) {
      if (err instanceof Response) return err;
      throw err;
    }
  } else if (req.method === 'POST') {
    try {
      const scoped = await resolveScopedPropertyAccess(req, 'marketing.content:edit');
      propertyId = scoped.property.id;
      await requirePropertyPermissionAndFeature(
        req,
        propertyId,
        'marketing.content:edit',
        'marketingStudio'
      );
    } catch (err) {
      if (err instanceof Response) return err;
      throw err;
    }
  } else {
    return jsonError(req, 'Method not allowed', 405);
  }

  if (req.method === 'GET') {
    const clientId = readJamendoClientId();
    if (!clientId) {
      return jsonSuccess(req, { tracks: [], jamendoConfigured: false });
    }

    const search = url.searchParams.get('q')?.trim() || undefined;
    const orderParam = url.searchParams.get('order')?.trim();
    const order =
      orderParam === 'popularity_total' || orderParam === 'relevance'
        ? orderParam
        : 'popularity_week';
    const limit = Number(url.searchParams.get('limit') ?? 20);

    try {
      const tracks = await fetchJamendoTracks({
        clientId,
        search,
        order: search && order === 'popularity_week' ? 'relevance' : order,
        limit: Number.isFinite(limit) ? limit : 20,
      });
      return jsonSuccess(req, { tracks, jamendoConfigured: true });
    } catch (error) {
      if (error instanceof JamendoApiError) {
        const authFailure =
          error.code === 5 || /invalid client id|not authorized/i.test(error.message);
        if (authFailure) {
          return jsonSuccess(req, { tracks: [], jamendoConfigured: false });
        }
        return jsonError(req, error.message, 502);
      }
      const message = error instanceof Error ? error.message : 'Jamendo search failed';
      return jsonError(req, message, 502);
    }
  }

  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return jsonError(req, 'file is required', 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = file.type || 'audio/mpeg';
    const ext = extensionForAudioMime(mime, file.name);
    const requestedKey = formData.get('fileKey');
    const fileKey =
      typeof requestedKey === 'string' && requestedKey.trim()
        ? requestedKey.trim().replace(/[^a-zA-Z0-9_-]/g, '')
        : `upload-${crypto.randomUUID().slice(0, 12)}`;

    try {
      const publicUrl = await uploadMarketingAudioBytes(sb, propertyId, bytes, mime, ext, fileKey);
      const title = file.name.replace(/\.[^.]+$/, '').trim() || undefined;
      const payload: ImportedMusic = { url: publicUrl, title, source: 'upload' };
      return jsonSuccess(req, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      return jsonError(req, message, 400);
    }
  }

  const body = await readJsonBody(req);
  const action = typeof body.action === 'string' ? body.action.trim() : '';

  if (action === 'import-jamendo') {
    const trackId = typeof body.trackId === 'string' ? body.trackId.trim() : '';
    if (!trackId) return jsonError(req, 'trackId is required', 400);

    const clientId = readJamendoClientId();
    if (!clientId) return jsonError(req, 'Jamendo is not configured', 503);

    try {
      const track = await fetchJamendoTrackById(clientId, trackId);
      if (!track) return jsonError(req, 'Track not found', 404);

      // Jamendo download URLs reject server-side fetches; use the official file API (stream).
      const fileApiUrl = new URL('https://api.jamendo.com/v3.0/tracks/file/');
      fileApiUrl.searchParams.set('client_id', clientId);
      fileApiUrl.searchParams.set('id', trackId);
      fileApiUrl.searchParams.set('action', 'stream');
      fileApiUrl.searchParams.set('audioformat', 'mp32');

      let remote;
      try {
        remote = await fetchRemoteAudioBytes(fileApiUrl.toString());
      } catch {
        remote = await fetchRemoteAudioBytes(track.streamUrl);
      }

      const ext = extensionForAudioMime(remote.mime, remote.fileName);
      const publicUrl = await uploadMarketingAudioBytes(
        sb,
        propertyId,
        remote.bytes,
        remote.mime,
        ext,
        `jamendo-${track.id}`
      );

      const payload: ImportedMusic = {
        url: publicUrl,
        title: track.title,
        artist: track.artist,
        source: 'jamendo',
        trackId: track.id,
      };
      return jsonSuccess(req, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      return jsonError(req, message, 400);
    }
  }

  if (action === 'import-url') {
    const remoteUrl = typeof body.url === 'string' ? body.url.trim() : '';
    if (!remoteUrl) return jsonError(req, 'url is required', 400);

    try {
      const remote = await fetchRemoteAudioBytes(remoteUrl);
      const ext = extensionForAudioMime(remote.mime, remote.fileName);
      const fileKey = `url-${crypto.randomUUID().slice(0, 12)}`;
      const publicUrl = await uploadMarketingAudioBytes(
        sb,
        propertyId,
        remote.bytes,
        remote.mime,
        ext,
        fileKey
      );

      const payload: ImportedMusic = {
        url: publicUrl,
        title: remote.fileName?.replace(/\.[^.]+$/, '').trim() || undefined,
        source: 'url',
      };
      return jsonSuccess(req, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      return jsonError(req, message, 400);
    }
  }

  return jsonError(req, 'Unknown action', 400);
});
