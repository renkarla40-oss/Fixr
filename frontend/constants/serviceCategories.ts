export const SERVICE_CATEGORIES = [
{
  key: "plumbing",
  label: "Plumbing",
  subcategories: [
    { key: "emergency_plumbing", label: "Emergency plumbing" },
    { key: "fix_leak", label: "Fix leaking pipe" },
    { key: "burst_pipe", label: "Fix burst pipe" },
    { key: "unclog_drain", label: "Unclog drain" },
    { key: "install_toilet", label: "Install toilet" },
    { key: "repair_toilet", label: "Repair or replace toilet" },
    { key: "install_sink", label: "Install sink or wash basin" },
    { key: "repair_sink", label: "Repair sink or taps" },
    { key: "install_tank", label: "Install water tank" },
    { key: "tank_repair", label: "Water tank repair / connection" },
    { key: "install_pump", label: "Install water pump" },
    { key: "repair_pump", label: "Repair water pump" },
    { key: "low_pressure", label: "Fix low water pressure" },
    { key: "general_plumbing", label: "General plumbing repairs" }
  ]
},
{
  key: "electrical",
  label: "Electrical",
  subcategories: [
    { key: "install_outlet", label: "Install electrical outlet / socket" },
    { key: "install_220v", label: "Install 220V outlet" },
    { key: "extra_outlet", label: "Install extra outlet" },
    { key: "replace_switch", label: "Replace faulty outlet / switch" },
    { key: "install_lights", label: "Install lights" },
    { key: "fix_power", label: "Fix power issue in part of house" },
    { key: "breaker_trip", label: "Fix breaker tripping" },
    { key: "upgrade_panel", label: "Upgrade breaker panel" },
    { key: "new_wiring", label: "Run wiring for new room / extension" },
    { key: "install_fan", label: "Install ceiling fan" },
    { key: "generator_connect", label: "Connect generator to house" },
    { key: "fix_wiring", label: "Fix faulty wiring" },
    { key: "install_pump", label: "Install water pump" },
    { key: "repair_pump", label: "Repair water pump" },
    { key: "general_electrical", label: "General electrical repair" }
  ]
},
{
  key: "ac",
  label: "Air Conditioning",
  subcategories: [
    { key: "install_ac", label: "Install AC unit" },
    { key: "fix_ac", label: "Fix AC not cooling" },
    { key: "service_ac", label: "Service / clean AC unit" },
    { key: "gas_refill", label: "Refill AC gas" },
    { key: "ac_leak", label: "Fix leaking AC" },
    { key: "install_split", label: "Install split unit" },
    { key: "install_window", label: "Install window unit" },
    { key: "move_ac", label: "Move AC unit" },
    { key: "ac_noise", label: "Fix AC noise issue" },
    { key: "general_ac", label: "General AC repair" }
  ]
},
{
  key: "appliance",
  label: "Appliance Repair",
  subcategories: [
    { key: "fix_fridge", label: "Fix refrigerator not cooling" },
    { key: "fix_washer", label: "Fix washing machine" },
    { key: "fix_dryer", label: "Fix dryer" },
    { key: "fix_stove", label: "Fix stove / oven" },
    { key: "fix_microwave", label: "Fix microwave" },
    { key: "fix_dishwasher", label: "Fix dishwasher" },
    { key: "install_appliance", label: "Install appliance" },
    { key: "diagnose_appliance", label: "Diagnose appliance problem" },
    { key: "general_appliance", label: "General appliance repair" }
  ]
},
{
  key: "carpentry",
  label: "Carpentry",
  subcategories: [
    { key: "build_cabinets", label: "Build cabinets" },
    { key: "install_cabinets", label: "Install cabinets" },
    { key: "repair_cabinets", label: "Repair cabinets" },
    { key: "install_doors", label: "Install doors" },
    { key: "build_shelves", label: "Build shelves" },
    { key: "install_shelves", label: "Install shelves" },
    { key: "build_closet", label: "Build closet" },
    { key: "fix_furniture", label: "Fix wooden furniture" },
    { key: "custom_woodwork", label: "Custom woodwork" },
    { key: "general_carpentry", label: "General carpentry repair" }
  ]
},
{
  key: "welding",
  label: "Welding & Metalwork",
  subcategories: [
    { key: "build_gate", label: "Build gate" },
    { key: "repair_gate", label: "Repair gate" },
    { key: "install_burglar", label: "Install burglar proofing" },
    { key: "repair_burglar", label: "Repair burglar proofing" },
    { key: "metal_railing", label: "Build metal railing" },
    { key: "fix_railing", label: "Fix metal railing" },
    { key: "weld_metal", label: "Weld broken metal" },
    { key: "custom_metal", label: "Custom metal fabrication" },
    { key: "general_welding", label: "General welding repair" }
  ]
},
{
  key: "handyman",
  label: "Handyman",
  subcategories: [
    { key: "small_paint", label: "Small painting jobs" },
    { key: "small_tiling", label: "Small tiling jobs" },
    { key: "drain_work", label: "Build or repair drains" },
    { key: "yard_cleanup", label: "Yard cleanup & clearing" },
    { key: "tree_cutting", label: "Tree cutting / trimming" },
    { key: "power_washing", label: "Power washing" },
    { key: "cabinet_repair", label: "Repair cabinets or cupboards" },
    { key: "concrete_base", label: "Build concrete base (water tank stand, etc.)" },
    { key: "minor_concrete", label: "Minor concrete work" },
    { key: "general_handyman", label: "General home repairs" }
  ]
},
{
  key: "cleaning",
  label: "Cleaning",
  subcategories: [
    { key: "clean_home", label: "Clean house" },
    { key: "deep_clean", label: "Deep clean house" },
    { key: "move_clean", label: "Move-in / move-out cleaning" },
    { key: "office_clean", label: "Clean office" },
    { key: "post_construction", label: "Post-construction cleaning" },
    { key: "carpet_clean", label: "Wash carpet" },
    { key: "sofa_clean", label: "Clean sofa / upholstery" },
    { key: "pressure_wash", label: "Pressure wash yard / walls" },
    { key: "sanitize", label: "Sanitize home" },
    { key: "general_cleaning", label: "General cleaning service" }
  ]
},
{
  key: "landscaping",
  label: "Landscaping",
  subcategories: [
    { key: "cut_grass", label: "Cut grass" },
    { key: "clean_yard", label: "Clean yard" },
    { key: "trim_trees", label: "Trim trees" },
    { key: "remove_tree", label: "Remove tree" },
    { key: "planting", label: "Plant flowers / plants" },
    { key: "garden_design", label: "Design garden" },
    { key: "yard_drainage", label: "Fix drainage in yard" },
    { key: "irrigation", label: "Install irrigation system" },
    { key: "maintain_yard", label: "Maintain yard" },
    { key: "general_landscaping", label: "General landscaping service" }
  ]
},
{
  key: "painting",
  label: "Painting",
  subcategories: [
    { key: "paint_interior", label: "Paint interior walls" },
    { key: "paint_exterior", label: "Paint exterior walls" },
    { key: "paint_fence", label: "Paint fence" },
    { key: "paint_roof", label: "Paint roof" },
    { key: "repaint_room", label: "Repaint room" },
    { key: "patch_paint", label: "Patch and paint wall" },
    { key: "decorative", label: "Decorative painting" },
    { key: "general_painting", label: "General painting service" }
  ]
},
{
  key: "flooring",
  label: "Flooring",
  subcategories: [
    { key: "install_tiles", label: "Install tiles" },
    { key: "fix_tiles", label: "Fix broken tiles" },
    { key: "install_laminate", label: "Install laminate flooring" },
    { key: "install_vinyl", label: "Install vinyl flooring" },
    { key: "polish_floor", label: "Polish floors" },
    { key: "regrout", label: "Re-grout tiles" },
    { key: "level_floor", label: "Level floor" },
    { key: "install_carpet", label: "Install carpet" },
    { key: "general_flooring", label: "General flooring service" }
  ]
},
{
  key: "roofing",
  label: "Roofing",
  subcategories: [
    { key: "fix_roof_leak", label: "Fix leaking roof" },
    { key: "repair_roof", label: "Repair roof damage" },
    { key: "replace_roof", label: "Replace roof" },
    { key: "install_roof", label: "Install new roof" },
    { key: "fix_shingles", label: "Fix shingles" },
    { key: "waterproof_roof", label: "Waterproof roof" },
    { key: "install_gutters", label: "Install gutters" },
    { key: "fix_gutters", label: "Fix gutters" },
    { key: "inspect_roof", label: "Inspect roof" },
    { key: "general_roofing", label: "General roofing repair" }
  ]
}
];

// ─── Compatibility layer ─────────────────────────────────────────────────────
// The interfaces and helpers below restore exports expected by existing UI screens.
// Do not remove. Do not refactor. Taxonomy data above is the source of truth.

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

const ICON_MAP: Record<string, string> = {
  plumbing:    'water',
  electrical:  'flash',
  ac:          'snow',
  appliance:   'settings',
  carpentry:   'construct',
  welding:     'flame',
  handyman:    'hammer',
  cleaning:    'sparkles',
  landscaping: 'leaf',
  painting:    'color-palette',
  flooring:    'grid',
  roofing:     'home',
};

const DESCRIPTION_MAP: Record<string, string> = {
  plumbing:    'Plumbing repairs, installations, and maintenance',
  electrical:  'Electrical repairs, installations, and maintenance',
  ac:          'Air conditioning repair, service, and installation',
  appliance:   'Home appliance repair and installation',
  carpentry:   'Carpentry, cabinetry, and woodwork',
  welding:     'Welding, gates, railings, and metalwork',
  handyman:    'General handyman and minor home repairs',
  cleaning:    'Home and office cleaning services',
  landscaping: 'Yard care, landscaping, and garden services',
  painting:    'Interior and exterior painting services',
  flooring:    'Flooring installation, repair, and finishing',
  roofing:     'Roofing repair, replacement, and waterproofing',
};

const _mapped: ServiceCategory[] = SERVICE_CATEGORIES.map(cat => ({
  serviceKey:    cat.key,
  label:         cat.label,
  icon:          ICON_MAP[cat.key] || 'construct',
  description:   DESCRIPTION_MAP[cat.key] || cat.label,
  status:        'core' as const,
  subcategories: cat.subcategories.map(sub => ({
    subcategoryKey: sub.key,
    label:          sub.label,
  })),
}));

export const getCategoryByKey = (serviceKey: string): ServiceCategory | undefined =>
  _mapped.find(cat => cat.serviceKey === serviceKey);

export const getServiceLabel = (serviceKey: string): string =>
  getCategoryByKey(serviceKey)?.label || serviceKey;

export const requiresSubcategorySelection = (serviceKey: string): boolean => {
  const category = getCategoryByKey(serviceKey);
  return category ? category.subcategories.length > 0 : false;
};

export const getDisplayableCategories = (): ServiceCategory[] => _mapped;

export const getSubcategoriesByKey = (serviceKey: string): SubCategory[] => {
  const category = _mapped.find(cat => cat.serviceKey === serviceKey);
  return category ? category.subcategories : [];
};
