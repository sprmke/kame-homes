import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';

type Props = {
  development?: { name: string; href: string } | null;
  /** Tower, floor, level — rendered as middot-separated text. */
  placementLabels?: string[];
  geoLocation?: string | null;
  motionDelay?: number;
};

function MetaDot() {
  return (
    <span className="text-muted-foreground/60 mx-1.5" aria-hidden>
      ·
    </span>
  );
}

export function ListingPlaceMeta({
  development,
  placementLabels = [],
  geoLocation,
  motionDelay = 0.1,
}: Props) {
  const placement = placementLabels.filter(Boolean);
  const geo = geoLocation?.trim() || null;
  const hasContent = development || placement.length > 0 || geo;
  if (!hasContent) return null;

  const showDotAfterDevelopment = Boolean(development && (placement.length > 0 || geo));
  const showDotBeforeGeo = Boolean(geo && (development || placement.length > 0));

  return (
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: motionDelay }}
      className="text-muted-foreground text-sm leading-snug"
    >
      {development ? (
        <>
          <Link
            to={development.href}
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            {development.name}
          </Link>
          {showDotAfterDevelopment ? <MetaDot /> : null}
        </>
      ) : null}

      {placement.map((label, index) => (
        <span key={`${label}-${index}`}>
          {index > 0 ? <MetaDot /> : null}
          {label}
        </span>
      ))}

      {geo ? (
        <>
          {showDotBeforeGeo ? <MetaDot /> : null}
          <span className="inline-flex items-center gap-1">{geo}</span>
        </>
      ) : null}
    </motion.p>
  );
}
