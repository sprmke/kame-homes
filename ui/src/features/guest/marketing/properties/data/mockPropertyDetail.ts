import type { Property } from '../components/PropertyCard';

export interface PropertyDetail extends Property {
  description: string | null;
  address: string;
  state: string | null;
  country: string;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  squareMeters: number | null;
  floors?: number;
  residenceName?: string | null;
  checkInTime: string;
  checkOutTime: string;
  pricing: {
    baseRate: number;
    currency: string;
    cleaningFee: number | null;
    securityDeposit: number | null;
    parkingRate: number | null;
    petFee: number | null;
  };
}

export const mockPropertyDetails: Record<string, PropertyDetail> = {
  '1': {
    id: '1',
    slug: 'sunset-beach-villa',
    name: 'Sunset Beach Villa',
    location: 'Boracay, Aklan',
    price: 8500,
    rating: 4.9,
    reviews: 127,
    images: [
      'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=1200&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80',
    ],
    type: 'VILLA',
    guests: 8,
    bedrooms: 4,
    bathrooms: 3,
    amenities: [
      'WiFi',
      'Air Conditioning',
      'TV',
      'Kitchen',
      'Refrigerator',
      'Microwave',
      'Coffee Maker',
      'Swimming Pool',
      'Free Parking',
      'Balcony',
      'Beach Access',
      'BBQ Grill',
      'Outdoor Dining',
      'Smoke Alarm',
      'First Aid Kit',
      '24/7 Security',
      'Washer',
      'Dryer',
    ],
    isSuperhost: true,
    description: `Welcome to our stunning beachfront villa in the heart of Boracay! This luxurious 4-bedroom retreat offers breathtaking sunset views, direct beach access, and all the amenities you need for an unforgettable vacation.

Located just steps from the famous White Beach, you'll enjoy the perfect blend of privacy and convenience. Wake up to the sound of waves, take a morning swim in your private pool, and end your day watching the spectacular Boracay sunset from your spacious balcony.

The villa features:
• 4 spacious bedrooms with premium bedding
• 3 modern bathrooms with rain showers
• Fully equipped gourmet kitchen
• Private swimming pool with sun deck
• Outdoor BBQ and dining area
• Direct beach access
• 24/7 security and concierge service

Perfect for families, groups of friends, or special celebrations. Our dedicated staff will ensure your stay is nothing short of extraordinary.`,
    address: '123 Beachfront Road, Station 1',
    state: 'Aklan',
    country: 'Philippines',
    zipCode: '5608',
    latitude: 11.9673,
    longitude: 121.9246,
    squareMeters: 350,
    checkInTime: '2:00 PM',
    checkOutTime: '11:00 AM',
    pricing: {
      baseRate: 8500,
      currency: 'PHP',
      cleaningFee: 500,
      securityDeposit: 5000,
      parkingRate: null,
      petFee: 1000,
    },
  },
  '2': {
    id: '2',
    slug: 'modern-makati-condo',
    name: 'Modern Makati Condo',
    location: 'Makati City, Metro Manila',
    price: 3200,
    rating: 4.8,
    reviews: 89,
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
    ],
    type: 'CONDO',
    guests: 4,
    bedrooms: 2,
    bathrooms: 2,
    amenities: [
      'WiFi',
      'Air Conditioning',
      'TV',
      'Kitchen',
      'Refrigerator',
      'Microwave',
      'Coffee Maker',
      'Gym/Fitness Center',
      'Free Parking',
      'Elevator',
      'Smoke Alarm',
      'First Aid Kit',
      'Washer',
      'Hair Dryer',
      'Iron',
    ],
    isNew: true,
    description: `Experience modern city living in the heart of Makati's Central Business District. This stylish 2-bedroom condo offers the perfect base for business travelers and urban explorers alike.

The unit features contemporary design with floor-to-ceiling windows offering stunning city views. Enjoy easy access to Greenbelt and Glorietta malls, world-class restaurants, and vibrant nightlife.

Highlights:
• Modern, fully-furnished interiors
• High-speed fiber WiFi
• Fully equipped kitchen
• Access to building amenities (gym, pool, function rooms)
• Secured parking slot
• 24/7 building security`,
    address: 'Unit 2501, Tower A, Greenbelt Residences',
    state: 'Metro Manila',
    country: 'Philippines',
    zipCode: '1227',
    latitude: 14.5547,
    longitude: 121.0244,
    squareMeters: 85,
    floors: 25,
    checkInTime: '3:00 PM',
    checkOutTime: '12:00 PM',
    pricing: {
      baseRate: 3200,
      currency: 'PHP',
      cleaningFee: 300,
      securityDeposit: 3000,
      parkingRate: 300,
      petFee: null,
    },
  },
  '3': {
    id: '3',
    slug: 'tagaytay-hillside-retreat',
    name: 'Tagaytay Hillside Retreat',
    location: 'Tagaytay, Cavite',
    price: 5800,
    rating: 4.95,
    reviews: 203,
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200&q=80',
    ],
    type: 'HOUSE',
    guests: 6,
    bedrooms: 3,
    bathrooms: 2,
    amenities: [
      'WiFi',
      'Air Conditioning',
      'TV',
      'Kitchen',
      'Refrigerator',
      'Coffee Maker',
      'Free Parking',
      'Balcony',
      'Garden',
      'BBQ Grill',
      'Smoke Alarm',
      'Fire Extinguisher',
      'First Aid Kit',
      'Washer',
    ],
    isSuperhost: true,
    description: `Escape to this charming hillside retreat overlooking Taal Lake. Perfect for families seeking a peaceful getaway with cool weather and stunning views.

Wake up to the refreshing Tagaytay breeze and enjoy your morning coffee with panoramic views of Taal Volcano. Our cozy home offers:

• Spectacular Taal Lake views
• 3 comfortable bedrooms
• Spacious living and dining area
• Fully equipped kitchen
• Private garden with BBQ area
• Covered parking for 2 cars
• Just 10 minutes to Sky Ranch and Picnic Grove`,
    address: '45 Ridge Road, Barangay San Jose',
    state: 'Cavite',
    country: 'Philippines',
    zipCode: '4120',
    latitude: 14.1085,
    longitude: 120.9569,
    squareMeters: 180,
    checkInTime: '2:00 PM',
    checkOutTime: '11:00 AM',
    pricing: {
      baseRate: 5800,
      currency: 'PHP',
      cleaningFee: 400,
      securityDeposit: 3000,
      parkingRate: null,
      petFee: 500,
    },
  },
};

/** Look up property detail by numeric ID or slug */
export function getPropertyDetail(idOrSlug: string): PropertyDetail | null {
  // Try direct ID lookup first
  if (mockPropertyDetails[idOrSlug]) return mockPropertyDetails[idOrSlug];
  // Fall back to slug lookup
  return Object.values(mockPropertyDetails).find((p) => p.slug === idOrSlug) ?? null;
}
