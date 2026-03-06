/**
 * Fixr Service Categories & Sub-Categories
 * SINGLE SOURCE OF TRUTH
 * 
 * Structure:
 * - serviceKey: API-safe identifier (snake_case)
 * - label: user-friendly display name
 * - icon: Ionicons icon name
 * - subcategories: array with subcategoryKey + label
 * - status: 'core' | 'beta' | 'coming_soon'
 * 
 * IMPORTANT: UI displays labels, API uses keys
 */

export interface SubCategory {
  subcategoryKey: string;
  label: string;
}

export interface ServiceCategory {
  serviceKey: string;
  label: string;
  icon: string;
  description: string;
  subcategories: SubCategory[];
  status: 'core' | 'beta' | 'coming_soon';
}

// Helper to convert label to key
const toKey = (label: string): string => 
  label.toLowerCase()
    .replace(/[&]/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// Helper to create subcategories with keys
const createSubs = (labels: string[]): SubCategory[] =>
  labels.map(label => ({
    subcategoryKey: toKey(label),
    label,
  }));

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  // ═══════════════════════════════════════════════════════════════
  // CORE HOME SERVICES
  // ═══════════════════════════════════════════════════════════════
  {
    serviceKey: 'electrical',
    label: 'Electrical',
    icon: 'flash',
    description: 'Electrical repairs, installations, and upgrades',
    status: 'core',
    subcategories: createSubs([
      'Outlet & Switch Repair',
      'Outlet & Switch Installation',
      'Lighting Installation',
      'Ceiling Fan Installation',
      'Panel Upgrade & Repair',
      'Wiring & Rewiring',
      'Electrical Inspection',
      'Generator Installation',
      'Generator Repair & Service',
      'Security Light Installation',
      'Landscape Lighting',
      'Circuit Breaker Repair',
      'Surge Protector Installation',
      'Electric Water Heater Repair',
      'Smoke Detector Installation',
      'EV Charger Installation',
      'Whole House Rewiring',
      'Commercial Electrical',
    ]),
  },
  {
    serviceKey: 'plumbing',
    label: 'Plumbing',
    icon: 'water',
    description: 'Plumbing repairs, installations, and maintenance',
    status: 'core',
    subcategories: createSubs([
      'Leak Repair',
      'Pipe Repair & Replacement',
      'Faucet Repair & Installation',
      'Toilet Repair & Installation',
      'Drain Cleaning & Unclogging',
      'Water Heater Repair',
      'Water Heater Installation',
      'Water Tank Installation',
      'Water Tank Cleaning',
      'Water Pump Repair',
      'Water Pump Installation',
      'Shower & Bath Installation',
      'Sink Installation',
      'Garbage Disposal Repair',
      'Sewer Line Repair',
      'Water Filtration System',
      'Pressure Pump Installation',
      'Bathroom Plumbing',
      'Kitchen Plumbing',
      'Emergency Plumbing',
      'Gas Line Installation',
      'Septic Tank Service',
    ]),
  },
  {
    serviceKey: 'ac_hvac',
    label: 'AC & Cooling',
    icon: 'snow',
    description: 'Air conditioning installation, repair, and maintenance',
    status: 'core',
    subcategories: createSubs([
      'AC Repair',
      'AC Installation',
      'AC Maintenance & Service',
      'AC Cleaning',
      'Mini-Split Installation',
      'Central AC Repair',
      'Central AC Installation',
      'AC Gas Recharge',
      'Thermostat Installation',
      'Duct Cleaning',
      'Duct Repair',
      'Ventilation Installation',
      'Exhaust Fan Installation',
      'Commercial AC Service',
      'AC Unit Replacement',
    ]),
  },
  {
    serviceKey: 'cleaning',
    label: 'Cleaning',
    icon: 'sparkles',
    description: 'Residential and commercial cleaning services',
    status: 'core',
    subcategories: createSubs([
      'House Cleaning',
      'Deep Cleaning',
      'Move-In/Move-Out Cleaning',
      'Post-Construction Cleaning',
      'Office Cleaning',
      'Commercial Cleaning',
      'Carpet Cleaning',
      'Upholstery Cleaning',
      'Window Cleaning',
      'Pressure Washing',
      'Roof Cleaning',
      'Gutter Cleaning',
      'Pool Cleaning',
      'Tile & Grout Cleaning',
      'Kitchen Deep Clean',
      'Bathroom Deep Clean',
      'Mattress Cleaning',
      'Disinfection Services',
      'Regular Maid Service',
      'One-Time Cleaning',
    ]),
  },
  {
    serviceKey: 'handyman',
    label: 'Handyman',
    icon: 'hammer',
    description: 'General repairs and odd jobs around the home',
    status: 'core',
    subcategories: createSubs([
      'General Repairs',
      'Furniture Assembly',
      'Shelf & Rack Installation',
      'Picture & Mirror Hanging',
      'Door Repair & Installation',
      'Lock Repair & Installation',
      'Window Repair',
      'Screen Repair',
      'Drywall Repair',
      'Caulking & Sealing',
      'Weather Stripping',
      'Minor Carpentry',
      'Fence Repair',
      'Gate Repair',
      'Deck Repair',
      'Childproofing',
      'Senior Safety Modifications',
      'TV Mounting',
      'Curtain Rod Installation',
      'Towel Bar & Hardware Install',
      'Mailbox Installation',
      'Yard Work & Cleanup',
      'Small Painting Jobs',
      'Odd Jobs',
    ]),
  },

  // ═══════════════════════════════════════════════════════════════
  // CONSTRUCTION & RENOVATION
  // ═══════════════════════════════════════════════════════════════
  {
    serviceKey: 'painting',
    label: 'Painting',
    icon: 'color-palette',
    description: 'Interior and exterior painting services',
    status: 'core',
    subcategories: createSubs([
      'Interior Painting',
      'Exterior Painting',
      'Cabinet Painting',
      'Deck & Fence Staining',
      'Wallpaper Installation',
      'Wallpaper Removal',
      'Texture & Faux Finishes',
      'Popcorn Ceiling Removal',
      'Accent Wall Painting',
      'Trim & Molding Painting',
      'Garage Floor Painting',
      'Commercial Painting',
      'Pressure Washing & Prep',
      'Color Consultation',
    ]),
  },
  {
    serviceKey: 'carpentry',
    label: 'Carpentry',
    icon: 'construct',
    description: 'Custom woodwork, built-ins, and carpentry projects',
    status: 'core',
    subcategories: createSubs([
      'Custom Cabinets',
      'Cabinet Repair',
      'Cabinet Refacing',
      'Closet Systems',
      'Built-In Shelving',
      'Crown Molding Installation',
      'Baseboard Installation',
      'Trim Work',
      'Door Installation',
      'Window Trim',
      'Deck Building',
      'Pergola Construction',
      'Fence Building',
      'Custom Furniture',
      'Furniture Repair',
      'Stair Repair',
      'Railing Installation',
      'Wood Rot Repair',
      'Framing',
    ]),
  },
  {
    serviceKey: 'roofing',
    label: 'Roofing',
    icon: 'home',
    description: 'Roof repair, replacement, and maintenance',
    status: 'core',
    subcategories: createSubs([
      'Roof Repair',
      'Roof Replacement',
      'Roof Inspection',
      'Leak Detection & Repair',
      'Shingle Repair',
      'Metal Roofing',
      'Flat Roof Repair',
      'Gutter Installation',
      'Gutter Repair',
      'Gutter Cleaning',
      'Downspout Repair',
      'Skylight Installation',
      'Skylight Repair',
      'Roof Coating',
      'Emergency Roof Repair',
      'Storm Damage Repair',
      'Fascia & Soffit Repair',
    ]),
  },
  {
    serviceKey: 'flooring',
    label: 'Flooring',
    icon: 'grid',
    description: 'Floor installation, repair, and refinishing',
    status: 'core',
    subcategories: createSubs([
      'Tile Installation',
      'Tile Repair',
      'Hardwood Installation',
      'Hardwood Refinishing',
      'Laminate Installation',
      'Vinyl Flooring',
      'Carpet Installation',
      'Carpet Repair',
      'Concrete Polishing',
      'Epoxy Flooring',
      'Floor Leveling',
      'Subfloor Repair',
      'Grout Repair & Sealing',
      'Outdoor Tile',
      'Stair Treads',
      'Floor Removal',
    ]),
  },
  {
    serviceKey: 'masonry',
    label: 'Masonry & Concrete',
    icon: 'cube',
    description: 'Concrete work, block laying, and stone work',
    status: 'core',
    subcategories: createSubs([
      'Concrete Pouring',
      'Concrete Repair',
      'Driveway Installation',
      'Driveway Repair',
      'Sidewalk Repair',
      'Patio Installation',
      'Block Wall Construction',
      'Retaining Wall',
      'Foundation Repair',
      'Brick Work',
      'Stone Work',
      'Stucco Repair',
      'Chimney Repair',
      'Concrete Sealing',
      'Stamped Concrete',
      'Decorative Concrete',
    ]),
  },
  {
    serviceKey: 'renovation',
    label: 'Renovation',
    icon: 'build',
    description: 'Home renovation and remodeling projects',
    status: 'beta',
    subcategories: createSubs([
      'Kitchen Remodeling',
      'Bathroom Remodeling',
      'Basement Finishing',
      'Room Addition',
      'Garage Conversion',
      'Attic Conversion',
      'Home Office Build-Out',
      'Accessibility Modifications',
      'Whole Home Renovation',
      'Historic Restoration',
      'Commercial Renovation',
      'Structural Modifications',
    ]),
  },

  // ═══════════════════════════════════════════════════════════════
  // OUTDOOR & LANDSCAPING
  // ═══════════════════════════════════════════════════════════════
  {
    serviceKey: 'landscaping',
    label: 'Landscaping',
    icon: 'leaf',
    description: 'Lawn care, garden design, and outdoor beautification',
    status: 'core',
    subcategories: createSubs([
      'Lawn Mowing',
      'Lawn Care & Treatment',
      'Garden Design',
      'Garden Maintenance',
      'Tree Trimming',
      'Tree Removal',
      'Stump Removal',
      'Bush & Hedge Trimming',
      'Flower Bed Installation',
      'Mulching',
      'Sod Installation',
      'Irrigation Installation',
      'Irrigation Repair',
      'Sprinkler System',
      'Drainage Solutions',
      'Weed Control',
      'Pest Control (Outdoor)',
      'Leaf Removal',
      'Yard Cleanup',
      'Landscape Lighting',
      'Retaining Wall (Landscape)',
      'Paver Installation',
      'Walkway Installation',
    ]),
  },
  {
    serviceKey: 'fencing',
    label: 'Fencing & Gates',
    icon: 'apps',
    description: 'Fence and gate installation, repair, and maintenance',
    status: 'core',
    subcategories: createSubs([
      'Wood Fence Installation',
      'Chain Link Fence',
      'Metal Fence Installation',
      'PVC/Vinyl Fence',
      'Fence Repair',
      'Fence Painting & Staining',
      'Gate Installation',
      'Gate Repair',
      'Automatic Gate Installation',
      'Electric Gate Repair',
      'Driveway Gate',
      'Security Fencing',
      'Pool Fencing',
      'Privacy Fence',
    ]),
  },
  {
    serviceKey: 'pools',
    label: 'Pools & Spas',
    icon: 'water-outline',
    description: 'Pool installation, maintenance, and repair',
    status: 'beta',
    subcategories: createSubs([
      'Pool Cleaning',
      'Pool Maintenance',
      'Pool Repair',
      'Pool Equipment Repair',
      'Pool Pump Repair',
      'Pool Filter Service',
      'Pool Resurfacing',
      'Pool Tile Repair',
      'Pool Leak Detection',
      'Pool Opening/Closing',
      'Pool Installation',
      'Hot Tub Repair',
      'Hot Tub Installation',
      'Pool Deck Repair',
      'Pool Safety Inspection',
    ]),
  },
  {
    serviceKey: 'outdoor_structures',
    label: 'Outdoor Structures',
    icon: 'business',
    description: 'Decks, patios, pergolas, and outdoor living spaces',
    status: 'beta',
    subcategories: createSubs([
      'Deck Building',
      'Deck Repair',
      'Deck Staining & Sealing',
      'Patio Construction',
      'Patio Cover Installation',
      'Pergola Construction',
      'Gazebo Installation',
      'Carport Installation',
      'Shed Building',
      'Outdoor Kitchen',
      'BBQ Area Construction',
      'Retaining Wall',
      'Awning Installation',
      'Screen Enclosure',
    ]),
  },

  // ═══════════════════════════════════════════════════════════════
  // APPLIANCES & SYSTEMS
  // ═══════════════════════════════════════════════════════════════
  {
    serviceKey: 'appliance_repair',
    label: 'Appliance Repair',
    icon: 'settings',
    description: 'Repair and maintenance for household appliances',
    status: 'core',
    subcategories: createSubs([
      'Refrigerator Repair',
      'Washing Machine Repair',
      'Dryer Repair',
      'Dishwasher Repair',
      'Oven & Stove Repair',
      'Microwave Repair',
      'Freezer Repair',
      'Ice Maker Repair',
      'Garbage Disposal Repair',
      'Range Hood Repair',
      'Small Appliance Repair',
      'Appliance Installation',
      'Water Heater Repair',
      'Water Heater Installation',
    ]),
  },
  {
    serviceKey: 'security_systems',
    label: 'Security Systems',
    icon: 'shield-checkmark',
    description: 'Home security installation and monitoring',
    status: 'beta',
    subcategories: createSubs([
      'Security Camera Installation',
      'CCTV Installation',
      'Alarm System Installation',
      'Alarm System Repair',
      'Smart Lock Installation',
      'Access Control Systems',
      'Intercom Installation',
      'Video Doorbell Installation',
      'Motion Sensor Installation',
      'Security Lighting',
      'Safe Installation',
      'Security Consultation',
      'Commercial Security',
    ]),
  },
  {
    serviceKey: 'smart_home',
    label: 'Smart Home',
    icon: 'phone-portrait',
    description: 'Smart home device installation and setup',
    status: 'beta',
    subcategories: createSubs([
      'Smart Thermostat Installation',
      'Smart Lighting Setup',
      'Smart Lock Installation',
      'Smart Speaker Setup',
      'Home Automation',
      'WiFi Network Setup',
      'Smart TV Setup',
      'Home Theater Installation',
      'Whole Home Audio',
      'Smart Doorbell Installation',
      'Smart Garage Door',
      'Voice Assistant Setup',
    ]),
  },

  // ═══════════════════════════════════════════════════════════════
  // SPECIALTY SERVICES
  // ═══════════════════════════════════════════════════════════════
  {
    serviceKey: 'pest_control',
    label: 'Pest Control',
    icon: 'bug',
    description: 'Pest elimination and prevention services',
    status: 'core',
    subcategories: createSubs([
      'General Pest Control',
      'Termite Treatment',
      'Termite Inspection',
      'Rodent Control',
      'Mosquito Control',
      'Cockroach Treatment',
      'Ant Treatment',
      'Bed Bug Treatment',
      'Bee & Wasp Removal',
      'Wildlife Removal',
      'Fumigation',
      'Preventive Pest Control',
      'Commercial Pest Control',
    ]),
  },
  {
    serviceKey: 'windows_doors',
    label: 'Windows & Doors',
    icon: 'browsers',
    description: 'Window and door installation, repair, and replacement',
    status: 'core',
    subcategories: createSubs([
      'Window Installation',
      'Window Replacement',
      'Window Repair',
      'Window Screen Repair',
      'Door Installation',
      'Door Replacement',
      'Door Repair',
      'Sliding Door Repair',
      'French Door Installation',
      'Storm Door Installation',
      'Security Door Installation',
      'Pet Door Installation',
      'Glass Replacement',
      'Window Tinting',
      'Hurricane Shutters',
      'Burglar Bars',
    ]),
  },
  {
    serviceKey: 'welding',
    label: 'Welding & Metalwork',
    icon: 'flame',
    description: 'Custom welding and metal fabrication',
    status: 'core',
    subcategories: createSubs([
      'Gate Fabrication',
      'Fence Fabrication',
      'Railing Fabrication',
      'Burglar Bar Installation',
      'Security Grille',
      'Metal Stairs',
      'Structural Welding',
      'Ornamental Ironwork',
      'Metal Repair',
      'Aluminum Welding',
      'Stainless Steel Work',
      'Custom Metal Fabrication',
      'Balcony Railings',
      'Car Port Construction',
    ]),
  },
  {
    serviceKey: 'garage_doors',
    label: 'Garage Doors',
    icon: 'car',
    description: 'Garage door installation, repair, and maintenance',
    status: 'beta',
    subcategories: createSubs([
      'Garage Door Repair',
      'Garage Door Installation',
      'Garage Door Opener Repair',
      'Garage Door Opener Installation',
      'Spring Replacement',
      'Panel Replacement',
      'Garage Door Maintenance',
      'Commercial Garage Doors',
      'Roll-Up Door Repair',
    ]),
  },

  // ═══════════════════════════════════════════════════════════════
  // MOVING & DELIVERY
  // ═══════════════════════════════════════════════════════════════
  {
    serviceKey: 'moving',
    label: 'Moving & Hauling',
    icon: 'cube-outline',
    description: 'Moving, hauling, and junk removal services',
    status: 'beta',
    subcategories: createSubs([
      'Local Moving',
      'Long Distance Moving',
      'Furniture Moving',
      'Heavy Item Moving',
      'Appliance Moving',
      'Office Moving',
      'Packing Services',
      'Unpacking Services',
      'Storage Services',
      'Junk Removal',
      'Debris Hauling',
      'Furniture Disposal',
      'Appliance Disposal',
      'Yard Waste Removal',
      'Estate Cleanout',
    ]),
  },
  {
    serviceKey: 'delivery',
    label: 'Delivery & Errands',
    icon: 'bicycle',
    description: 'Pickup, delivery, and errand services',
    status: 'coming_soon',
    subcategories: createSubs([
      'Furniture Delivery',
      'Appliance Delivery',
      'Building Material Delivery',
      'Package Pickup & Delivery',
      'Grocery Delivery',
      'Errand Running',
      'Waiting in Line',
      'Store Returns',
    ]),
  },

  // ═══════════════════════════════════════════════════════════════
  // AUTOMOTIVE
  // ═══════════════════════════════════════════════════════════════
  {
    serviceKey: 'automotive',
    label: 'Automotive',
    icon: 'car-sport',
    description: 'Mobile auto services and detailing',
    status: 'coming_soon',
    subcategories: createSubs([
      'Mobile Car Wash',
      'Car Detailing',
      'Interior Cleaning',
      'Tire Change',
      'Battery Jump Start',
      'Battery Replacement',
      'Oil Change',
      'Minor Auto Repair',
      'Mobile Mechanic',
      'AC Recharge (Auto)',
      'Window Tinting (Auto)',
      'Dent Repair',
      'Scratch Repair',
    ]),
  },

  // ═══════════════════════════════════════════════════════════════
  // EVENTS & SPECIAL OCCASIONS
  // ═══════════════════════════════════════════════════════════════
  {
    serviceKey: 'events',
    label: 'Events & Rentals',
    icon: 'calendar',
    description: 'Event setup, equipment rental, and party services',
    status: 'coming_soon',
    subcategories: createSubs([
      'Tent Rental & Setup',
      'Chair & Table Rental',
      'Party Equipment Rental',
      'Event Setup',
      'Event Cleanup',
      'Balloon Decoration',
      'Event Lighting',
      'Sound System Rental',
      'Generator Rental',
      'Portable Toilet Rental',
      'BBQ Grill Rental',
    ]),
  },

  // ═══════════════════════════════════════════════════════════════
  // CUSTOM REQUEST (Always at end)
  // ═══════════════════════════════════════════════════════════════
  {
    serviceKey: 'other',
    label: 'Other Services',
    icon: 'ellipsis-horizontal',
    description: 'Can\'t find what you need? Request here',
    status: 'core',
    subcategories: createSubs([
      'General Request',
      'Custom Service',
      'Consultation',
      'Project Planning',
      'Second Opinion',
      'Emergency Service',
    ]),
  },
];

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get all categories
 */
export const getAllCategories = (): ServiceCategory[] => SERVICE_CATEGORIES;

/**
 * Get categories by status
 */
export const getCategoriesByStatus = (status: 'core' | 'beta' | 'coming_soon'): ServiceCategory[] =>
  SERVICE_CATEGORIES.filter(cat => cat.status === status);

/**
 * Get displayable categories (core + beta, exclude coming_soon)
 */
export const getDisplayableCategories = (): ServiceCategory[] =>
  SERVICE_CATEGORIES.filter(cat => cat.status !== 'coming_soon');

/**
 * Get a category by serviceKey
 */
export const getCategoryByKey = (serviceKey: string): ServiceCategory | undefined =>
  SERVICE_CATEGORIES.find(cat => cat.serviceKey === serviceKey);

/**
 * Get subcategories for a category
 */
export const getSubcategoriesByKey = (serviceKey: string): SubCategory[] =>
  getCategoryByKey(serviceKey)?.subcategories || [];

/**
 * Get a specific subcategory
 */
export const getSubcategory = (serviceKey: string, subcategoryKey: string): SubCategory | undefined =>
  getSubcategoriesByKey(serviceKey).find(sub => sub.subcategoryKey === subcategoryKey);

/**
 * Get label for a serviceKey
 */
export const getServiceLabel = (serviceKey: string): string =>
  getCategoryByKey(serviceKey)?.label || serviceKey;

/**
 * Get label for a subcategoryKey
 */
export const getSubcategoryLabel = (serviceKey: string, subcategoryKey: string): string =>
  getSubcategory(serviceKey, subcategoryKey)?.label || subcategoryKey;

/**
 * Check if a category requires sub-category selection
 * (All categories with subcategories should show subcategory screen)
 */
export const requiresSubcategorySelection = (serviceKey: string): boolean => {
  const category = getCategoryByKey(serviceKey);
  // 'other' goes directly to general request form
  if (serviceKey === 'other') return false;
  return category ? category.subcategories.length > 0 : false;
};

/**
 * Search categories and subcategories
 */
export const searchServices = (query: string): Array<{category: ServiceCategory, matchedSubs: SubCategory[]}> => {
  const lowerQuery = query.toLowerCase();
  const results: Array<{category: ServiceCategory, matchedSubs: SubCategory[]}> = [];
  
  for (const category of SERVICE_CATEGORIES) {
    if (category.status === 'coming_soon') continue;
    
    const categoryMatch = category.label.toLowerCase().includes(lowerQuery);
    const matchedSubs = category.subcategories.filter(sub => 
      sub.label.toLowerCase().includes(lowerQuery)
    );
    
    if (categoryMatch || matchedSubs.length > 0) {
      results.push({
        category,
        matchedSubs: categoryMatch ? category.subcategories : matchedSubs,
      });
    }
  }
  
  return results;
};

/**
 * Count total services
 */
export const getTotalServiceCount = (): { categories: number; subcategories: number } => {
  const categories = SERVICE_CATEGORIES.filter(c => c.status !== 'coming_soon').length;
  const subcategories = SERVICE_CATEGORIES
    .filter(c => c.status !== 'coming_soon')
    .reduce((total, cat) => total + cat.subcategories.length, 0);
  return { categories, subcategories };
};

export default SERVICE_CATEGORIES;
