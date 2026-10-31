import { PropertySaveButton } from '@/features/guest/marketing/properties/components/PropertySaveButton';
import { ListingGallery } from '@/features/guest/marketing/shared/components/ListingGallery';

interface PropertyGalleryProps {
  images: string[];
  propertyName: string;
  propertySlug: string;
}

export function PropertyGallery({ images, propertyName, propertySlug }: PropertyGalleryProps) {
  return (
    <ListingGallery
      images={images}
      listingName={propertyName}
      actionSlot={<PropertySaveButton propertySlug={propertySlug} variant="pill" />}
    />
  );
}
