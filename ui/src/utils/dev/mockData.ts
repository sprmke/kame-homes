import dayjs from 'dayjs';

import {
  requiresValidId,
  computeGuestCounts,
  DEFAULT_GUEST_AGE,
  FIFTH_PARTY_GUEST_MAX_AGE,
} from '@/features/guest/form/lib/guestCounts';
import { type GuestFormData } from '@/features/guest/form/schemas/guestFormSchema';

const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 'Juan'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
const cities = [
  'San Fernando',
  'Angeles',
  'Mabalacat',
  'Manila',
  'Quezon',
  'Makati',
  'Pasig',
  'Taguig',
];
const provinces = [
  'Pampanga',
  'Metro Manila',
  'Bulacan',
  'Bataan',
  'Zambales',
  'Cavite',
  'Laguna',
  'Batangas',
];
const findUsSources = ['Facebook', 'Airbnb', 'Tiktok', 'Instagram', 'Friend', 'Others'];
const carBrands = [
  'Toyota Vios',
  'Honda Civic',
  'Ford Ranger',
  'Mitsubishi Xpander',
  'Nissan Navara',
];
const carColors = ['Black', 'White', 'Silver', 'Red', 'Blue', 'Gray'];
const petNames = [
  'Buddy',
  'Max',
  'Luna',
  'Bella',
  'Charlie',
  'Lucy',
  'Milo',
  'Daisy',
  'Rocky',
  'Buddy',
];
const petBreeds = [
  'Labrador',
  'Golden Retriever',
  'German Shepherd',
  'Bulldog',
  'Poodle',
  'Persian Cat',
  'Siamese Cat',
  'Maine Coon',
];
const petAges = [
  '1 year old',
  '2 years old',
  '3 years old',
  '4 years old',
  '5 years old',
  '6 months old',
  '8 months old',
];
const petTypes = ['Dog', 'Cat'];
const requests = [
  'Early check-in if possible',
  'Late check-out needed',
  'Extra towels please',
  'Ground floor preferred',
  'Quiet room requested',
  'Need extra pillows',
  'Prefer higher floor',
  'No pets allowed',
  'No smoking allowed',
  'No parties allowed',
  'No loud music allowed',
  'No late check-out',
  'No early check-in',
  'No pets allowed',
];

const randomElement = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const randomNumber = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1) + min);

// Generate a valid name with at least 2 words, each word >= 2 characters
const generateRandomName = () => {
  const firstName = randomElement(firstNames);
  const middleInitial = randomElement(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  const lastName = randomElement(lastNames);
  return `${firstName} ${middleInitial}. ${lastName}`;
};

// Generate a valid plate number format
const generateRandomPlate = () => {
  const letters = randomElement([
    'ABC',
    'XYZ',
    'DEF',
    'GHI',
    'JKL',
    'MNO',
    'PQR',
    'STU',
    'VWX',
    'YZA',
  ]);
  const numbers = randomNumber(100, 999);
  return `${letters} ${numbers}`;
};

// Generate a valid phone number starting with 09
const generateRandomPhoneNumber = () => {
  return `09${randomNumber(100000000, 999999999)}`;
};

// Generate a valid address in "City, Province" format
const generateRandomAddress = () => {
  return `${randomElement(cities)}, ${randomElement(provinces)}`;
};

const generateDummyImage = (prefix: string): string => {
  const canvas = document.createElement('canvas');
  const width = 800;
  const height = 600;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Generate a random color based on the prefix
  const hue = prefix.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
  ctx.fillStyle = `hsl(${hue}, 50%, 70%)`;
  ctx.fillRect(0, 0, width, height);

  // Add text
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const text = prefix.replace(/([A-Z])/g, ' $1').trim();
  const formattedDateTime = dayjs().format('YYYY-MM-DD HH:mm:ss');

  ctx.fillText(text, width / 2, height / 2 - 30);
  ctx.font = '20px Arial';
  ctx.fillText(formattedDateTime, width / 2, height / 2 + 30);

  return canvas.toDataURL('image/jpeg', 0.8);
};

const generateDummyFile = async (prefix: string): Promise<File> => {
  const dataUrl = generateDummyImage(prefix);
  const filename = `${prefix.toLowerCase()}_${dayjs().valueOf()}.jpg`;

  // Convert data URL to blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  return new File([blob], filename, { type: 'image/jpeg' });
};

// Set dummy file in file input
export const setDummyFile = (
  fileInputRef: React.RefObject<HTMLInputElement | null>,
  file: File | null
) => {
  if (!fileInputRef.current || !file) return;

  // Create a DataTransfer object
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  // Set the files
  fileInputRef.current.files = dataTransfer.files;
};

export const generateRandomData = async (): Promise<GuestFormData> => {
  const fullName = generateRandomName();

  // Generate a date between today and next 30 days for check-in
  const today = dayjs();
  const checkIn = today.add(randomNumber(1, 30), 'day').format('YYYY-MM-DD');

  // Generate check-out date 1-7 days after check-in
  const checkOut = dayjs(checkIn).add(randomNumber(1, 7), 'day').format('YYYY-MM-DD');

  // Generate vaccination date between 1-12 months ago
  const lastVaccination = today.subtract(randomNumber(1, 12), 'month').format('YYYY-MM-DD');

  const guestCount = randomNumber(1, 5);
  const primaryGuestAge = DEFAULT_GUEST_AGE;
  const guest2Age = guestCount >= 2 ? DEFAULT_GUEST_AGE : undefined;
  const guest3Age = guestCount >= 3 ? DEFAULT_GUEST_AGE : undefined;
  const guest4Age = guestCount >= 4 ? DEFAULT_GUEST_AGE : undefined;
  const guest5Age = guestCount >= 5 ? FIFTH_PARTY_GUEST_MAX_AGE : undefined;
  const guest2Name = guestCount >= 2 ? generateRandomName() : undefined;
  const guest3Name = guestCount >= 3 ? generateRandomName() : undefined;
  const guest4Name = guestCount >= 4 ? generateRandomName() : undefined;
  const guest5Name = guestCount >= 5 ? generateRandomName() : undefined;

  const needParking = Math.random() > 0.5;
  const hasPets = Math.random() > 0.5;

  const validId = requiresValidId(primaryGuestAge) ? await generateDummyFile('ValidId') : undefined;
  const guest2ValidId =
    guest2Age != null && requiresValidId(guest2Age)
      ? await generateDummyFile('Guest2ValidId')
      : undefined;
  const guest3ValidId =
    guest3Age != null && requiresValidId(guest3Age)
      ? await generateDummyFile('Guest3ValidId')
      : undefined;
  const guest4ValidId =
    guest4Age != null && requiresValidId(guest4Age)
      ? await generateDummyFile('Guest4ValidId')
      : undefined;

  // Generate dummy files
  const paymentReceipt = await generateDummyFile('PaymentReceipt');
  const petVaccination = hasPets ? await generateDummyFile('PetVaccination') : undefined;
  const petImage = hasPets ? await generateDummyFile('PetImage') : undefined;

  // Calculate number of nights using dayjs
  const numberOfNights = dayjs(checkOut).diff(dayjs(checkIn), 'day');

  const findUs = randomElement(findUsSources);
  const findUsDetails =
    findUs === 'Friend'
      ? `${generateRandomName()} recommended your place`
      : findUs === 'Others'
        ? randomElement([
            'Google search',
            'Walk-in inquiry',
            'Property agent referral',
            'Local community group',
            'Travel blog recommendation',
            'Instagram ad',
            'Facebook Marketplace',
            'TikTok video',
            'YouTube vlog',
            'Real estate website',
            'Airbnb listing',
            'Travel agency',
            'Corporate booking',
            'Previous guest',
          ])
        : undefined;

  const guestCounts = computeGuestCounts([
    { name: fullName, age: primaryGuestAge },
    { name: guest2Name, age: guest2Age },
    { name: guest3Name, age: guest3Age },
    { name: guest4Name, age: guest4Age },
    { name: guest5Name, age: guest5Age },
  ]);

  return {
    guestFacebookName: fullName,
    primaryGuestName: fullName,
    primaryGuestAge,
    guestEmail: `${fullName.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
    guestPhoneNumber: generateRandomPhoneNumber(),
    guestAddress: generateRandomAddress(),
    checkInDate: checkIn,
    checkOutDate: checkOut,
    guest2Name,
    guest2Age,
    guest3Name,
    guest3Age,
    guest4Name,
    guest4Age,
    guest5Name,
    guest5Age,
    guestSpecialRequests: randomElement(requests),
    guestRequestsSurpriseDecor: Math.random() > 0.75,
    findUs,
    findUsDetails,
    needParking,
    parkingSameAsBookingDuration: true,
    carPlateNumber: needParking ? generateRandomPlate() : undefined,
    carBrandModel: needParking ? randomElement(carBrands) : undefined,
    carColor: needParking ? randomElement(carColors) : undefined,
    hasPets,
    petName: hasPets ? randomElement(petNames) : undefined,
    petBreed: hasPets ? randomElement(petBreeds) : undefined,
    petAge: hasPets ? randomElement(petAges) : undefined,
    petType: hasPets ? randomElement(petTypes) : undefined,
    petVaccinationDate: hasPets ? lastVaccination : undefined,
    petVaccination,
    petImage,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    nationality: 'Filipino',
    numberOfAdults: guestCounts.adults,
    numberOfChildren: guestCounts.children,
    numberOfNights,
    paymentReceipt,
    validId,
    guest2ValidId,
    guest3ValidId,
    guest4ValidId,
    unitOwner: 'Arianna Perez',
    towerAndUnitNumber: 'Monaco 2604',
    ownerOnsiteContactPerson: 'Arianna Perez',
    ownerContactNumber: '0962 541 2941',
  };
};
