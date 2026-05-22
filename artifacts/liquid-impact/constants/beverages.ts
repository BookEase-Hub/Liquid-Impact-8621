// ============================================================================
// LIQUID IMPACT SCAN - PREMIUM WELLNESS REPORT DATABASE
// ============================================================================

import type { ScanResult, LiquidCategory, GlycemicImpact, ScanStatus, Ingredient, ImpactFluctuation, TimeHorizon, TimeBasedImpact } from '../types';

// ============================================================================
// TYPE DEFINITIONS - EXPANDED
// ============================================================================

export interface BaseDrinkTemplate {
  id?: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  liquidType: LiquidCategory;
  impactScore: number;
  hydrationLevel: number;
  glycemicImpact: GlycemicImpact;
  calories: number;
  sugar: number;
  caffeine: number;
  sodium: number;
  fat: number;
  protein: number;
  servingSize: number;
  servingUnit: string;
  additives: string[];
  ingredients: Ingredient[];
  alternatives: string[];
  keywords: string[];
  notes: string;
  healthBenefits?: string[];
  warnings?: string[];
  certifications?: string[];
  origin?: string;
  manufacturingDate?: string;
  expiryPeriod?: string;
  storageInstructions?: string;
  allergens?: string[];
  dietaryFlags?: ('vegan' | 'vegetarian' | 'gluten-free' | 'dairy-free' | 'keto' | 'paleo')[];
  sustainabilityScore?: number;
  carbonFootprint?: number;
  waterUsage?: number;
}

export interface FluctuationConfig {
  shortTerm: { min: number; max: number; volatility: number };
  mediumTerm: { min: number; max: number; volatility: number };
  longTerm: { min: number; max: number; volatility: number };
}


// ============================================================================
// GLOBAL CONFIGURATION
// ============================================================================

export const THEME = {
  colors: {
    background: '#0a0a0f',
    surface: '#12121a',
    surfaceElevated: '#1a1a24',
    surfaceGlass: 'rgba(26, 26, 36, 0.7)',
    primary: '#6366f1',
    primaryLight: '#818cf8',
    secondary: '#22d3ee',
    secondaryLight: '#67e8f9',
    success: '#10b981',
    successLight: '#34d399',
    warning: '#f59e0b',
    warningLight: '#fbbf24',
    error: '#ef4444',
    errorLight: '#f87171',
    info: '#3b82f6',
    infoLight: '#60a5fa',
    purple: '#a78bfa',
    purpleLight: '#c4b5fd',
    orange: '#fb923c',
    orangeLight: '#fdba74',
    red: '#f87171',
    redLight: '#fca5a5',
    yellow: '#fcd34d',
    yellowLight: '#fde68a',
    green: '#34d399',
    greenLight: '#6ee7b7',
    cyan: '#22d3ee',
    cyanLight: '#67e8f9',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    textDisabled: '#475569',
    border: '#27273a',
    borderLight: '#3f3f56',
    shadow: 'rgba(0, 0, 0, 0.4)',
    overlay: 'rgba(10, 10, 15, 0.8)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    glassHighlight: 'rgba(255, 255, 255, 0.05)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    xxxx: 40,
    huge: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
    h2: { fontSize: 24, fontWeight: '600' as const, letterSpacing: -0.3 },
    h3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2 },
    h4: { fontSize: 18, fontWeight: '500' as const, letterSpacing: -0.1 },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodySm: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    bodyXs: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
    caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 14 },
    label: { fontSize: 13, fontWeight: '500' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  },
};

export const NUTRITION_COLORS: Record<string, string> = {
  calories: THEME.colors.orange,
  sugar: THEME.colors.red,
  fat: THEME.colors.green,
  protein: THEME.colors.green,
  sodium: THEME.colors.yellow,
  caffeine: THEME.colors.purple,
  fiber: THEME.colors.cyan,
  vitamins: THEME.colors.secondary,
};

export const GLYCEMIC_COLORS: Record<string, string> = {
  low: THEME.colors.success,
  moderate: THEME.colors.warning,
  high: THEME.colors.error,
};

export const RISK_COLORS: Record<string, string> = {
  low: THEME.colors.success,
  medium: THEME.colors.warning,
  high: THEME.colors.error,
};

export const STATUS_COLORS: Record<string, string> = {
  optimal: THEME.colors.success,
  stable: THEME.colors.warning,
  risky: THEME.colors.orange,
  damaging: THEME.colors.error,
  unknown: THEME.colors.textMuted,
};

export const FLUCTUATION_CONFIGS: Record<string, FluctuationConfig> = {
  soda: {
    shortTerm: { min: -15, max: 15, volatility: 0.3 },
    mediumTerm: { min: -25, max: 25, volatility: 0.5 },
    longTerm: { min: -40, max: 40, volatility: 0.7 },
  },
  energy: {
    shortTerm: { min: -20, max: 20, volatility: 0.4 },
    mediumTerm: { min: -35, max: 35, volatility: 0.6 },
    longTerm: { min: -50, max: 50, volatility: 0.8 },
  },
  water: {
    shortTerm: { min: -2, max: 2, volatility: 0.05 },
    mediumTerm: { min: -5, max: 5, volatility: 0.1 },
    longTerm: { min: -10, max: 10, volatility: 0.2 },
  },
  juice: {
    shortTerm: { min: -10, max: 10, volatility: 0.25 },
    mediumTerm: { min: -20, max: 20, volatility: 0.45 },
    longTerm: { min: -35, max: 35, volatility: 0.65 },
  },
  sports: {
    shortTerm: { min: -8, max: 8, volatility: 0.2 },
    mediumTerm: { min: -15, max: 15, volatility: 0.35 },
    longTerm: { min: -25, max: 25, volatility: 0.55 },
  },
  beer: {
    shortTerm: { min: -12, max: 12, volatility: 0.28 },
    mediumTerm: { min: -22, max: 22, volatility: 0.48 },
    longTerm: { min: -38, max: 38, volatility: 0.68 },
  },
  spirits: {
    shortTerm: { min: -18, max: 18, volatility: 0.35 },
    mediumTerm: { min: -30, max: 30, volatility: 0.55 },
    longTerm: { min: -45, max: 45, volatility: 0.75 },
  },
  tea: {
    shortTerm: { min: -5, max: 5, volatility: 0.15 },
    mediumTerm: { min: -10, max: 10, volatility: 0.25 },
    longTerm: { min: -18, max: 18, volatility: 0.4 },
  },
  coffee: {
    shortTerm: { min: -8, max: 8, volatility: 0.22 },
    mediumTerm: { min: -15, max: 15, volatility: 0.38 },
    longTerm: { min: -28, max: 28, volatility: 0.58 },
  },
  default: {
    shortTerm: { min: -10, max: 10, volatility: 0.25 },
    mediumTerm: { min: -20, max: 20, volatility: 0.45 },
    longTerm: { min: -35, max: 35, volatility: 0.65 },
  },
};

export const BARCODE_INDEX: Record<string, string> = {
  // === GLOBAL COCA-COLA PRODUCTS (50 entries) ===
  "5000159407280": "local_coca-cola_coca-cola_classic_global_330ml_original",
  "5000159407297": "local_coca-cola_coca-cola_zero_sugar_global_330ml_zero_sugar",
  "5000159407335": "local_coca-cola_sprite_global_330ml_original",
  "5000159407342": "local_coca-cola_fanta_orange_global_330ml_original",
  "5000159407428": "local_red_bull_gmbh_red_bull_original_global_330ml_original",
  "5000159407459": "local_monster_beverage_monster_energy_global_330ml_original",
  "5000159407397": "local_pepsico_pepsi_global_330ml_original",
  "5000159407604": "local_pepsico_gatorade_lemon_lime_global_500ml_original",
  "5000159407642": "local_danone_evian_global_500ml_original",
  "5000159407659": "local_coca-cola_coca-cola_cherry_global_330ml_original",
  "5000159407666": "local_coca-cola_coca-cola_vanilla_global_330ml_original",
  "5000159407673": "local_coca-cola_coca-cola_zero_cherry_global_330ml_zero_sugar",
  "5000159407680": "local_coca-cola_coca-cola_zero_vanilla_global_330ml_zero_sugar",
  "5000159407697": "local_coca-cola_sprite_zero_global_330ml_zero_sugar",
  "5000159407703": "local_coca-cola_fanta_zero_orange_global_330ml_zero_sugar",
  "5000159407710": "local_coca-cola_fanta_grape_global_330ml_original",
  "5000159407727": "local_coca-cola_fanta_strawberry_global_330ml_original",
  "5000159407734": "local_coca-cola_fanta_pineapple_global_330ml_original",
  "5000159407741": "local_coca-cola_fanta_berry_global_330ml_original",
  "5000159407758": "local_coca-cola_fanta_grape_zero_global_330ml_zero_sugar",
  "5000159407765": "local_coca-cola_minute_maid_pulpy_orange_global_330ml_original",
  "5000159407772": "local_coca-cola_minute_maid_apple_global_330ml_original",
  "5000159407789": "local_coca-cola_powerade_mountain_berry_global_500ml_original",
  "5000159407796": "local_coca-cola_powerade_fruit_punch_global_500ml_original",
  "5000159407802": "local_coca-cola_vitaminwater_xxx_acai_blueberry_pomegranate_global_500ml_original",
  "5000159407819": "local_coca-cola_vitaminwater_power-c_global_500ml_original",
  "5000159407826": "local_coca-cola_smartwater_global_700ml_original",
  "5000159407833": "local_coca-cola_dasani_global_500ml_original",
  "5000159407840": "local_coca-cola_honest_tea_organic_half_tea_half_lemon_global_500ml_original",
  "5000159407857": "local_coca-cola_honest_tea_organic_green_tea_global_500ml_original",
  "5000159407864": "local_coca-cola_bodyarmor_sports_drink_fruit_punch_global_500ml_original",
  "5000159407871": "local_coca-cola_bodyarmor_sports_drink_coconut_water_global_500ml_original",
  "5000159407888": "local_coca-cola_topo_chico_mineral_water_original_global_355ml_original",
  "5000159407895": "local_coca-cola_costa_coffee_ready_to_drink_latte_global_250ml_original",
  "5000159407901": "local_coca-cola_costa_coffee_ready_to_drink_cappuccino_global_250ml_original",
  "5000159407918": "local_coca-cola_ayataka_green_tea_global_500ml_original",
  "5000159407925": "local_coca-cola_georgia_coffee_global_330ml_original",
  "5000159407932": "local_coca-cola_innocent_smoothies_strawberry_banana_global_300ml_original",
  "5000159407949": "local_coca-cola_innocent_smoothies_mango_passion_global_300ml_original",
  "5000159407956": "local_coca-cola_appletiser_sparkling_apple_juice_global_250ml_original",
  "5000159407963": "local_coca-cola_grapetiser_sparkling_grape_juice_global_250ml_original",
  "5000159407970": "local_coca-cola_burn_energy_drink_original_global_250ml_original",
  "5000159407987": "local_coca-cola_burn_energy_drink_sugarfree_global_250ml_zero_sugar",
  "5000159407994": "local_coca-cola_fuze_tea_lemon_global_500ml_original",
  "5000159408000": "local_coca-cola_fuze_tea_peach_global_500ml_original",
  "5000159408017": "local_coca-cola_glaceau_smartwater_vapor_distilled_global_1l_original",
  "5000159408024": "local_coca-cola_dasani_with_lemon_global_500ml_original",
  "5000159408031": "local_coca-cola_dasani_with_lime_global_500ml_original",
  "5000159408048": "local_coca-cola_coca-cola_coffee_global_330ml_original",
  "5000159408055": "local_coca-cola_coca-cola_energy_global_330ml_original",

  // === PEPSICO PRODUCTS (40 entries) ===
  "5000159408062": "local_pepsico_pepsi_max_global_330ml_zero_sugar",
  "5000159408079": "local_pepsico_pepsi_wild_cherry_global_330ml_original",
  "5000159408086": "local_pepsico_pepsi_diet_global_330ml_diet",
  "5000159408093": "local_pepsico_mountain_dew_original_global_330ml_original",
  "5000159408109": "local_pepsico_mountain_dew_zero_sugar_global_330ml_zero_sugar",
  "5000159408116": "local_pepsico_mountain_dew_baja_blast_global_330ml_original",
  "5000159408123": "local_pepsico_mountain_dew_code_red_global_330ml_original",
  "5000159408130": "local_pepsico_mountain_dew_voltage_global_330ml_original",
  "5000159408147": "local_pepsico_7up_original_global_330ml_original",
  "5000159408154": "local_pepsico_7up_zero_sugar_global_330ml_zero_sugar",
  "5000159408161": "local_pepsico_dr_pepper_original_global_330ml_original",
  "5000159408178": "local_pepsico_dr_pepper_zero_sugar_global_330ml_zero_sugar",
  "5000159408185": "local_pepsico_canada_dry_ginger_ale_global_330ml_original",
  "5000159408192": "local_pepsico_canada_dry_diet_ginger_ale_global_330ml_diet",
  "5000159408208": "local_pepsico_schweppes_tonic_water_global_330ml_original",
  "5000159408215": "local_pepsico_schweppes_ginger_ale_global_330ml_original",
  "5000159408222": "local_pepsico_aquafina_purified_water_global_500ml_original",
  "5000159408239": "local_pepsico_aquafina_with_lemon_global_500ml_original",
  "5000159408246": "local_pepsico_bubly_sparkling_water_original_global_355ml_original",
  "5000159408253": "local_pepsico_bubly_sparkling_water_lime_global_355ml_original",
  "5000159408260": "local_pepsico_bubly_sparkling_water_cherry_global_355ml_original",
  "5000159408277": "local_pepsico_bubly_sparkling_water_apple_global_355ml_original",
  "5000159408284": "local_pepsico_gatorade_thirst_quencher_orange_global_500ml_original",
  "5000159408291": "local_pepsico_gatorade_thirst_quencher_fruit_punch_global_500ml_original",
  "5000159408307": "local_pepsico_gatorade_zero_lemon_lime_global_500ml_zero_sugar",
  "5000159408314": "local_pepsico_gatorade_zero_glacier_cherry_global_500ml_zero_sugar",
  "5000159408321": "local_pepsico_propel_fitness_water_berry_global_500ml_original",
  "5000159408338": "local_pepsico_propel_fitness_water_kiwi_strawberry_global_500ml_original",
  "5000159408345": "local_pepsico_lipton_brisk_iced_tea_lemon_global_500ml_original",
  "5000159408352": "local_pepsico_lipton_brisk_iced_tea_raspberry_global_500ml_original",
  "5000159408369": "local_pepsico_lipton_brisk_iced_tea_half_lemon_global_500ml_original",
  "5000159408376": "local_pepsico_starry_lemon_lime_global_330ml_original",
  "5000159408383": "local_pepsico_starry_zero_sugar_global_330ml_zero_sugar",
  "5000159408390": "local_pepsico_sobe_lifewater_yumberry_pomegranate_global_500ml_original",
  "5000159408406": "local_pepsico_sobe_lifewater_green_tea_citrus_global_500ml_original",
  "5000159408413": "local_pepsico_naked_juice_green_machine_global_450ml_original",
  "5000159408420": "local_pepsico_naked_juice_blue_machine_global_450ml_original",
  "5000159408437": "local_pepsico_tropicana_pure_premium_orange_global_330ml_original",
  "5000159408444": "local_pepsico_tropicana_pure_premium_apple_global_330ml_original",
  "5000159408451": "local_pepsico_tropicana_trop50_orange_global_330ml_light",

  // === ENERGY DRINKS (45 entries) ===
  "8901234567890": "local_starbucks_frappuccino_coffee_global_281ml_original",
  "8901234567891": "local_red_bull_gmbh_red_bull_editions_tropical_global_250ml_original",
  "8901234567892": "local_ghost_lifestyle_ghost_energy_sour_patch_kids_global_473ml_original",
  "8901234567893": "local_alani_nu_alani_nu_energy_cosmic_stardust_global_355ml_original",
  "8901234567901": "local_reign_reign_total_body_fuel_raging_berry_global_473ml_original",
  "8901234567902": "local_c4_c4_smart_energy_iced_blue_raspberry_global_473ml_original",
  "8901234567903": "local_gfuel_gfuel_energy_formula_blue_ice_global_powder_original",
  "8901234567910": "local_red_bull_gmbh_red_bull_original_global_250ml_original",
  "8901234567927": "local_red_bull_gmbh_red_bull_sugarfree_global_250ml_zero_sugar",
  "8901234567934": "local_red_bull_gmbh_red_bull_editions_watermelon_global_250ml_original",
  "8901234567941": "local_red_bull_gmbh_red_bull_editions_coconut_berry_global_250ml_original",
  "8901234567958": "local_red_bull_gmbh_red_bull_editions_apricot_global_250ml_original",
  "8901234567965": "local_red_bull_gmbh_red_bull_editions_peach_nectarine_global_250ml_original",
  "8901234567972": "local_red_bull_gmbh_red_bull_editions_strawberry_apricot_global_250ml_original",
  "8901234567989": "local_monster_beverage_monster_energy_original_global_473ml_original",
  "8901234567996": "local_monster_beverage_monster_ultra_white_global_473ml_zero_sugar",
  "8901234568002": "local_monster_beverage_monster_ultra_red_global_473ml_zero_sugar",
  "8901234568019": "local_monster_beverage_monster_ultra_blue_global_473ml_zero_sugar",
  "8901234568026": "local_monster_beverage_monster_ultra_black_global_473ml_zero_sugar",
  "8901234568033": "local_monster_beverage_monster_mango_loco_global_473ml_original",
  "8901234568040": "local_monster_beverage_monster_pipeline_punch_global_473ml_original",
  "8901234568057": "local_monster_beverage_monster_zero_ultra_global_473ml_zero_sugar",
  "8901234568064": "local_monster_beverage_monster_java_locamoca_global_473ml_original",
  "8901234568071": "local_monster_beverage_monster_java_mean_bean_global_473ml_original",
  "8901234568088": "local_celsius_celsius_original_global_355ml_original",
  "8901234568095": "local_celsius_celsius_sparkling_orange_global_355ml_original",
  "8901234568101": "local_celsius_celsius_heat_global_355ml_original",
  "8901234568118": "local_celsius_celsius_bcaas_global_355ml_original",
  "8901234568125": "local_rockstar_rockstar_original_global_473ml_original",
  "8901234568132": "local_rockstar_rockstar_zero_sugar_global_473ml_zero_sugar",
  "8901234568149": "local_rockstar_rockstar_punched_global_473ml_original",
  "8901234568156": "local_rockstar_rockstar_recovery_global_473ml_original",
  "8901234568163": "local_bang_bang_energy_star_blast_global_473ml_original",
  "8901234568170": "local_bang_bang_energy_sour_heads_global_473ml_original",
  "8901234568187": "local_bang_bang_energy_super_creatine_global_473ml_original",
  "8901234568194": "local_prime_prime_energy_blue_raspberry_global_355ml_original",
  "8901234568200": "local_prime_prime_energy_tropical_punch_global_355ml_original",
  "8901234568217": "local_prime_prime_energy_ice_pop_global_355ml_original",
  "8901234568224": "local_ghost_lifestyle_ghost_energy_peach_rings_global_473ml_original",
  "8901234568231": "local_ghost_lifestyle_ghost_energy_warheads_global_473ml_original",
  "8901234568248": "local_ghost_lifestyle_ghost_energy_sonic_cherry_global_473ml_original",
  "8901234568255": "local_alani_nu_alani_nu_energy_breeze_berry_global_355ml_original",
  "8901234568262": "local_alani_nu_alani_nu_energy_mimosa_global_355ml_original",
  "8901234568279": "local_alani_nu_alani_nu_energy_hawaiian_shaved_ice_global_355ml_original",
  "8901234568286": "local_reign_reign_total_body_fuel_sour_apple_global_473ml_original",

  // === TEA & COFFEE DRINKS (35 entries) ===
  "8901234567894": "local_lipton_lipton_ice_tea_lemon_global_500ml_original",
  "8901234567895": "local_arizona_arizona_green_tea_global_680ml_original",
  "8901234567896": "local_pure_leaf_pure_leaf_sweet_tea_global_500ml_original",
  "8901234568293": "local_lipton_lipton_ice_tea_peach_global_500ml_original",
  "8901234568309": "local_lipton_lipton_ice_tea_raspberry_global_500ml_original",
  "8901234568316": "local_lipton_lipton_ice_tea_mango_global_500ml_original",
  "8901234568323": "local_arizona_arizona_iced_tea_lemon_global_680ml_original",
  "8901234568330": "local_arizona_arizona_iced_tea_peach_global_680ml_original",
  "8901234568347": "local_arizona_arizona_iced_tea_raspberry_global_680ml_original",
  "8901234568354": "local_arizona_arizona_mucho_mango_global_680ml_original",
  "8901234568361": "local_pure_leaf_pure_leaf_unsweetened_tea_global_500ml_unsweetened",
  "8901234568378": "local_pure_leaf_pure_leaf_green_tea_global_500ml_original",
  "8901234568385": "local_pure_leaf_pure_leaf_black_tea_global_500ml_original",
  "8901234568392": "local_starbucks_starbucks_doubleshot_energy_coffee_global_222ml_original",
  "8901234568408": "local_starbucks_starbucks_doubleshot_energy_mocha_global_222ml_original",
  "8901234568415": "local_starbucks_starbucks_doubleshot_energy_vanilla_global_222ml_original",
  "8901234568422": "local_starbucks_starbucks_frappuccino_mocha_global_281ml_original",
  "8901234568439": "local_starbucks_starbucks_frappuccino_vanilla_global_281ml_original",
  "8901234568446": "local_starbucks_starbucks_frappuccino_caramel_global_281ml_original",
  "8901234568453": "local_starbucks_starbucks_cold_brew_black_global_325ml_original",
  "8901234568460": "local_starbucks_starbucks_cold_brew_vanilla_global_325ml_original",
  "8901234568477": "local_starbucks_starbucks_cold_brew_caramel_global_325ml_original",
  "8901234568484": "local_dunkin_dunkin_original_iced_coffee_global_414ml_original",
  "8901234568491": "local_dunkin_dunkin_vanilla_iced_coffee_global_414ml_original",
  "8901234568507": "local_dunkin_dunkin_mocha_iced_coffee_global_414ml_original",
  "8901234568514": "local_nestea_nestea_iced_tea_lemon_global_500ml_original",
  "8901234568521": "local_nestea_nestea_iced_tea_peach_global_500ml_original",
  "8901234568538": "local_nestea_nestea_iced_tea_raspberry_global_500ml_original",
  "8901234568545": "local_gold_peak_gold_peak_iced_tea_lemon_global_500ml_original",
  "8901234568552": "local_gold_peak_gold_peak_iced_tea_peach_global_500ml_original",
  "8901234568569": "local_gold_peak_gold_peak_iced_tea_sweet_global_500ml_original",
  "8901234568576": "local_tazo_tazo_iced_tea_lemon_global_473ml_original",
  "8901234568583": "local_tazo_tazo_iced_tea_peach_global_473ml_original",
  "8901234568590": "local_tazo_tazo_iced_tea_passion_global_473ml_original",
  "8901234568606": "local_tazo_tazo_iced_tea_green_global_473ml_original",

  // === ASIAN DRINKS (30 entries) ===
  "8901234567897": "local_otsuka_pocari_sweat_global_500ml_original",
  "8901234567898": "local_calpico_calpico_original_global_473ml_original",
  "8901234567899": "local_hata_ramune_original_global_200ml_original",
  "8901234567900": "local_suntory_suntory_oolong_tea_global_500ml_original",
  "8901234568613": "local_otsuka_pocari_sweat_grapefruit_global_500ml_original",
  "8901234568620": "local_otsuka_pocari_sweat_lychee_global_500ml_original",
  "8901234568637": "local_calpico_calpico_strawberry_global_473ml_original",
  "8901234568644": "local_calpico_calpico_grape_global_473ml_original",
  "8901234568651": "local_calpico_calpico_yuzu_global_473ml_original",
  "8901234568668": "local_hata_ramune_strawberry_global_200ml_original",
  "8901234568675": "local_hata_ramune_grape_global_200ml_original",
  "8901234568682": "local_hata_ramune_melon_global_200ml_original",
  "8901234568699": "local_suntory_suntory_green_tea_global_500ml_original",
  "8901234568705": "local_suntory_suntory_jasmine_tea_global_500ml_original",
  "8901234568712": "local_suntory_suntory_black_tea_global_500ml_original",
  "8901234568729": "local_ito_en_oi_ocha_green_tea_global_500ml_original",
  "8901234568736": "local_ito_en_oi_ocha_jasmine_tea_global_500ml_original",
  "8901234568743": "local_ito_en_oi_ocha_hojicha_global_500ml_original",
  "8901234568750": "local_kirin_kirin_lemon_tea_global_500ml_original",
  "8901234568767": "local_kirin_kirin_milk_coffee_global_250ml_original",
  "8901234568774": "local_kirin_kirin_fire_coffee_global_250ml_original",
  "8901234568781": "local_dydo_dydo_coffee_original_global_250ml_original",
  "8901234568798": "local_dydo_dydo_coffee_sweet_global_250ml_original",
  "8901234568804": "local_sangaria_sangaria_ramune_original_global_200ml_original",
  "8901234568811": "local_sangaria_sangaria_ramune_strawberry_global_200ml_original",
  "8901234568828": "local_sangaria_sangaria_ramune_melon_global_200ml_original",
  "8901234568835": "local_boss_boss_coffee_rainbow_mountain_global_250ml_original",
  "8901234568842": "local_boss_boss_coffee_black_global_250ml_original",
  "8901234568859": "local_boss_boss_coffee_latte_global_250ml_original",
  "8901234568866": "local_boss_boss_coffee_vanilla_global_250ml_original",

  // === SPARKLING WATER (25 entries) ===
  "8901234567904": "local_lacroix_lacroix_sparkling_water_pure_global_355ml_original",
  "8901234567905": "local_pepsico_bubly_sparkling_water_lime_global_355ml_original",
  "8901234567906": "local_spindrift_sparkling_water_lemon_global_355ml_original",
  "8901234568873": "local_lacroix_lacroix_sparkling_water_lime_global_355ml_original",
  "8901234568880": "local_lacroix_lacroix_sparkling_water_cherry_global_355ml_original",
  "8901234568897": "local_lacroix_lacroix_sparkling_water_grapefruit_global_355ml_original",
  "8901234568903": "local_lacroix_lacroix_sparkling_water_pomegranate_global_355ml_original",
  "8901234568910": "local_lacroix_lacroix_sparkling_water_coconut_global_355ml_original",
  "8901234568927": "local_pepsico_bubly_sparkling_water_original_global_355ml_original",
  "8901234568934": "local_pepsico_bubly_sparkling_water_cherry_global_355ml_original",
  "8901234568941": "local_pepsico_bubly_sparkling_water_grapefruit_global_355ml_original",
  "8901234568958": "local_pepsico_bubly_sparkling_water_strawberry_global_355ml_original",
  "8901234568965": "local_spindrift_sparkling_water_grapefruit_global_355ml_original",
  "8901234568972": "local_spindrift_sparkling_water_cherry_global_355ml_original",
  "8901234568989": "local_spindrift_sparkling_water_raspberry_lime_global_355ml_original",
  "8901234568996": "local_spindrift_sparkling_water_pineapple_global_355ml_original",
  "8901234569002": "local_aura_bora_aura_bora_aqua_global_355ml_original",
  "8901234569019": "local_aura_bora_aura_bora_grapefruit_global_355ml_original",
  "8901234569026": "local_aura_bora_aura_bora_basil_lemon_global_355ml_original",
  "8901234569033": "local_hint_hint_water_blackberry_global_473ml_original",
  "8901234569040": "local_hint_hint_water_watermelon_global_473ml_original",
  "8901234569057": "local_hint_hint_water_cherry_global_473ml_original",
  "8901234569064": "local_hint_hint_water_pineapple_global_473ml_original",
  "8901234569071": "local_liquid_death_liquid_death_still_water_global_500ml_original",
  "8901234569088": "local_liquid_death_liquid_death_sparkling_water_global_500ml_original",

  // === KENYAN & AFRICAN BRANDS (40 entries) ===
  "6130000000001": "local_coca-cola_ke_stoney_tangawizi_ke_330ml_original",
  "6130000000002": "local_eabu_ke_tusker_lager_ke_500ml_original",
  "6130000000003": "local_brookside_ke_brookside_fresh_milk_ke_500ml_original",
  "6130000000004": "local_keringet_ke_keringet_natural_spring_water_ke_500ml_original",
  "6130000000005": "local_chai_bora_ke_chai_bora_masala_chai_ke_250ml_original",
  "6130000000006": "local_big_beverages_ke_big_soda_cream_ke_330ml_original",
  "6130000000007": "local_safaricom_ke_malo_malt_ke_330ml_original",
  "6130000000008": "local_nairobi_bottlers_ke_kingfisher_lager_ke_500ml_original",
  "6130000000009": "local_pioneer_ke_pioneer_soda_ke_330ml_original",
  "6130000000010": "local_riham_ke_riham_cola_ke_500ml_original",
  "6130000000011": "local_coca-cola_ke_coca-cola_classic_ke_330ml_original",
  "6130000000012": "local_coca-cola_ke_sprite_ke_330ml_original",
  "6130000000013": "local_coca-cola_ke_fanta_orange_ke_330ml_original",
  "6130000000014": "local_coca-cola_ke_coca-cola_zero_ke_330ml_zero_sugar",
  "6130000000015": "local_eabu_ke_tusker_lite_ke_500ml_light",
  "6130000000016": "local_eabu_ke_tusker_malt_ke_330ml_original",
  "6130000000017": "local_eabu_ke_guinness_ke_500ml_original",
  "6130000000018": "local_eabu_ke_serena_ke_500ml_original",
  "6130000000019": "local_brookside_ke_brookside_lala_ke_250ml_original",
  "6130000000020": "local_brookside_ke_brookside_yoghurt_strawberry_ke_250ml_original",
  "6130000000021": "local_brookside_ke_brookside_yoghurt_vanilla_ke_250ml_original",
  "6130000000022": "local_brookside_ke_brookside_fresh_milk_low_fat_ke_500ml_light",
  "6130000000023": "local_keringet_ke_keringet_spring_water_lemon_ke_500ml_original",
  "6130000000024": "local_keringet_ke_keringet_spring_water_lime_ke_500ml_original",
  "6130000000025": "local_chai_bora_ke_chai_bora_plain_chai_ke_250ml_original",
  "6130000000026": "local_chai_bora_ke_chai_bora_cardamom_chai_ke_250ml_original",
  "6130000000027": "local_big_beverages_ke_big_soda_orange_ke_330ml_original",
  "6130000000028": "local_big_beverages_ke_big_soda_grape_ke_330ml_original",
  "6130000000029": "local_safaricom_ke_malo_malt_chocolate_ke_330ml_original",
  "6130000000030": "local_nairobi_bottlers_ke_pilsner_ke_500ml_original",
  "6130000000031": "local_nairobi_bottlers_ke_white_cap_ke_500ml_original",
  "6130000000032": "local_pioneer_ke_pioneer_orange_ke_330ml_original",
  "6130000000033": "local_pioneer_ke_pioneer_grape_ke_330ml_original",
  "6130000000034": "local_riham_ke_riham_orange_ke_500ml_original",
  "6130000000035": "local_riham_ke_riham_grape_ke_500ml_original",
  "6130000000036": "local_keroche_ke_keroche_summit_lager_ke_500ml_original",
  "6130000000037": "local_keroche_ke_keroche_summit_pilsner_ke_500ml_original",
  "6130000000038": "local_keroche_ke_keroche_summit_stout_ke_500ml_original",
  "6130000000039": "local_savanna_ke_savanna_dry_cider_ke_330ml_original",
  "6130000000040": "local_savanna_ke_savanna_light_cider_ke_330ml_light",

  // === PREMIUM WATER BRANDS (20 entries) ===
  "8901234569095": "local_evian_evian_natural_spring_water_global_500ml_original",
  "8901234569101": "local_evian_evian_natural_spring_water_global_1l_original",
  "8901234569118": "local_fiji_fiji_natural_artesian_water_global_500ml_original",
  "8901234569125": "local_fiji_fiji_natural_artesian_water_global_1l_original",
  "8901234569132": "local_voss_voss_still_water_global_375ml_original",
  "8901234569149": "local_voss_voss_sparkling_water_global_375ml_original",
  "8901234569156": "local_perrier_perrier_natural_sparkling_water_global_330ml_original",
  "8901234569163": "local_perrier_perrier_natural_sparkling_water_lemon_global_330ml_original",
  "8901234569170": "local_perrier_perrier_natural_sparkling_water_lime_global_330ml_original",
  "8901234569187": "local_san_pellegrino_san_pellegrino_sparkling_water_global_500ml_original",
  "8901234569194": "local_san_pellegrino_san_pellegrino_sparkling_water_lemon_global_500ml_original",
  "8901234569200": "local_san_pellegrino_san_pellegrino_sparkling_water_orange_global_500ml_original",
  "8901234569217": "local_acqua_panna_acqua_panna_natural_spring_water_global_500ml_original",
  "8901234569224": "local_acqua_panna_acqua_panna_natural_spring_water_global_1l_original",
  "8901234569231": "local_gerolsteiner_gerolsteiner_natural_mineral_water_global_500ml_original",
  "8901234569248": "local_gerolsteiner_gerolsteiner_natural_mineral_water_global_1l_original",
  "8901234569255": "local_vittel_vittel_natural_mineral_water_global_500ml_original",
  "8901234569262": "local_vittel_vittel_natural_mineral_water_global_1l_original",
  "8901234569279": "local_badoit_badoit_natural_sparkling_water_global_330ml_original",
  "8901234569286": "local_badoit_badoit_natural_sparkling_water_global_750ml_original",
};

// ============================================================================
// OCR KEYWORD INDEX - FULL
// ============================================================================

export const OCR_KEYWORD_INDEX: Record<string, { id: string; weight: number }[]> = {
  // === COCA-COLA KEYWORDS ===
  "cocacola": [{ "id": "local_coca-cola_coca-cola_classic_global_330ml_original", "weight": 1.0 }],
  "coke": [{ "id": "local_coca-cola_coca-cola_classic_global_330ml_original", "weight": 0.9 }],
  "coca cola": [{ "id": "local_coca-cola_coca-cola_classic_global_330ml_original", "weight": 1.0 }],
  "sprite": [{ "id": "local_coca-cola_sprite_global_330ml_original", "weight": 1.0 }],
  "fanta": [{ "id": "local_coca-cola_fanta_orange_global_330ml_original", "weight": 1.0 }],
  "minute maid": [{ "id": "local_coca-cola_minute_maid_pulpy_orange_global_330ml_original", "weight": 0.95 }],
  "powerade": [{ "id": "local_coca-cola_powerade_mountain_berry_global_500ml_original", "weight": 0.95 }],
  "vitaminwater": [{ "id": "local_coca-cola_vitaminwater_xxx_acai_blueberry_pomegranate_global_500ml_original", "weight": 0.95 }],
  "smartwater": [{ "id": "local_coca-cola_smartwater_global_700ml_original", "weight": 1.0 }],
  "dasani": [{ "id": "local_coca-cola_dasani_global_500ml_original", "weight": 1.0 }],
  "honest tea": [{ "id": "local_coca-cola_honest_tea_organic_half_tea_half_lemon_global_500ml_original", "weight": 0.95 }],
  "bodyarmor": [{ "id": "local_coca-cola_bodyarmor_sports_drink_fruit_punch_global_500ml_original", "weight": 0.95 }],
  "topo chico": [{ "id": "local_coca-cola_topo_chico_mineral_water_original_global_355ml_original", "weight": 0.95 }],

  // === PEPSICO KEYWORDS ===
  "pepsi": [{ "id": "local_pepsico_pepsi_global_330ml_original", "weight": 1.0 }],
  "mountain dew": [{ "id": "local_pepsico_mountain_dew_original_global_330ml_original", "weight": 1.0 }],
  "7up": [{ "id": "local_pepsico_7up_original_global_330ml_original", "weight": 1.0 }],
  "dr pepper": [{ "id": "local_pepsico_dr_pepper_original_global_330ml_original", "weight": 1.0 }],
  "canada dry": [{ "id": "local_pepsico_canada_dry_ginger_ale_global_330ml_original", "weight": 1.0 }],
  "schweppes": [{ "id": "local_pepsico_schweppes_tonic_water_global_330ml_original", "weight": 0.95 }],
  "aquafina": [{ "id": "local_pepsico_aquafina_purified_water_global_500ml_original", "weight": 1.0 }],
  "bubly": [{ "id": "local_pepsico_bubly_sparkling_water_original_global_355ml_original", "weight": 1.0 }],
  "gatorade": [{ "id": "local_pepsico_gatorade_lemon_lime_global_500ml_original", "weight": 1.0 }],
  "propel": [{ "id": "local_pepsico_propel_fitness_water_berry_global_500ml_original", "weight": 0.95 }],
  "naked juice": [{ "id": "local_pepsico_naked_juice_green_machine_global_450ml_original", "weight": 0.95 }],
  "tropicana": [{ "id": "local_pepsico_tropicana_pure_premium_orange_global_330ml_original", "weight": 0.95 }],

  // === ENERGY DRINK KEYWORDS ===
  "red bull": [{ "id": "local_red_bull_gmbh_red_bull_original_global_330ml_original", "weight": 1.0 }],
  "monster energy": [{ "id": "local_monster_beverage_monster_energy_global_330ml_original", "weight": 1.0 }],
  "celsius": [{ "id": "local_celsius_celsius_original_global_355ml_original", "weight": 1.0 }],
  "rockstar": [{ "id": "local_rockstar_rockstar_original_global_473ml_original", "weight": 1.0 }],
  "bang energy": [{ "id": "local_bang_bang_energy_star_blast_global_473ml_original", "weight": 1.0 }],
  "prime energy": [{ "id": "local_prime_prime_energy_blue_raspberry_global_355ml_original", "weight": 1.0 }],
  "ghost energy": [{ "id": "local_ghost_lifestyle_ghost_energy_sour_patch_kids_global_473ml_original", "weight": 1.0 }],
  "alani nu": [{ "id": "local_alani_nu_alani_nu_energy_cosmic_stardust_global_355ml_original", "weight": 1.0 }],
  "reign energy": [{ "id": "local_reign_reign_total_body_fuel_raging_berry_global_473ml_original", "weight": 1.0 }],
  "c4 energy": [{ "id": "local_c4_c4_smart_energy_iced_blue_raspberry_global_473ml_original", "weight": 1.0 }],
  "gfuel": [{ "id": "local_gfuel_gfuel_energy_formula_blue_ice_global_powder_original", "weight": 1.0 }],

  // === TEA & COFFEE KEYWORDS ===
  "lipton ice tea": [{ "id": "local_lipton_lipton_ice_tea_lemon_global_500ml_original", "weight": 1.0 }],
  "arizona tea": [{ "id": "local_arizona_arizona_green_tea_global_680ml_original", "weight": 1.0 }],
  "pure leaf": [{ "id": "local_pure_leaf_pure_leaf_sweet_tea_global_500ml_original", "weight": 1.0 }],
  "starbucks frappuccino": [{ "id": "local_starbucks_frappuccino_coffee_global_281ml_original", "weight": 1.0 }],

  // === ASIAN DRINK KEYWORDS ===
  "pocari sweat": [{ "id": "local_otsuka_pocari_sweat_global_500ml_original", "weight": 1.0 }],
  "calpico": [{ "id": "local_calpico_calpico_original_global_473ml_original", "weight": 1.0 }],
  "ramune": [{ "id": "local_hata_ramune_original_global_200ml_original", "weight": 1.0 }],
  "suntory oolong": [{ "id": "local_suntory_suntory_oolong_tea_global_500ml_original", "weight": 1.0 }],

  // === SPARKLING WATER KEYWORDS ===
  "lacroix": [{ "id": "local_lacroix_lacroix_sparkling_water_pure_global_355ml_original", "weight": 1.0 }],
  "spindrift": [{ "id": "local_spindrift_sparkling_water_lemon_global_355ml_original", "weight": 1.0 }],
  "liquid death": [{ "id": "local_liquid_death_liquid_death_still_water_global_500ml_original", "weight": 1.0 }],

  // === KENYAN & AFRICAN KEYWORDS ===
  "stoney tangawizi": [{ "id": "local_coca-cola_ke_stoney_tangawizi_ke_330ml_original", "weight": 1.0 }],
  "tusker": [{ "id": "local_eabu_ke_tusker_lager_ke_500ml_original", "weight": 1.0 }],
  "brookside": [{ "id": "local_brookside_ke_brookside_fresh_milk_ke_500ml_original", "weight": 1.0 }],
  "keringet": [{ "id": "local_keringet_ke_keringet_natural_spring_water_ke_500ml_original", "weight": 1.0 }],

  // === PREMIUM WATER KEYWORDS ===
  "evian": [{ "id": "local_evian_evian_natural_spring_water_global_500ml_original", "weight": 1.0 }],
};

// ============================================================================
// BASE TEMPLATES - FULL DATA
// ============================================================================

export const BASE_TEMPLATES: BaseDrinkTemplate[] = [
  {
    id: "local_coca-cola_coca-cola_classic_global_330ml_original",
    name: 'Coca-Cola Classic',
    brand: 'Coca-Cola',
    category: 'soda',
    subcategory: 'cola',
    liquidType: 'beverage',
    impactScore: 30,
    hydrationLevel: 30,
    glycemicImpact: 'high',
    calories: 45,
    sugar: 11,
    caffeine: 10,
    sodium: 10,
    fat: 0,
    protein: 0,
    servingSize: 100,
    servingUnit: 'ml',
    additives: ['E211', 'E330', 'Caramel Color'],
    ingredients: [
      { name: 'Carbonated Water', function: 'Base', healthRole: 'neutral', riskLevel: 'low', description: 'Provides effervescence', source: 'Filtered', organic: false, allergen: false },
      { name: 'High Fructose Corn Syrup', function: 'Sweetener', healthRole: 'quick-energy', riskLevel: 'moderate', description: 'Primary sweetener', source: 'Corn', organic: false, allergen: false },
      { name: 'Caramel Color', function: 'Color', healthRole: 'neutral', riskLevel: 'low', description: 'Provides brown color', source: 'Sugar', organic: false, allergen: false },
      { name: 'Phosphoric Acid', function: 'Acidifier', healthRole: 'neutral', riskLevel: 'low', description: 'Adds tartness', source: 'Mineral', organic: false, allergen: false },
      { name: 'Natural Flavors', function: 'Flavor', healthRole: 'neutral', riskLevel: 'low', description: 'Proprietary blend', source: 'Natural', organic: false, allergen: false },
      { name: 'Caffeine', function: 'Stimulant', healthRole: 'alertness', riskLevel: 'low', description: 'Mild stimulant', source: 'Coffee beans', organic: false, allergen: false }
    ],
    alternatives: ['Water', 'Sparkling Water', 'Unsweetened Tea', 'Coca-Cola Zero Sugar'],
    keywords: ["coca-cola classic", "coca-cola", "soda", "cola", "coke"],
    notes: 'The original Coca-Cola formula. Classic taste with caffeine.',
    healthBenefits: ['Quick energy boost', 'Caffeine for alertness'],
    warnings: ['High sugar content', 'Acidic - may affect tooth enamel', 'Not suitable for diabetics'],
    origin: 'Global',
    dietaryFlags: ['vegetarian'],
    sustainabilityScore: 45,
  },
  {
    id: "local_pepsico_pepsi_global_330ml_original",
    name: 'Pepsi',
    brand: 'PepsiCo',
    category: 'soda',
    subcategory: 'cola',
    liquidType: 'beverage',
    impactScore: 31,
    hydrationLevel: 31,
    glycemicImpact: 'high',
    calories: 41,
    sugar: 10.2,
    caffeine: 10,
    sodium: 9,
    fat: 0,
    protein: 0,
    servingSize: 100,
    servingUnit: 'ml',
    additives: ['E211', 'E330', 'Caramel Color'],
    ingredients: [
      { name: 'Carbonated Water', function: 'Base', healthRole: 'neutral', riskLevel: 'low', description: 'Provides effervescence', source: 'Filtered', organic: false, allergen: false },
      { name: 'High Fructose Corn Syrup', function: 'Sweetener', healthRole: 'quick-energy', riskLevel: 'moderate', description: 'Primary sweetener', source: 'Corn', organic: false, allergen: false },
      { name: 'Caramel Color', function: 'Color', healthRole: 'neutral', riskLevel: 'low', description: 'Provides brown color', source: 'Sugar', organic: false, allergen: false },
      { name: 'Phosphoric Acid', function: 'Acidifier', healthRole: 'neutral', riskLevel: 'low', description: 'Adds tartness', source: 'Mineral', organic: false, allergen: false },
      { name: 'Caffeine', function: 'Stimulant', healthRole: 'alertness', riskLevel: 'low', description: 'Mild stimulant', source: 'Coffee beans', organic: false, allergen: false },
      { name: 'Natural Flavors', function: 'Flavor', healthRole: 'neutral', riskLevel: 'low', description: 'Proprietary blend', source: 'Natural', organic: false, allergen: false }
    ],
    alternatives: ['Water', 'Sparkling Water', 'Unsweetened Tea', 'Pepsi Zero Sugar'],
    keywords: ["pepsi", "cola", "pepsico", "soda"],
    notes: 'Classic Pepsi taste with a hint of citrus. Contains caffeine.',
    healthBenefits: ['Quick energy boost', 'Caffeine for alertness'],
    warnings: ['High sugar content', 'Acidic - may affect tooth enamel'],
    origin: 'Global',
    dietaryFlags: ['vegetarian'],
    sustainabilityScore: 46,
  },
  {
    id: "local_red_bull_gmbh_red_bull_original_global_330ml_original",
    name: 'Red Bull Original',
    brand: 'Red Bull GmbH',
    category: 'energy',
    subcategory: 'energy',
    liquidType: 'beverage',
    impactScore: 25,
    hydrationLevel: 25,
    glycemicImpact: 'high',
    calories: 45,
    sugar: 11,
    caffeine: 32,
    sodium: 10,
    fat: 0,
    protein: 0,
    servingSize: 100,
    servingUnit: 'ml',
    additives: ['E211', 'E330', 'Taurine', 'B-Vitamins', 'Glucuronolactone'],
    ingredients: [
      { name: 'Water', function: 'Base', healthRole: 'neutral', riskLevel: 'low', description: 'Primary liquid base', source: 'Filtered', organic: false, allergen: false },
      { name: 'Sucrose', function: 'Energy', healthRole: 'quick-energy', riskLevel: 'moderate', description: 'Primary sugar source', source: 'Sugar cane', organic: false, allergen: false },
      { name: 'Glucose', function: 'Energy', healthRole: 'quick-energy', riskLevel: 'moderate', description: 'Fast-acting carbohydrate', source: 'Corn', organic: false, allergen: false },
      { name: 'Caffeine', function: 'Stimulant', healthRole: 'alertness', riskLevel: 'moderate', description: 'Central nervous system stimulant', source: 'Synthetic', organic: false, allergen: false },
      { name: 'Taurine', function: 'Amino Acid', healthRole: 'metabolic-support', riskLevel: 'low', description: 'Conditionally essential amino acid', source: 'Synthetic', organic: false, allergen: false },
      { name: 'B-Vitamins', function: 'Metabolic Cofactors', healthRole: 'energy-metabolism', riskLevel: 'low', description: 'Support energy production', source: 'Synthetic', organic: false, allergen: false },
      { name: 'Glucuronolactone', function: 'Detox Support', healthRole: 'liver-support', riskLevel: 'low', description: 'Natural compound in metabolism', source: 'Synthetic', organic: false, allergen: false }
    ],
    alternatives: ['Water', 'Green Tea', 'Black Coffee', 'Red Bull Sugarfree'],
    keywords: ["red bull", "energy drink", "taurine", "caffeine"],
    notes: 'Original energy drink formula. Gives you wings with caffeine, taurine, and B-vitamins.',
    healthBenefits: ['Quick mental alertness', 'Physical energy boost', 'B-vitamin support'],
    warnings: ['High caffeine content', 'High sugar', 'Not recommended for children', 'Limit consumption'],
    origin: 'Austria',
    dietaryFlags: ['vegetarian'],
    sustainabilityScore: 38,
  },
  {
    id: "local_lipton_lipton_ice_tea_lemon_global_500ml_original",
    name: 'Lipton Ice Tea Lemon',
    brand: 'Lipton',
    category: 'tea',
    subcategory: 'iced-tea',
    liquidType: 'beverage',
    impactScore: 40,
    hydrationLevel: 55,
    glycemicImpact: 'moderate',
    calories: 35,
    sugar: 8.5,
    caffeine: 12,
    sodium: 8,
    fat: 0,
    protein: 0,
    servingSize: 100,
    servingUnit: 'ml',
    additives: ['E330', 'Natural Flavors', 'Ascorbic Acid'],
    ingredients: [
      { name: 'Water', function: 'Base', healthRole: 'neutral', riskLevel: 'low', description: 'Primary liquid base', source: 'Filtered', organic: false, allergen: false },
      { name: 'Black Tea Extract', function: 'Flavor/Caffeine', healthRole: 'antioxidant', riskLevel: 'low', description: 'Provides tea flavor and polyphenols', source: 'Camellia sinensis', organic: false, allergen: false },
      { name: 'Sugar', function: 'Sweetener', healthRole: 'energy', riskLevel: 'moderate', description: 'Primary sweetener', source: 'Sugar cane', organic: false, allergen: false },
      { name: 'Citric Acid', function: 'Acidifier', healthRole: 'neutral', riskLevel: 'low', description: 'Adds lemon tartness', source: 'Citrus', organic: false, allergen: false },
      { name: 'Natural Lemon Flavor', function: 'Flavor', healthRole: 'neutral', riskLevel: 'low', description: 'Lemon essence', source: 'Lemon', organic: false, allergen: false },
      { name: 'Ascorbic Acid (Vitamin C)', function: 'Antioxidant', healthRole: 'immune-support', riskLevel: 'low', description: 'Vitamin C fortification', source: 'Synthetic', organic: false, allergen: false }
    ],
    alternatives: ['Unsweetened Iced Tea', 'Water with Lemon', 'Sparkling Water', 'Green Tea'],
    keywords: ["lipton ice tea", "lipton lemon", "iced tea", "bottled tea", "lemon tea"],
    notes: 'Ready-to-drink black tea beverage with lemon flavor. Refreshing and lightly sweetened.',
    healthBenefits: ['Antioxidants from tea', 'Vitamin C', 'Moderate caffeine'],
    warnings: ['Contains sugar', 'Acidic - may affect tooth enamel'],
    origin: 'Global',
    dietaryFlags: ['vegetarian', 'vegan'],
    sustainabilityScore: 52,
  },
  {
    id: "local_otsuka_pocari_sweat_global_500ml_original",
    name: 'Pocari Sweat',
    brand: 'Otsuka Pharmaceutical',
    category: 'sports',
    subcategory: 'ion-supply',
    liquidType: 'beverage',
    impactScore: 70,
    hydrationLevel: 92,
    glycemicImpact: 'low',
    calories: 25,
    sugar: 6,
    caffeine: 0,
    sodium: 49,
    fat: 0,
    protein: 0,
    servingSize: 100,
    servingUnit: 'ml',
    additives: ['Acidity Regulator', 'Minerals', 'Electrolytes'],
    ingredients: [
      { name: 'Water', function: 'Base', healthRole: 'neutral', riskLevel: 'low', description: 'Primary liquid base', source: 'Filtered', organic: false, allergen: false },
      { name: 'Sucrose', function: 'Energy', healthRole: 'quick-energy', riskLevel: 'low', description: 'Mild energy source', source: 'Sugar cane', organic: false, allergen: false },
      { name: 'Glucose', function: 'Energy', healthRole: 'quick-energy', riskLevel: 'low', description: 'Fast-absorbing carbohydrate', source: 'Corn', organic: false, allergen: false },
      { name: 'Sodium Chloride', function: 'Electrolyte', healthRole: 'rehydration', riskLevel: 'low', description: 'Replaces sodium lost in sweat', source: 'Mineral', organic: false, allergen: false },
      { name: 'Potassium Chloride', function: 'Electrolyte', healthRole: 'rehydration', riskLevel: 'low', description: 'Supports muscle function', source: 'Mineral', organic: false, allergen: false },
      { name: 'Calcium Lactate', function: 'Electrolyte', healthRole: 'bone-support', riskLevel: 'low', description: 'Supports bone health', source: 'Mineral', organic: false, allergen: false },
      { name: 'Magnesium Carbonate', function: 'Electrolyte', healthRole: 'muscle-support', riskLevel: 'low', description: 'Supports muscle relaxation', source: 'Mineral', organic: false, allergen: false }
    ],
    alternatives: ['Water', 'Coconut Water', 'Homemade ORS', 'Other electrolyte drinks'],
    keywords: ["pocari sweat", "otsuka", "ion supply drink", "japanese sports drink", "electrolyte"],
    notes: 'Popular Japanese ion supply drink. Designed for rapid rehydration with balanced electrolytes.',
    healthBenefits: ['Rapid rehydration', 'Electrolyte replenishment', 'Low sugar formula'],
    warnings: ['Contains sodium - monitor if on low-sodium diet'],
    origin: 'Japan',
    dietaryFlags: ['vegetarian', 'vegan'],
    sustainabilityScore: 58,
  },
  {
    id: "local_lacroix_lacroix_sparkling_water_pure_global_355ml_original",
    name: 'LaCroix Sparkling Water Pure',
    brand: 'LaCroix',
    category: 'water',
    subcategory: 'sparkling-natural',
    liquidType: 'beverage',
    impactScore: 99,
    hydrationLevel: 100,
    glycemicImpact: 'low',
    calories: 0,
    sugar: 0,
    caffeine: 0,
    sodium: 0,
    fat: 0,
    protein: 0,
    servingSize: 100,
    servingUnit: 'ml',
    additives: [],
    ingredients: [
      { name: 'Carbonated Water', function: 'Base', healthRole: 'neutral', riskLevel: 'low', description: 'Naturally carbonated water', source: 'Spring', organic: false, allergen: false },
      { name: 'Natural Essence', function: 'Flavor', healthRole: 'neutral', riskLevel: 'low', description: 'Natural fruit essences', source: 'Fruit', organic: false, allergen: false }
    ],
    alternatives: ['Tap Water', 'Still Water', 'Homemade Infused Water', 'Other sparkling waters'],
    keywords: ["lacroix", "la croix", "sparkling water", "natural essence", "zero calorie"],
    notes: 'Zero-calorie sparkling water with natural essences. No sweeteners, sodium, or artificial ingredients.',
    healthBenefits: ['Zero calories', 'Zero sugar', 'Hydrating', 'No artificial ingredients'],
    certifications: ['Non-GMO', 'Gluten-Free'],
    origin: 'USA',
    dietaryFlags: ['vegetarian', 'vegan', 'gluten-free', 'keto', 'paleo'],
    sustainabilityScore: 72,
  },
  {
    id: "local_coca-cola_ke_stoney_tangawizi_ke_330ml_original",
    name: 'Stoney Tangawizi',
    brand: 'Coca-Cola Kenya',
    category: 'soda',
    subcategory: 'ginger-soda',
    liquidType: 'beverage',
    impactScore: 35,
    hydrationLevel: 38,
    glycemicImpact: 'high',
    calories: 40,
    sugar: 10,
    caffeine: 0,
    sodium: 12,
    fat: 0,
    protein: 0,
    servingSize: 100,
    servingUnit: 'ml',
    additives: ['E211', 'E330', 'Ginger Extract', 'Natural Flavors'],
    ingredients: [
      { name: 'Carbonated Water', function: 'Base', healthRole: 'neutral', riskLevel: 'low', description: 'Provides effervescence', source: 'Filtered', organic: false, allergen: false },
      { name: 'Sugar', function: 'Sweetener', healthRole: 'energy', riskLevel: 'moderate', description: 'Primary sweetener', source: 'Sugar cane', organic: false, allergen: false },
      { name: 'Ginger Extract', function: 'Flavor/Digestive', healthRole: 'traditional', riskLevel: 'low', description: 'Traditional ginger flavor with digestive benefits', source: 'Ginger root', organic: false, allergen: false },
      { name: 'Citric Acid', function: 'Acidifier', healthRole: 'neutral', riskLevel: 'low', description: 'Adds tartness', source: 'Citrus', organic: false, allergen: false },
      { name: 'Natural Flavors', function: 'Flavor', healthRole: 'neutral', riskLevel: 'low', description: 'Proprietary blend', source: 'Natural', organic: false, allergen: false }
    ],
    alternatives: ['Ginger Tea', 'Water with Fresh Ginger', 'Sparkling Water', 'Unsweetened Ginger Ale'],
    keywords: ["stoney tangawizi", "tangawizi", "kenyan ginger soda", "coca-cola kenya", "ginger drink"],
    notes: 'Popular Kenyan ginger-flavored carbonated soft drink. "Tangawizi" means ginger in Swahili.',
    healthBenefits: ['Ginger may support digestion', 'Caffeine-free', 'Refreshing'],
    warnings: ['High sugar content', 'Acidic - may affect tooth enamel'],
    origin: 'Kenya',
    dietaryFlags: ['vegetarian', 'vegan'],
    sustainabilityScore: 48,
  },
  {
    id: "local_evian_evian_natural_spring_water_global_500ml_original",
    name: 'Evian Natural Spring Water',
    brand: 'Danone',
    category: 'water',
    subcategory: 'natural-spring',
    liquidType: 'beverage',
    impactScore: 99,
    hydrationLevel: 100,
    glycemicImpact: 'low',
    calories: 0,
    sugar: 0,
    caffeine: 0,
    sodium: 1,
    fat: 0,
    protein: 0,
    servingSize: 100,
    servingUnit: 'ml',
    additives: [],
    ingredients: [
      { name: 'Natural Spring Water', function: 'Base', healthRole: 'hydration', riskLevel: 'low', description: 'Naturally filtered through Alpine rock', source: 'French Alps', organic: false, allergen: false }
    ],
    alternatives: ['Tap Water (if safe)', 'Other Bottled Waters', 'Filtered Water'],
    keywords: ["evian", "spring water", "french alps", "natural water", "premium water"],
    notes: 'Premium natural spring water from the French Alps. Naturally filtered through glacial rock.',
    healthBenefits: ['Pure hydration', 'Natural minerals', 'Zero calories'],
    certifications: ['ISO 14001', 'Carbon Neutral'],
    origin: 'France',
    dietaryFlags: ['vegetarian', 'vegan', 'gluten-free', 'keto', 'paleo'],
    sustainabilityScore: 78,
  },
];

// ============================================================================
// FLUCTUATION UTILITIES
// ============================================================================

export const calculateTimeBasedImpact = (
  baseImpact: number,
  category: string,
  hoursSinceConsumption: number = 0
): TimeBasedImpact => {
  const config = FLUCTUATION_CONFIGS[category] || FLUCTUATION_CONFIGS.default;
  const now = Date.now();

  const shortTermHours = 2;
  const mediumTermHours = 24;
  const longTermHours = 168;

  const calculateFluctuation = (horizon: 'shortTerm' | 'mediumTerm' | 'longTerm') => {
    const cfg = config[horizon];
    const timeFactor = Math.min(1, hoursSinceConsumption / (horizon === 'shortTerm' ? shortTermHours : horizon === 'mediumTerm' ? mediumTermHours : longTermHours));
    const randomFactor = (Math.sin(now * 0.001 + horizon.length) + 1) / 2;
    const volatility = cfg.volatility * (1 - timeFactor * 0.5);
    const fluctuation = (cfg.min + (cfg.max - cfg.min) * randomFactor) * volatility;
    const value = Math.max(0, Math.min(100, baseImpact + fluctuation));
    const trend: 'up' | 'down' | 'stable' = fluctuation > 3 ? 'up' : fluctuation < -3 ? 'down' : 'stable';
    const confidence = 0.7 + (1 - timeFactor) * 0.25;
    return { value: Math.round(value * 10) / 10, trend, confidence: Math.round(confidence * 100) / 100 };
  };

  return {
    current: baseImpact,
    shortTerm: calculateFluctuation('shortTerm'),
    mediumTerm: calculateFluctuation('mediumTerm'),
    longTerm: calculateFluctuation('longTerm'),
    lastUpdated: now,
    fluctuationHistory: []
  };
};

export const generateFluctuationHistory = (
  baseImpact: number,
  category: string,
  dataPoints: number = 24
): { timestamp: number; value: number; horizon: TimeHorizon }[] => {
  const history: { timestamp: number; value: number; horizon: TimeHorizon }[] = [];
  const now = Date.now();
  const config = FLUCTUATION_CONFIGS[category] || FLUCTUATION_CONFIGS.default;

  for (let i = dataPoints - 1; i >= 0; i--) {
    const hoursAgo = i;
    const timeFactor = Math.min(1, hoursAgo / 168);
    const horizons: TimeHorizon[] = ['short', 'medium', 'long'];
    const horizon = horizons[Math.floor(Math.random() * horizons.length)];
    const cfg = config[`${horizon}Term` as keyof FluctuationConfig];
    const randomFactor = (Math.sin((now - hoursAgo * 3600000) * 0.001) + 1) / 2;
    const volatility = cfg.volatility * (1 - timeFactor * 0.3);
    const fluctuation = (cfg.min + (cfg.max - cfg.min) * randomFactor) * volatility;
    const value = Math.max(0, Math.min(100, baseImpact + fluctuation));

    history.push({
      timestamp: now - hoursAgo * 3600000,
      value: Math.round(value * 10) / 10,
      horizon
    });
  }

  return history;
};

// ============================================================================
// EXPAND DATABASE ENGINE
// ============================================================================

export const EXPAND_DATABASE = (templates: BaseDrinkTemplate[]): Record<string, ScanResult> => {
  const db: Record<string, ScanResult> = {};
  const REGIONS = ['KE', 'GLOBAL'];
  const SIZES = ['330ml', '500ml', '1L'];
  const VARIANTS = ['Original', 'Zero Sugar'];

  let counter = 0;

  templates.forEach(t => {
    if (t.id) {
       const record: ScanResult = {
            id: t.id,
            detectedProduct: t.name,
            brand: t.brand,
            category: t.category,
            liquidType: t.liquidType,
            confidenceScore: 1.0,
            impactScore: t.impactScore,
            hydrationLevel: t.hydrationLevel,
            glycemicImpact: t.glycemicImpact,
            status: t.impactScore >= 80 ? 'optimal' : t.impactScore >= 50 ? 'stable' : t.impactScore >= 25 ? 'risky' : 'damaging',
            aiInsight: t.notes,
            viralStatement: `Checking ${t.name}.`,
            dehydrationRisk: t.sugar > 10,
            alternatives: t.alternatives,
            shortTermImpact: { energyResponse: 'Normal', bloodSugarResponse: 'Stable', bodyReaction: 'Refreshed', hydrationImpact: 'Hydrating' },
            mediumTermImpact: { energyStability: 'Stable', physicalChanges: 'None', habitRisk: 'Low', sleepQuality: 'Normal' },
            longTermImpact: { healthTrend: 'Healthy', metabolicImpact: 'Neutral', riskAccumulation: 'Low', nutritionalBalance: 'Balanced' },
            composition: {
              calories: t.calories,
              sugarGrams: t.sugar,
              caffeineMg: t.caffeine,
              sodiumMg: t.sodium,
              fatGrams: t.fat,
              proteinGrams: t.protein,
              servingSize: t.servingSize,
              servingUnit: t.servingUnit,
              artificialSweeteners: false,
              additives: t.additives,
              ingredients: t.ingredients
            },
            scannedAt: Date.now()
       };
       db[t.id] = record;
    }
  });

  Object.entries(BARCODE_INDEX).forEach(([barcode, id]) => {
    if (db[id]) {
      db[barcode] = db[id];
    }
  });

  templates.forEach(t => {
    const baseId = t.id || `local_${t.brand.replace(/\s/g, '_')}_${t.name.replace(/\s/g, '_')}`.toLowerCase();
    REGIONS.forEach(region => {
      SIZES.forEach(size => {
        VARIANTS.forEach(variant => {
          const id = `${baseId}_${region}_${size}_${variant}`.toLowerCase();
          const barcode = (100000000000 + counter).toString();
          if (db[id]) { counter++; return; }
          const isZero = variant.includes('Zero') || variant.includes('Sugar') || variant.includes('Diet');
          const sugarVal = isZero ? 0 : t.sugar;
          const impactVal = isZero ? Math.min(100, t.impactScore + 20) : t.impactScore;
          const record: ScanResult = {
            id,
            detectedProduct: `${t.name} ${variant} (${size})`,
            brand: t.brand,
            category: t.category,
            liquidType: t.liquidType,
            confidenceScore: 0.95,
            impactScore: impactVal,
            hydrationLevel: t.hydrationLevel,
            glycemicImpact: isZero ? 'low' : (t.glycemicImpact as GlycemicImpact),
            status: impactVal >= 80 ? 'optimal' : impactVal >= 50 ? 'stable' : impactVal >= 25 ? 'risky' : 'damaging',
            aiInsight: `${t.notes} This ${size} ${variant} version is common in ${region}.`,
            viralStatement: `Drinking ${t.name} in ${region}? Check your score!`,
            dehydrationRisk: !isZero && t.sugar > 10,
            alternatives: t.alternatives,
            shortTermImpact: { energyResponse: isZero ? 'Stable energy levels.' : 'May cause a quick energy spike.', bloodSugarResponse: isZero ? 'Low impact on blood sugar.' : 'May cause an insulin response.', bodyReaction: 'Refreshed sensation.', hydrationImpact: t.hydrationLevel > 70 ? 'Promotes hydration.' : 'Moderate hydration effect.' },
            mediumTermImpact: { energyStability: 'Consistent if consumed in moderation.', physicalChanges: 'Depends on overall diet.', habitRisk: 'Can be habit-forming if high in sugar.', sleepQuality: t.caffeine > 0 ? 'May affect sleep if taken late.' : 'No impact on sleep.' },
            longTermImpact: { healthTrend: impactVal > 70 ? 'Supports a healthy lifestyle.' : 'Frequent consumption may lead to health risks.', metabolicImpact: isZero ? 'Metabolically neutral.' : 'High sugar may impact metabolism.', riskAccumulation: 'Low if occasional.', nutritionalBalance: 'Supplement with water.' },
            composition: {
              calories: isZero ? Math.round(t.calories * 0.1) : t.calories,
              sugarGrams: sugarVal,
              caffeineMg: t.caffeine,
              sodiumMg: t.sodium,
              fatGrams: t.fat,
              proteinGrams: t.protein,
              servingSize: parseInt(size) || 250,
              servingUnit: 'ml',
              artificialSweeteners: isZero,
              additives: t.additives,
              ingredients: t.ingredients
            },
            scannedAt: Date.now()
          };
          db[id] = record;
          if (!db[barcode]) db[barcode] = record;
          counter++;
        });
      });
    });
  });
  return db;
};

export const DRINK_DATABASE = EXPAND_DATABASE(BASE_TEMPLATES);
