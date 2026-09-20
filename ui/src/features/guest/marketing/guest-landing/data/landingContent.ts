export const heroDestinations = [
  {
    id: 'boracay',
    label: 'Boracay',
    image: 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=1200&q=80',
  },
  {
    id: 'makati',
    label: 'Makati',
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80',
  },
  {
    id: 'tagaytay',
    label: 'Tagaytay',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
  },
  {
    id: 'palawan',
    label: 'Palawan',
    image: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1200&q=80',
  },
] as const;

export const stayCategories = [
  { id: 'beach', label: 'Beach', query: 'Boracay' },
  { id: 'city', label: 'City stays', query: 'Manila' },
  { id: 'mountain', label: 'Mountain', query: 'Baguio' },
  { id: 'family', label: 'Family', query: 'Tagaytay' },
  { id: 'luxury', label: 'Luxury', query: 'Palawan' },
  { id: 'condo', label: 'Condos', query: 'Makati' },
] as const;

export const featuredStays = [
  {
    id: '1',
    name: 'Sunset Beach Villa',
    location: 'Boracay',
    price: 8500,
    rating: 4.9,
    reviews: 127,
    image: 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800&q=80',
    guests: 8,
  },
  {
    id: '2',
    name: 'Modern Makati Condo',
    location: 'Makati',
    price: 3200,
    rating: 4.8,
    reviews: 89,
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
    guests: 4,
  },
  {
    id: '3',
    name: 'Tagaytay Hillside Retreat',
    location: 'Tagaytay',
    price: 5800,
    rating: 4.95,
    reviews: 203,
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    guests: 6,
  },
  {
    id: '4',
    name: 'Palawan Beachfront',
    location: 'El Nido',
    price: 12000,
    rating: 5.0,
    reviews: 56,
    image: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80',
    guests: 10,
  },
  {
    id: '5',
    name: 'Cebu Skyline Suite',
    location: 'Cebu',
    price: 4100,
    rating: 4.7,
    reviews: 64,
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
    guests: 3,
  },
  {
    id: '6',
    name: 'Baguio Pine Cabin',
    location: 'Baguio',
    price: 4500,
    rating: 4.85,
    reviews: 91,
    image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80',
    guests: 5,
  },
] as const;

export const editorialDestinations = [
  {
    id: 'boracay',
    name: 'Boracay',
    tagline: 'White sand & clear water',
    properties: 312,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
  },
  {
    id: 'manila',
    name: 'Metro Manila',
    tagline: 'City breaks & business stays',
    properties: 245,
    image: 'https://images.unsplash.com/photo-1573455494060-c5595004fb6c?w=1200&q=80',
  },
  {
    id: 'palawan',
    name: 'Palawan',
    tagline: 'Islands & hidden lagoons',
    properties: 167,
    image: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&q=80',
  },
] as const;

export const suggestedDestinations = [
  {
    id: 'nearby',
    label: 'Nearby',
    subtitle: "Find what's around you",
    icon: 'nearby' as const,
  },
  {
    id: 'manila',
    label: 'Manila, Philippines',
    subtitle: 'Capital region stays',
    icon: 'city' as const,
  },
  {
    id: 'boracay',
    label: 'Boracay, Aklan',
    subtitle: 'White sand beaches',
    icon: 'beach' as const,
  },
  {
    id: 'baguio',
    label: 'Baguio, Benguet',
    subtitle: 'Cool mountain retreats',
    icon: 'mountain' as const,
  },
  {
    id: 'cebu',
    label: 'Cebu City',
    subtitle: 'Island city breaks',
    icon: 'island' as const,
  },
  {
    id: 'palawan',
    label: 'Palawan',
    subtitle: 'Lagoons and island hops',
    icon: 'beach' as const,
  },
] as const;
