import { useEffect, useRef, useState } from 'react';

import EmblaCarousel, { type EmblaCarouselType, type EmblaOptionsType } from 'embla-carousel';

/**
 * Viewport hook for showcase carousels.
 * Calls Embla directly so hooks stay on this app's React. `embla-carousel-react`
 * reaches `useRef` through a CJS binding that is null in the page editor.
 */
export function useShowcaseEmbla(
  options: EmblaOptionsType
): [(node: HTMLElement | null) => void, EmblaCarouselType | undefined] {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const optionsKey = JSON.stringify(options);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [emblaApi, setEmblaApi] = useState<EmblaCarouselType>();

  useEffect(() => {
    if (!viewport) return;
    const api = EmblaCarousel(viewport, optionsRef.current);
    setEmblaApi(api);
    return () => {
      api.destroy();
      setEmblaApi(undefined);
    };
  }, [viewport, optionsKey]);

  return [setViewport, emblaApi];
}
