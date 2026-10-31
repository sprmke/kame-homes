/**
 * Capture `?linkStay=` into sessionStorage on marketplace browse/search/form entry
 * so Reserve → form can auto-select the property stay without polluting every listing URL.
 */

import { useEffect } from 'react';

import { useSearchParams } from 'react-router-dom';

import { captureParkingLinkStayFromSearch } from '@/features/guest/marketing/parkings/lib/parkingLinkStay';

export function useCaptureParkingLinkStay(): void {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    captureParkingLinkStayFromSearch(searchParams);
  }, [searchParams]);
}
