// Distance utility functions and constants
// Trinidad & Tobago default: kilometers (km)

export type DistanceUnit = 'km' | 'mi';

// Conversion constants
const KM_PER_MILE = 1.60934;
const MILE_PER_KM = 0.621371;

// Convert km to miles
export const kmToMiles = (km: number): number => {
  return Math.round(km * MILE_PER_KM);
};

// Convert miles to km
export const milesToKm = (miles: number): number => {
  return Math.round(miles * KM_PER_MILE);
};

// Format distance with unit
export const formatDistance = (km: number, unit: DistanceUnit): string => {
  if (unit === 'mi') {
    return `${kmToMiles(km)} mi`;
  }
  return `${km} km`;
};

// Search distance options (stored in km)
// Displayed as: 5, 10, 15, 25, 40, 65 km OR ~3, 6, 9, 15, 25, 40 mi
export const SEARCH_DISTANCE_OPTIONS_KM = [
  { valueKm: 5, labelKm: '5 km', labelMi: '3 mi' },
  { valueKm: 10, labelKm: '10 km', labelMi: '6 mi' },
  { valueKm: 15, labelKm: '15 km', labelMi: '9 mi' },
  { valueKm: 25, labelKm: '25 km', labelMi: '15 mi' },
  { valueKm: 40, labelKm: '40 km', labelMi: '25 mi' },
  { valueKm: 65, labelKm: '65 km', labelMi: '40 mi' },
];

// Provider travel distance options (stored in km)
// Displayed as: 8, 16, 24, 40, 65 km OR ~5, 10, 15, 25, 40 mi
export const TRAVEL_DISTANCE_OPTIONS_KM = [
  { valueKm: 8, labelKm: '8 km', labelMi: '5 mi' },
  { valueKm: 16, labelKm: '16 km', labelMi: '10 mi' },
  { valueKm: 24, labelKm: '24 km', labelMi: '15 mi' },
  { valueKm: 40, labelKm: '40 km', labelMi: '25 mi' },
  { valueKm: 65, labelKm: '65 km', labelMi: '40 mi' },
];

// Get label for a distance option based on current unit
export const getDistanceLabel = (
  valueKm: number,
  unit: DistanceUnit,
  options: typeof SEARCH_DISTANCE_OPTIONS_KM
): string => {
  const option = options.find(opt => opt.valueKm === valueKm);
  if (!option) {
    // Fallback for custom values
    return unit === 'mi' ? `${kmToMiles(valueKm)} mi` : `${valueKm} km`;
  }
  return unit === 'mi' ? option.labelMi : option.labelKm;
};

// Default unit for Trinidad & Tobago
export const DEFAULT_DISTANCE_UNIT: DistanceUnit = 'km';

// Default distances
export const DEFAULT_SEARCH_DISTANCE_KM = 16; // ~10 miles
export const DEFAULT_TRAVEL_DISTANCE_KM = 16; // ~10 miles
