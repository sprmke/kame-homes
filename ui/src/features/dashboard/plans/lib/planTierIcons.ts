import {
  Circle,
  Crown,
  HeartHandshake,
  Percent,
  Sparkles,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Distinct icon per catalog plan code — used on summary cards and review dialogs. */
export const PLAN_TIER_ICONS: Record<string, LucideIcon> = {
  free: Circle,
  starter: Zap,
  growth: TrendingUp,
  pro: Sparkles,
  business_plus: Crown,
  managed: HeartHandshake,
  commission: Percent,
};

export function planTierIcon(planCode: string): LucideIcon {
  return PLAN_TIER_ICONS[planCode] ?? Circle;
}

export function planTierIconWellClass(planCode: string, muted = false): string {
  if (muted) return 'bg-muted text-muted-foreground';

  switch (planCode) {
    case 'free':
      return 'bg-muted text-muted-foreground';
    case 'starter':
      return 'bg-primary/10 text-brand-ink';
    case 'growth':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    case 'pro':
      return 'bg-violet-500/10 text-violet-600 dark:text-violet-400';
    case 'business_plus':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'managed':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
    case 'commission':
      return 'bg-orange-500/10 text-orange-600 dark:text-orange-400';
    default:
      return 'bg-primary/10 text-brand-ink';
  }
}

/** Sidebar / More-sheet plan card: faint tier wash + hairline border in the icon well's hue. */
export function planTierSurfaceClass(planCode: string): string {
  switch (planCode) {
    case 'free':
      return 'border-border/80 from-muted/70 to-transparent hover:border-border';
    case 'growth':
      return 'border-blue-500/20 from-blue-500/[0.07] to-transparent hover:border-blue-500/35';
    case 'pro':
      return 'border-violet-500/20 from-violet-500/[0.07] to-transparent hover:border-violet-500/35';
    case 'business_plus':
      return 'border-emerald-500/20 from-emerald-500/[0.07] to-transparent hover:border-emerald-500/35';
    case 'managed':
      return 'border-amber-500/25 from-amber-500/[0.08] to-transparent hover:border-amber-500/40';
    case 'commission':
      return 'border-orange-500/20 from-orange-500/[0.07] to-transparent hover:border-orange-500/35';
    default:
      return 'border-primary/20 from-primary/[0.07] to-transparent hover:border-primary/35';
  }
}
