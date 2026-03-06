/**
 * Sub-categories for main service categories
 * Used for search filtering on Customer Home screen
 */

export interface SubCategory {
  id: string;
  label: string;
  parentCategory: string;  // Maps to top-level category serviceKey
  icon: string;
  keywords: string[];      // Additional search terms
}

// Sub-categories mapped by parent category
export const SUB_CATEGORIES: Record<string, SubCategory[]> = {
  electrical: [
    { id: 'elec_wiring', label: 'Wiring & Rewiring', parentCategory: 'electrical', icon: 'git-network-outline', keywords: ['wire', 'rewire', 'cable'] },
    { id: 'elec_outlet', label: 'Outlet Installation', parentCategory: 'electrical', icon: 'flash-outline', keywords: ['plug', 'socket', 'power point'] },
    { id: 'elec_panel', label: 'Panel Upgrade', parentCategory: 'electrical', icon: 'grid-outline', keywords: ['breaker', 'fuse', 'box', 'circuit'] },
    { id: 'elec_lighting', label: 'Lighting Installation', parentCategory: 'electrical', icon: 'bulb-outline', keywords: ['light', 'lamp', 'fixture', 'chandelier'] },
    { id: 'elec_fan', label: 'Ceiling Fan Install', parentCategory: 'electrical', icon: 'sunny-outline', keywords: ['fan', 'ceiling'] },
    { id: 'elec_surge', label: 'Surge Protection', parentCategory: 'electrical', icon: 'shield-checkmark-outline', keywords: ['surge', 'protector', 'voltage'] },
    { id: 'elec_generator', label: 'Generator Service', parentCategory: 'electrical', icon: 'battery-charging-outline', keywords: ['generator', 'backup', 'power'] },
    { id: 'elec_inspection', label: 'Electrical Inspection', parentCategory: 'electrical', icon: 'search-outline', keywords: ['inspect', 'check', 'safety'] },
  ],
  plumbing: [
    { id: 'plumb_leak', label: 'Leak Repair', parentCategory: 'plumbing', icon: 'water-outline', keywords: ['leak', 'drip', 'water damage'] },
    { id: 'plumb_drain', label: 'Drain Cleaning', parentCategory: 'plumbing', icon: 'funnel-outline', keywords: ['drain', 'clog', 'block', 'slow'] },
    { id: 'plumb_toilet', label: 'Toilet Repair', parentCategory: 'plumbing', icon: 'home-outline', keywords: ['toilet', 'flush', 'bowl', 'running'] },
    { id: 'plumb_faucet', label: 'Faucet Installation', parentCategory: 'plumbing', icon: 'water-outline', keywords: ['faucet', 'tap', 'sink'] },
    { id: 'plumb_heater', label: 'Water Heater', parentCategory: 'plumbing', icon: 'flame-outline', keywords: ['heater', 'hot water', 'geyser'] },
    { id: 'plumb_pipe', label: 'Pipe Repair', parentCategory: 'plumbing', icon: 'git-branch-outline', keywords: ['pipe', 'burst', 'broken'] },
    { id: 'plumb_shower', label: 'Shower Installation', parentCategory: 'plumbing', icon: 'rainy-outline', keywords: ['shower', 'bath', 'head'] },
    { id: 'plumb_sewer', label: 'Sewer Line Service', parentCategory: 'plumbing', icon: 'trail-sign-outline', keywords: ['sewer', 'septic', 'main line'] },
  ],
  ac_hvac: [
    { id: 'ac_install', label: 'AC Installation', parentCategory: 'ac_hvac', icon: 'snow-outline', keywords: ['install', 'new', 'unit'] },
    { id: 'ac_repair', label: 'AC Repair', parentCategory: 'ac_hvac', icon: 'construct-outline', keywords: ['repair', 'fix', 'broken', 'not working'] },
    { id: 'ac_service', label: 'AC Servicing', parentCategory: 'ac_hvac', icon: 'settings-outline', keywords: ['service', 'maintenance', 'tune-up'] },
    { id: 'ac_clean', label: 'AC Cleaning', parentCategory: 'ac_hvac', icon: 'sparkles-outline', keywords: ['clean', 'filter', 'coil'] },
    { id: 'ac_gas', label: 'Gas Recharge', parentCategory: 'ac_hvac', icon: 'thermometer-outline', keywords: ['gas', 'recharge', 'refrigerant', 'freon'] },
    { id: 'ac_duct', label: 'Duct Cleaning', parentCategory: 'ac_hvac', icon: 'git-network-outline', keywords: ['duct', 'vent', 'airflow'] },
    { id: 'ac_thermostat', label: 'Thermostat Install', parentCategory: 'ac_hvac', icon: 'speedometer-outline', keywords: ['thermostat', 'temperature', 'smart'] },
    { id: 'ac_inverter', label: 'Inverter AC Service', parentCategory: 'ac_hvac', icon: 'pulse-outline', keywords: ['inverter', 'split', 'energy'] },
  ],
  cleaning: [
    { id: 'clean_house', label: 'House Cleaning', parentCategory: 'cleaning', icon: 'home-outline', keywords: ['house', 'home', 'general'] },
    { id: 'clean_deep', label: 'Deep Cleaning', parentCategory: 'cleaning', icon: 'sparkles-outline', keywords: ['deep', 'thorough', 'spring'] },
    { id: 'clean_office', label: 'Office Cleaning', parentCategory: 'cleaning', icon: 'business-outline', keywords: ['office', 'commercial', 'workplace'] },
    { id: 'clean_carpet', label: 'Carpet Cleaning', parentCategory: 'cleaning', icon: 'layers-outline', keywords: ['carpet', 'rug', 'upholstery'] },
    { id: 'clean_window', label: 'Window Cleaning', parentCategory: 'cleaning', icon: 'grid-outline', keywords: ['window', 'glass', 'pane'] },
    { id: 'clean_movein', label: 'Move-in/Move-out', parentCategory: 'cleaning', icon: 'cube-outline', keywords: ['move', 'moving', 'tenant'] },
    { id: 'clean_post', label: 'Post-Construction', parentCategory: 'cleaning', icon: 'hammer-outline', keywords: ['construction', 'renovation', 'dust'] },
    { id: 'clean_pressure', label: 'Pressure Washing', parentCategory: 'cleaning', icon: 'water-outline', keywords: ['pressure', 'power wash', 'exterior'] },
  ],
};

// Flatten all sub-categories for search
export const ALL_SUB_CATEGORIES: SubCategory[] = Object.values(SUB_CATEGORIES).flat();

// Search function: returns matching sub-categories and parent categories
export function searchServices(query: string): {
  matchingSubCategories: SubCategory[];
  matchingParentKeys: string[];
} {
  const normalizedQuery = query.toLowerCase().trim();
  
  if (!normalizedQuery) {
    return { matchingSubCategories: [], matchingParentKeys: [] };
  }

  const matchingSubCategories: SubCategory[] = [];
  const matchingParentKeys = new Set<string>();

  // Check if query matches a parent category name
  const parentCategoryNames: Record<string, string> = {
    electrical: 'electrical',
    plumbing: 'plumbing',
    'ac & cooling': 'ac_hvac',
    'ac': 'ac_hvac',
    'hvac': 'ac_hvac',
    'cooling': 'ac_hvac',
    'air conditioning': 'ac_hvac',
    cleaning: 'cleaning',
  };

  // Check for parent category match
  for (const [name, key] of Object.entries(parentCategoryNames)) {
    if (name.includes(normalizedQuery) || normalizedQuery.includes(name)) {
      matchingParentKeys.add(key);
    }
  }

  // If we matched a parent category, include ALL its sub-categories
  for (const parentKey of matchingParentKeys) {
    const subs = SUB_CATEGORIES[parentKey] || [];
    matchingSubCategories.push(...subs);
  }

  // Also search sub-categories by label and keywords
  for (const sub of ALL_SUB_CATEGORIES) {
    // Skip if already added via parent match
    if (matchingSubCategories.some(m => m.id === sub.id)) continue;

    const labelMatch = sub.label.toLowerCase().includes(normalizedQuery);
    const keywordMatch = sub.keywords.some(kw => 
      kw.toLowerCase().includes(normalizedQuery) || 
      normalizedQuery.includes(kw.toLowerCase())
    );

    if (labelMatch || keywordMatch) {
      matchingSubCategories.push(sub);
    }
  }

  return {
    matchingSubCategories,
    matchingParentKeys: Array.from(matchingParentKeys),
  };
}

// Suggested categories when no matches found
export const SUGGESTED_CATEGORIES = ['electrical', 'plumbing', 'ac_hvac', 'cleaning'];
