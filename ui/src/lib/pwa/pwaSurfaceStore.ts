import { create } from 'zustand';

/**
 * One floating PWA surface at a time.
 *
 * Stacking an install offer on top of an update prompt on top of the offline
 * banner is how a "helpful" PWA becomes noise. Every surface claims a slot; only
 * the highest-priority claimant renders. Non-floating chrome (the layout-integrated
 * offline strip) does not go through here.
 *
 * Priorities follow the plan (§2D): kill notice > forced update > offline banner >
 * update prompt > push soft-ask > install offer.
 */
export type PwaSurface = 'kill' | 'force-update' | 'offline' | 'update' | 'push' | 'install';

export const PWA_SURFACE_PRIORITY: Record<PwaSurface, number> = {
  kill: 50,
  'force-update': 40,
  offline: 30,
  update: 20,
  push: 10,
  install: 0,
};

type PwaSurfaceState = {
  claimed: Record<PwaSurface, boolean>;
  claim: (surface: PwaSurface) => void;
  release: (surface: PwaSurface) => void;
};

export const usePwaSurfaceStore = create<PwaSurfaceState>((set) => ({
  claimed: { kill: false, 'force-update': false, offline: false, update: false, push: false, install: false },
  claim: (surface) =>
    set((state) =>
      state.claimed[surface] ? state : { ...state, claimed: { ...state.claimed, [surface]: true } }
    ),
  release: (surface) =>
    set((state) =>
      state.claimed[surface] ? { ...state, claimed: { ...state.claimed, [surface]: false } } : state
    ),
}));

/** Highest-priority claimed surface, or `null` when nothing wants to show. */
export function activePwaSurface(claimed: Record<PwaSurface, boolean>): PwaSurface | null {
  let winner: PwaSurface | null = null;
  let best = -1;
  for (const [surface, isClaimed] of Object.entries(claimed) as Array<[PwaSurface, boolean]>) {
    if (!isClaimed) continue;
    const priority = PWA_SURFACE_PRIORITY[surface];
    if (priority > best) {
      best = priority;
      winner = surface;
    }
  }
  return winner;
}
