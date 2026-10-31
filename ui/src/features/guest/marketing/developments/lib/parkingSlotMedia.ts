import type { ParkingSlot, ParkingType } from '@/features/guest/marketing/developments/types';

const PARKING_IMAGES: Record<ParkingType, string[]> = {
  inside_tower: [
    'https://images.unsplash.com/photo-1590674899484-f5649e4292cf?w=800&q=80',
    'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  ],
  outside_tower: [
    'https://images.unsplash.com/photo-1621939514649-280e2ee02510?w=800&q=80',
    'https://images.unsplash.com/photo-1568605117037-7b3c22336e38?w=800&q=80',
    'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80',
  ],
  motorcycle: [
    'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&q=80',
    'https://images.unsplash.com/photo-1609630875171-b132137945cc?w=800&q=80',
  ],
};

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function resolveParkingSlotImage(slot: ParkingSlot): string {
  const explicit = slot.imageUrl?.trim();
  if (explicit) return explicit;

  const pool = PARKING_IMAGES[slot.type];
  return pool[hashId(slot.id) % pool.length] ?? pool[0] ?? '';
}
