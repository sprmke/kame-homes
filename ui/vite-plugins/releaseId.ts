/**
 * The one release id, resolved in the Node build context.
 *
 * Sentry groups errors by release, PostHog annotates events with `app_release`, and the
 * edge functions read the same value from the `APP_RELEASE` secret. If these diverge,
 * "which deploy introduced this?" stops being answerable, so every consumer reads this
 * function (or the secret set from the same git SHA) instead of inventing its own.
 *
 * Local builds resolve to `local` on purpose: there is no deploy to compare against, and
 * a fake id would create a Sentry release that no commit maps to.
 */

type EnvLike = Record<string, string | undefined>;

export function resolveReleaseId(env: EnvLike = process.env): string {
  const fromVercel = env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (fromVercel) return fromVercel;
  const fromGitHub = env.GITHUB_SHA?.trim();
  if (fromGitHub) return fromGitHub;
  return 'local';
}

/** True when the build has a real deploy identity, so release-tagged uploads make sense. */
export function hasDeployReleaseId(env: EnvLike = process.env): boolean {
  return resolveReleaseId(env) !== 'local';
}
