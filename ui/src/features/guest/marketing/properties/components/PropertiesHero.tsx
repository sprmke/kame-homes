import { ListingHeroSearch } from '@/features/guest/marketing/shared/components/ListingHeroSearch';

export function PropertiesHero() {
  return (
    <section className="border-border bg-background border-b pt-[var(--public-nav-h)]">
      <div className="container mx-auto px-4 py-3 sm:px-6 md:py-5 lg:px-8 lg:py-6">
        <ListingHeroSearch />
      </div>
    </section>
  );
}
