export const SERVICE_CATEGORIES = [
{
  key: "plumbing",
  label: "Plumbing",
  subcategories: [
    { key: "fix_leak", label: "Fix leaking pipe" },
    { key: "unclog_drain", label: "Unclog drain" },
    { key: "install_sink", label: "Install sink" },
    { key: "install_toilet", label: "Install toilet" },
    { key: "fix_toilet", label: "Fix running toilet" },
    { key: "install_shower", label: "Install shower / bathtub" },
    { key: "low_pressure", label: "Fix low water pressure" },
    { key: "install_heater", label: "Install water heater" },
    { key: "fix_heater", label: "Fix water heater" },
    { key: "install_tank", label: "Install water tank" },
    { key: "burst_pipe", label: "Fix burst pipe" },
    { key: "replace_faucet", label: "Replace faucet" },
    { key: "outdoor_pipe", label: "Install outdoor pipe / hose connection" },
    { key: "install_pump", label: "Install water pump" },
    { key: "repair_pump", label: "Repair water pump" },
    { key: "general_plumbing", label: "General plumbing repair" }
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
    { key: "fix_doors", label: "Fix door not closing properly" },
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
    { key: "mount_tv", label: "Mount TV" },
    { key: "install_blinds", label: "Install curtain rods / blinds" },
    { key: "assemble_furniture", label: "Assemble furniture" },
    { key: "patch_wall", label: "Patch holes in wall" },
    { key: "install_fixtures", label: "Install fixtures" },
    { key: "hang_items", label: "Hang pictures / mirrors" },
    { key: "fix_loose", label: "Fix loose items" },
    { key: "minor_repairs", label: "Minor home repairs" },
    { key: "general_handyman", label: "General handyman service" }
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

export const getDisplayableCategories = () => {
  return SERVICE_CATEGORIES;
};
