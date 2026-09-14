import { useState, type ReactNode } from 'react';

import { Grid3X3, Share2 } from 'lucide-react';

import { GalleryLightbox } from '@/features/guest/marketing/shared/components/GalleryLightbox';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';
import { LISTING_PLACEHOLDER_PROPERTY } from '@/features/guest/marketing/shared/lib/mockListingImages';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  images: string[];
  listingName: string;
  /** Optional slot rendered next to Share (e.g. property save button). */
  actionSlot?: ReactNode;
  placeholderSrc?: string;
};

export function ListingGallery({
  images,
  listingName,
  actionSlot,
  placeholderSrc = LISTING_PLACEHOLDER_PROPERTY,
}: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const displayImages = images.length > 0 ? images : [placeholderSrc];
  const imageCount = displayImages.length;

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const GalleryImage = ({
    src,
    index,
    className,
    sizes = '50vw',
    showOverlay = false,
    overlayContent,
  }: {
    src: string;
    index: number;
    className?: string;
    sizes?: string;
    showOverlay?: boolean;
    overlayContent?: React.ReactNode;
  }) => (
    <div
      className={cn('group relative min-w-0 cursor-pointer overflow-hidden', className)}
      onClick={() => openLightbox(index)}
    >
      <Image
        src={src}
        alt={`${listingName} - ${index + 1}`}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-110"
        sizes={sizes}
        // Every layout's first tile (index 0) is the above-the-fold hero — load it
        // eagerly so it doesn't sit behind the gallery's own lazy-loading gate.
        priority={index === 0}
      />
      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
      {showOverlay && overlayContent}
    </div>
  );

  const galleryShellClass =
    'grid h-[280px] grid-cols-1 gap-2 overflow-hidden rounded-2xl @xl:h-[400px] @3xl:h-[500px]';

  const Layout1Image = () => (
    <div className={galleryShellClass}>
      <GalleryImage src={displayImages[0] ?? ''} index={0} sizes="100vw" />
    </div>
  );

  const Layout2Images = () => (
    <div className={cn(galleryShellClass, '@3xl:grid-cols-5')}>
      <GalleryImage
        src={displayImages[0] ?? ''}
        index={0}
        className="@3xl:col-span-3"
        sizes="(min-width: 768px) 60vw, 100vw"
      />
      <GalleryImage
        src={displayImages[1] ?? ''}
        index={1}
        className="@3xl:col-span-2 @3xl:block hidden"
      />
    </div>
  );

  const Layout3Images = () => (
    <div className={cn(galleryShellClass, '@3xl:grid-cols-2 @3xl:grid-rows-2')}>
      <GalleryImage
        src={displayImages[0] ?? ''}
        index={0}
        className="@3xl:row-span-2"
        sizes="(min-width: 768px) 50vw, 100vw"
      />
      <GalleryImage src={displayImages[1] ?? ''} index={1} className="@3xl:block hidden" />
      <GalleryImage src={displayImages[2] ?? ''} index={2} className="@3xl:block hidden" />
    </div>
  );

  const Layout4Images = () => (
    <div className={cn(galleryShellClass, '@3xl:grid-cols-3 @3xl:grid-rows-2')}>
      <GalleryImage
        src={displayImages[0] ?? ''}
        index={0}
        className="@3xl:col-span-2 @3xl:row-span-2"
        sizes="(min-width: 768px) 66vw, 100vw"
      />
      <GalleryImage src={displayImages[1] ?? ''} index={1} className="@3xl:block hidden" />
      <div className="@3xl:grid @3xl:grid-cols-2 hidden gap-2">
        <GalleryImage src={displayImages[2] ?? ''} index={2} />
        <GalleryImage src={displayImages[3] ?? ''} index={3} />
      </div>
    </div>
  );

  const Layout5PlusImages = () => (
    <div className={cn(galleryShellClass, '@3xl:grid-cols-4 @3xl:grid-rows-2')}>
      <GalleryImage
        src={displayImages[0] ?? ''}
        index={0}
        className="@3xl:col-span-2 @3xl:row-span-2"
        sizes="(min-width: 768px) 50vw, 100vw"
      />
      <GalleryImage src={displayImages[1] ?? ''} index={1} className="@3xl:block hidden" />
      <GalleryImage src={displayImages[2] ?? ''} index={2} className="@3xl:block hidden" />
      <GalleryImage src={displayImages[3] ?? ''} index={3} className="@3xl:block hidden" />
      <GalleryImage
        src={displayImages[4] ?? ''}
        index={4}
        className="@3xl:block hidden"
        showOverlay={imageCount > 5}
        overlayContent={
          imageCount > 5 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 transition-colors group-hover:bg-black/60">
              <Button
                variant="secondary"
                className="gap-2 rounded-full shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  openLightbox(0);
                }}
              >
                <Grid3X3 className="h-4 w-4" />+{imageCount - 5} more
              </Button>
            </div>
          )
        }
      />
    </div>
  );

  const renderGallery = () => {
    switch (imageCount) {
      case 1:
        return <Layout1Image />;
      case 2:
        return <Layout2Images />;
      case 3:
        return <Layout3Images />;
      case 4:
        return <Layout4Images />;
      default:
        return <Layout5PlusImages />;
    }
  };

  return (
    <>
      <div className="@container relative w-full min-w-0">
        <div className="@xl:right-4 @xl:top-4 absolute right-3 top-3 z-10 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="bg-background/90 hover:bg-background min-h-[44px] gap-2 rounded-full backdrop-blur-sm"
            onClick={() => {
              if (navigator.share) {
                void navigator.share({
                  title: listingName,
                  url: window.location.href,
                });
              }
            }}
          >
            <Share2 className="h-4 w-4" />
            <span className="@sm:inline hidden">Share</span>
          </Button>
          {actionSlot}
        </div>

        {renderGallery()}

        {imageCount > 1 ? (
          <Button
            variant="secondary"
            size="sm"
            className="bg-background/90 @xl:bottom-4 @xl:right-4 @3xl:hidden absolute bottom-3 right-3 min-h-[44px] gap-2 rounded-full backdrop-blur-sm"
            onClick={() => openLightbox(0)}
          >
            <Grid3X3 className="h-4 w-4" />
            {imageCount} photos
          </Button>
        ) : null}
      </div>

      <GalleryLightbox
        images={displayImages}
        altPrefix={listingName}
        open={lightboxOpen}
        index={currentIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setCurrentIndex}
      />
    </>
  );
}
