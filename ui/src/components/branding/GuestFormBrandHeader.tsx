const DEFAULT_TITLE = 'Guest Advise Form';
const DEFAULT_LOGO_SRC = '/images/logo.png';

export interface GuestFormBrandHeaderProps {
  /** Main heading below the logo. Guest form uses the default. */
  title?: string;
  /** Org/property logo from get-guest-payment-info. */
  logoSrc: string;
  /** Accessible label for the logo image. */
  logoAlt: string;
  /** Property line above the title, e.g. tower · residence. */
  eyebrow?: string | null;
}

/**
 * Property-branded logo (overlapping card top) + eyebrow + title.
 * Ancestor must use `position: relative`.
 */
export function GuestFormBrandHeader({
  title = DEFAULT_TITLE,
  logoSrc,
  logoAlt,
  eyebrow,
}: GuestFormBrandHeaderProps) {
  const logoUrl = logoSrc?.trim() || DEFAULT_LOGO_SRC;
  const eyebrowText = eyebrow?.trim();

  return (
    <div className="space-y-6 pt-10 md:pt-14">
      <div className="absolute left-0 right-0 top-[-3.25rem] mx-auto flex justify-center md:top-[-4.25rem]">
        <div className="bg-card shadow-elevated ring-card rounded-full p-1 ring-4">
          <img
            src={logoUrl}
            alt={logoAlt?.trim() || 'Property'}
            className="h-[88px] w-[88px] rounded-full object-cover md:h-[120px] md:w-[120px]"
          />
        </div>
      </div>
      <div className="text-center">
        {eyebrowText ? <p className="section-eyebrow mb-2">{eyebrowText}</p> : null}
        <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
          {title}
        </h2>
      </div>
    </div>
  );
}
