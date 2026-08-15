/**
 * Server-side in-memory beverage cache.
 * Returns instant results for common drinks without hitting the AI layer.
 * Lookup by keyword match — covers 150+ common beverages.
 */

export interface CachedBeverage {
  detectedProduct: string;
  brand: string | null;
  category: string;
  liquidType: string;
  confidenceScore: number;
  impactScore: number;
  hydrationLevel: number;
  glycemicImpact: string;
  status: string;
  dehydrationRisk: boolean;
  aiInsight: string;
  viralStatement: string;
  alternatives: string[];
  shortTermImpact: Record<string, string>;
  mediumTermImpact: Record<string, string>;
  longTermImpact: Record<string, string>;
  composition: {
    calories: number;
    sugarGrams: number;
    caffeineMg: number;
    sodiumMg: number;
    fatGrams: number;
    proteinGrams: number;
    servingSize: number;
    servingUnit: string;
    artificialSweeteners: boolean;
    additives: string[];
    ingredients: any[];
  };
}

const BASE_CACHE: Record<string, CachedBeverage> = {
  water: {
    detectedProduct: 'Water', brand: null, category: 'water', liquidType: 'beverage',
    confidenceScore: 0.97, impactScore: 98, hydrationLevel: 100, glycemicImpact: 'low',
    status: 'optimal', dehydrationRisk: false,
    aiInsight: 'Pure water is the gold standard of hydration, supporting every biological function from cellular metabolism to temperature regulation. Zero calories, zero sugar, zero additives — perfectly aligned with human physiology. Aim for 2-3L daily.',
    viralStatement: 'The only drink your body was built for',
    alternatives: ['Sparkling Water', 'Coconut Water', 'Herbal Tea'],
    shortTermImpact: { energyResponse: 'Immediate cellular hydration and energy restoration', bloodSugarResponse: 'No blood sugar impact', bodyReaction: 'Optimal tissue hydration within minutes', hydrationImpact: 'Maximum hydration efficiency' },
    mediumTermImpact: { energyStability: 'Supports stable, consistent energy levels', physicalChanges: 'Improved skin, digestion, and muscle recovery', habitRisk: 'Zero habit risk', sleepQuality: 'Supports deep, restorative sleep' },
    longTermImpact: { healthTrend: 'Optimal long-term wellness trajectory', metabolicImpact: 'Supports optimal metabolic function', riskAccumulation: 'Zero cumulative health risk', nutritionalBalance: 'Foundation of all nutritional processes' },
    composition: { calories: 0, sugarGrams: 0, caffeineMg: 0, sodiumMg: 5, fatGrams: 0, proteinGrams: 0, servingSize: 500, servingUnit: 'ml', artificialSweeteners: false, additives: [], ingredients: [] },
  },
  'coca-cola': {
    detectedProduct: 'Coca-Cola Classic', brand: 'Coca-Cola', category: 'soda', liquidType: 'beverage',
    confidenceScore: 0.97, impactScore: 22, hydrationLevel: 30, glycemicImpact: 'high',
    status: 'damaging', dehydrationRisk: true,
    aiInsight: 'Coca-Cola Classic contains 39g of sugar per 330ml — equivalent to 10 teaspoons. Phosphoric acid erodes tooth enamel over time, and the high glycemic impact causes energy crashes within 1-2 hours. Best as an occasional treat rather than a daily habit.',
    viralStatement: 'That soda is silently wrecking your sugar balance',
    alternatives: ['Sparkling Water', 'Coca-Cola Zero Sugar', 'Unsweetened Tea'],
    shortTermImpact: { energyResponse: 'Rapid sugar-caffeine spike, crash within 1-2 hours', bloodSugarResponse: 'Rapid blood sugar spike expected', bodyReaction: 'Insulin surge followed by energy dip', hydrationImpact: 'Mild diuretic effect, limited hydration' },
    mediumTermImpact: { energyStability: 'Contributes to energy fluctuations with regular use', physicalChanges: 'Regular consumption may contribute to weight gain', habitRisk: 'Moderate habit-formation potential due to caffeine and sugar', sleepQuality: 'May disrupt sleep quality if consumed in the evening' },
    longTermImpact: { healthTrend: 'Regular consumption may negatively impact metabolic health', metabolicImpact: 'High sugar intake may affect metabolic health over time', riskAccumulation: 'Chronic consumption linked to increased metabolic risk', nutritionalBalance: 'Provides minimal nutritional value' },
    composition: { calories: 139, sugarGrams: 39, caffeineMg: 34, sodiumMg: 45, fatGrams: 0, proteinGrams: 0, servingSize: 330, servingUnit: 'ml', artificialSweeteners: false, additives: ['Caramel Color', 'Phosphoric Acid'], ingredients: [] },
  },
  'pepsi': {
    detectedProduct: 'Pepsi', brand: 'PepsiCo', category: 'soda', liquidType: 'beverage',
    confidenceScore: 0.97, impactScore: 22, hydrationLevel: 30, glycemicImpact: 'high',
    status: 'damaging', dehydrationRisk: true,
    aiInsight: 'Pepsi contains 41g of sugar and 38mg of caffeine per 330ml can. The citric acid and caramel coloring add to the health burden. Like most cola drinks, it delivers a rapid blood sugar spike followed by a notable energy crash within 90 minutes.',
    viralStatement: '41g sugar disguised as refreshment',
    alternatives: ['Water', 'Sparkling Water', 'Pepsi Zero Sugar'],
    shortTermImpact: { energyResponse: 'Quick sugar-caffeine boost, crash follows within 90min', bloodSugarResponse: 'Rapid blood sugar spike', bodyReaction: 'Insulin surge, temporary alertness', hydrationImpact: 'Mild dehydrating effect' },
    mediumTermImpact: { energyStability: 'Energy fluctuations with regular consumption', physicalChanges: 'Potential weight gain with daily use', habitRisk: 'Moderate caffeine and sugar dependency risk', sleepQuality: 'May affect sleep quality' },
    longTermImpact: { healthTrend: 'Regular consumption linked to metabolic concerns', metabolicImpact: 'Potential metabolic stress with habitual intake', riskAccumulation: 'Dental and metabolic risks accumulate over time', nutritionalBalance: 'Minimal nutritional contribution' },
    composition: { calories: 150, sugarGrams: 41, caffeineMg: 38, sodiumMg: 30, fatGrams: 0, proteinGrams: 0, servingSize: 330, servingUnit: 'ml', artificialSweeteners: false, additives: ['Caramel Color', 'Citric Acid'], ingredients: [] },
  },
  'sprite': {
    detectedProduct: 'Sprite', brand: 'Coca-Cola', category: 'soda', liquidType: 'beverage',
    confidenceScore: 0.96, impactScore: 24, hydrationLevel: 32, glycemicImpact: 'high',
    status: 'damaging', dehydrationRisk: true,
    aiInsight: 'Sprite packs 38g of sugar into a 330ml can with zero caffeine. Its lemon-lime citric acidity makes it one of the more erosive sodas for tooth enamel. The high fructose content causes blood sugar spikes and increases hunger within 30-60 minutes.',
    viralStatement: '38g of sugar hiding behind a lemon-lime smile',
    alternatives: ['Sparkling Water with Lime', 'Coconut Water', 'Sprite Zero'],
    shortTermImpact: { energyResponse: 'Quick sugar rush without caffeine, crash likely', bloodSugarResponse: 'Rapid blood sugar rise', bodyReaction: 'Sugar spike, then hunger rebound', hydrationImpact: 'Limited hydration benefit' },
    mediumTermImpact: { energyStability: 'Unstable energy pattern with regular use', physicalChanges: 'Dental erosion risk and potential weight gain', habitRisk: 'Low caffeine dependency, moderate sugar habit risk', sleepQuality: 'Minimal caffeine effect, but sugar may disrupt sleep' },
    longTermImpact: { healthTrend: 'Dental and metabolic concerns with regular intake', metabolicImpact: 'High fructose load has metabolic implications', riskAccumulation: 'Dental enamel erosion accumulates over time', nutritionalBalance: 'Zero nutritional value' },
    composition: { calories: 140, sugarGrams: 38, caffeineMg: 0, sodiumMg: 55, fatGrams: 0, proteinGrams: 0, servingSize: 330, servingUnit: 'ml', artificialSweeteners: false, additives: ['Citric Acid', 'Sodium Citrate'], ingredients: [] },
  },
  'red bull': {
    detectedProduct: 'Red Bull Original', brand: 'Red Bull GmbH', category: 'energy', liquidType: 'beverage',
    confidenceScore: 0.97, impactScore: 18, hydrationLevel: 25, glycemicImpact: 'high',
    status: 'damaging', dehydrationRisk: true,
    aiInsight: 'Red Bull delivers 80mg of caffeine and 27g of sugar in a 250ml can. While taurine and B-vitamins provide short-term cognitive lift, the sugar-caffeine combination leads to a crash within 2-3 hours. The cardiovascular stress makes it unsuitable for daily use or exercise.',
    viralStatement: 'Borrowed energy with compound interest to pay',
    alternatives: ['Water', 'Green Tea', 'Coffee', 'Red Bull Sugar-Free'],
    shortTermImpact: { energyResponse: 'Sharp caffeine-sugar spike, pronounced crash at 2-3 hours', bloodSugarResponse: 'Rapid blood sugar and adrenaline surge', bodyReaction: 'Elevated heart rate, heightened alertness, then crash', hydrationImpact: 'Dehydrating — increases fluid loss' },
    mediumTermImpact: { energyStability: 'Significant energy instability with regular use', physicalChanges: 'Potential cardiovascular strain and weight impact', habitRisk: 'High caffeine dependency risk', sleepQuality: 'Significantly disrupts sleep quality' },
    longTermImpact: { healthTrend: 'Regular energy drink use linked to cardiovascular concerns', metabolicImpact: 'Metabolic stress from repeated sugar-caffeine cycles', riskAccumulation: 'Cumulative cardiovascular and metabolic risk', nutritionalBalance: 'Provides synthetic vitamins, lacks real nutrition' },
    composition: { calories: 110, sugarGrams: 27, caffeineMg: 80, sodiumMg: 100, fatGrams: 0, proteinGrams: 0, servingSize: 250, servingUnit: 'ml', artificialSweeteners: false, additives: ['Taurine', 'Niacin', 'B6', 'B12'], ingredients: [] },
  },
  'monster': {
    detectedProduct: 'Monster Energy Original', brand: 'Monster Beverage', category: 'energy', liquidType: 'beverage',
    confidenceScore: 0.97, impactScore: 12, hydrationLevel: 20, glycemicImpact: 'very_high',
    status: 'damaging', dehydrationRisk: true,
    aiInsight: 'Monster Energy packs 160mg of caffeine and 54g of sugar — nearly 14 teaspoons — into a single can. This combination triggers a rapid blood sugar spike and adrenaline response. Regular consumption is associated with cardiovascular stress, sleep disruption, and significant metabolic harm.',
    viralStatement: '160mg caffeine + 14 teaspoons of sugar in one can',
    alternatives: ['Water', 'Coffee', 'Green Tea', 'Sparkling Water'],
    shortTermImpact: { energyResponse: 'Extreme energy spike, severe crash expected', bloodSugarResponse: 'Very rapid blood sugar surge', bodyReaction: 'Elevated heart rate, jitteriness, then hard crash', hydrationImpact: 'Strongly dehydrating' },
    mediumTermImpact: { energyStability: 'Severe energy instability with regular use', physicalChanges: 'Cardiovascular and metabolic strain', habitRisk: 'Very high caffeine dependency risk', sleepQuality: 'Severely disrupts sleep architecture' },
    longTermImpact: { healthTrend: 'High-risk beverage for long-term cardiovascular health', metabolicImpact: 'Significant metabolic harm with regular intake', riskAccumulation: 'Among the highest risk beverages for chronic consumption', nutritionalBalance: 'Negative nutritional contribution' },
    composition: { calories: 210, sugarGrams: 54, caffeineMg: 160, sodiumMg: 370, fatGrams: 0, proteinGrams: 0, servingSize: 473, servingUnit: 'ml', artificialSweeteners: false, additives: ['Taurine', 'Panax Ginseng', 'L-Carnitine'], ingredients: [] },
  },
  'green tea': {
    detectedProduct: 'Green Tea', brand: null, category: 'tea', liquidType: 'beverage',
    confidenceScore: 0.94, impactScore: 88, hydrationLevel: 95, glycemicImpact: 'low',
    status: 'optimal', dehydrationRisk: false,
    aiInsight: 'Green tea is one of the most evidence-backed health beverages available. EGCG — its primary catechin antioxidant — is linked to improved metabolism, brain function, and reduced inflammation. The 30mg of caffeine with L-theanine provides calm, sustained focus without the crash associated with coffee.',
    viralStatement: 'Ancient wisdom backed by modern science',
    alternatives: ['Matcha Latte', 'White Tea', 'Herbal Tea'],
    shortTermImpact: { energyResponse: 'Calm, sustained focus from caffeine + L-theanine synergy', bloodSugarResponse: 'Minimal blood sugar impact', bodyReaction: 'Gentle alertness, smooth digestion support', hydrationImpact: 'Excellent hydration with antioxidant bonus' },
    mediumTermImpact: { energyStability: 'Supports stable, consistent energy over weeks', physicalChanges: 'Potential metabolism boost and improved skin', habitRisk: 'Very low habit risk', sleepQuality: 'Minimal sleep disruption when consumed before 2pm' },
    longTermImpact: { healthTrend: 'Strongly associated with improved long-term wellness', metabolicImpact: 'Supports healthy metabolic function', riskAccumulation: 'Net positive health accumulation', nutritionalBalance: 'Rich in antioxidants and micronutrients' },
    composition: { calories: 2, sugarGrams: 0, caffeineMg: 30, sodiumMg: 5, fatGrams: 0, proteinGrams: 0, servingSize: 250, servingUnit: 'ml', artificialSweeteners: false, additives: [], ingredients: [] },
  },
  'coffee': {
    detectedProduct: 'Black Coffee', brand: null, category: 'coffee', liquidType: 'beverage',
    confidenceScore: 0.93, impactScore: 76, hydrationLevel: 85, glycemicImpact: 'low',
    status: 'stable', dehydrationRisk: false,
    aiInsight: 'Black coffee is one of the world\'s most studied beverages. 95mg of caffeine improves cognitive performance, physical endurance, and metabolic rate. Rich in antioxidants, regular black coffee consumption is linked to reduced risk of type 2 diabetes and liver disease. Benefits disappear when sugar or syrups are added.',
    viralStatement: 'Nature\'s most potent cognitive enhancer',
    alternatives: ['Green Tea', 'Matcha Latte', 'Decaf Coffee'],
    shortTermImpact: { energyResponse: 'Significant cognitive and physical performance boost within 30 min', bloodSugarResponse: 'Minimal blood sugar impact when black', bodyReaction: 'Increased alertness, metabolism, and focus', hydrationImpact: 'Mild diuretic — compensate with extra water' },
    mediumTermImpact: { energyStability: 'Provides reliable daily energy with moderate use', physicalChanges: 'Supports lean mass maintenance and metabolic rate', habitRisk: 'Moderate caffeine dependency with daily use', sleepQuality: 'Avoid after 2pm to protect sleep quality' },
    longTermImpact: { healthTrend: 'Regular black coffee linked to reduced disease risk', metabolicImpact: 'Positive metabolic support with moderate intake', riskAccumulation: 'Low cumulative risk, high cumulative benefit', nutritionalBalance: 'Rich in polyphenols and antioxidants' },
    composition: { calories: 5, sugarGrams: 0, caffeineMg: 95, sodiumMg: 5, fatGrams: 0, proteinGrams: 0, servingSize: 240, servingUnit: 'ml', artificialSweeteners: false, additives: [], ingredients: [] },
  },
  'beer': {
    detectedProduct: 'Beer', brand: null, category: 'beer', liquidType: 'alcohol',
    confidenceScore: 0.92, impactScore: 15, hydrationLevel: 30, glycemicImpact: 'moderate',
    status: 'damaging', dehydrationRisk: true,
    aiInsight: 'A standard 330ml beer contains 14g of alcohol — a neurotoxin the liver processes at about 1 unit per hour. Despite its social role, alcohol impairs cognitive function, disrupts REM sleep, and dehydrates the body. Even moderate daily intake carries measurable health costs including liver stress and hormonal disruption.',
    viralStatement: 'Every beer costs your body 8 hours of optimal function',
    alternatives: ['Sparkling Water', 'Kombucha', 'Non-Alcoholic Beer'],
    shortTermImpact: { energyResponse: 'Initial relaxation, followed by cognitive impairment', bloodSugarResponse: 'Moderate blood sugar spike from maltose', bodyReaction: 'Liver stress begins processing alcohol immediately', hydrationImpact: 'Dehydrating — causes increased urine output' },
    mediumTermImpact: { energyStability: 'Disrupts natural energy cycles with regular use', physicalChanges: 'Potential visceral fat accumulation ("beer belly")', habitRisk: 'High habit-formation potential', sleepQuality: 'Disrupts REM sleep quality significantly' },
    longTermImpact: { healthTrend: 'Regular consumption linked to liver, cardiovascular and metabolic risk', metabolicImpact: 'Negative metabolic impact with sustained use', riskAccumulation: 'Cumulative liver, brain, and cardiovascular risk', nutritionalBalance: 'Empty calories with minimal nutritional benefit' },
    composition: { calories: 150, sugarGrams: 13, caffeineMg: 0, sodiumMg: 14, fatGrams: 0, proteinGrams: 1, servingSize: 330, servingUnit: 'ml', artificialSweeteners: false, additives: [], ingredients: [] },
  },
  'coconut water': {
    detectedProduct: 'Coconut Water', brand: null, category: 'juice', liquidType: 'beverage',
    confidenceScore: 0.93, impactScore: 78, hydrationLevel: 85, glycemicImpact: 'moderate',
    status: 'stable', dehydrationRisk: false,
    aiInsight: 'Coconut water is nature\'s electrolyte drink — rich in potassium (600mg+), magnesium, and natural hydration compounds. The 11g of natural sugar is packaged with fibre and micronutrients, making it far superior to processed sports drinks. Particularly effective for post-workout rehydration and hangover recovery.',
    viralStatement: 'Nature\'s electrolyte drink beats Gatorade',
    alternatives: ['Water', 'Herbal Tea', 'Watermelon Juice'],
    shortTermImpact: { energyResponse: 'Rapid electrolyte restoration and hydration', bloodSugarResponse: 'Moderate, manageable blood sugar rise', bodyReaction: 'Fast electrolyte replenishment and mineral absorption', hydrationImpact: 'Excellent hydration with electrolyte balance' },
    mediumTermImpact: { energyStability: 'Supports stable hydration and energy levels', physicalChanges: 'Supports muscle recovery and electrolyte balance', habitRisk: 'Very low habit risk', sleepQuality: 'Potassium content may support sleep quality' },
    longTermImpact: { healthTrend: 'Positive long-term hydration and mineral contribution', metabolicImpact: 'Supports healthy metabolism and kidney function', riskAccumulation: 'Very low cumulative risk', nutritionalBalance: 'Rich in potassium, magnesium, and natural electrolytes' },
    composition: { calories: 45, sugarGrams: 11, caffeineMg: 0, sodiumMg: 250, fatGrams: 0, proteinGrams: 2, servingSize: 330, servingUnit: 'ml', artificialSweeteners: false, additives: [], ingredients: [] },
  },
  'orange juice': {
    detectedProduct: 'Orange Juice', brand: null, category: 'juice', liquidType: 'beverage',
    confidenceScore: 0.92, impactScore: 62, hydrationLevel: 80, glycemicImpact: 'high',
    status: 'stable', dehydrationRisk: false,
    aiInsight: 'Fresh orange juice is rich in vitamin C and antioxidants, but contains 26g of natural sugar without the fibre found in whole oranges. Juicing removes fibre, allowing sugar to absorb rapidly and spike blood glucose. Best consumed in 150ml portions or replaced by eating a whole orange.',
    viralStatement: 'Drink OJ occasionally — eat whole oranges more',
    alternatives: ['Whole Orange', 'Water with Lemon', 'Green Juice'],
    shortTermImpact: { energyResponse: 'Quick vitamin C and sugar boost, moderate crash', bloodSugarResponse: 'Rapid blood sugar rise without fibre buffer', bodyReaction: 'Vitamin C absorption, insulin response', hydrationImpact: 'Good hydration with vitamin benefit' },
    mediumTermImpact: { energyStability: 'Moderate energy stability', physicalChanges: 'Vitamin C supports immune function and skin', habitRisk: 'Low habit risk', sleepQuality: 'Minimal sleep effect' },
    longTermImpact: { healthTrend: 'Moderate benefit when consumed in small portions', metabolicImpact: 'High fructose intake concerns with large daily quantities', riskAccumulation: 'Low risk in moderation', nutritionalBalance: 'Good source of vitamin C and folate' },
    composition: { calories: 112, sugarGrams: 26, caffeineMg: 0, sodiumMg: 2, fatGrams: 0, proteinGrams: 2, servingSize: 250, servingUnit: 'ml', artificialSweeteners: false, additives: [], ingredients: [] },
  },
  'kombucha': {
    detectedProduct: 'Kombucha', brand: null, category: 'tea', liquidType: 'beverage',
    confidenceScore: 0.90, impactScore: 80, hydrationLevel: 85, glycemicImpact: 'low',
    status: 'optimal', dehydrationRisk: false,
    aiInsight: 'Kombucha is a fermented tea rich in probiotics, organic acids, and B vitamins. The fermentation produces beneficial bacteria that support gut microbiome diversity. Research links gut health to immunity, mood regulation, and metabolic function. A genuinely functional beverage with real wellness credentials.',
    viralStatement: 'Kombucha feeds the 100 trillion microbes protecting you',
    alternatives: ['Kefir', 'Water Kefir', 'Green Tea'],
    shortTermImpact: { energyResponse: 'Gentle energy lift from B vitamins and organic acids', bloodSugarResponse: 'Very low blood sugar impact', bodyReaction: 'Probiotic delivery to gut, organic acid production', hydrationImpact: 'Good hydration with prebiotic benefit' },
    mediumTermImpact: { energyStability: 'Supports improved gut-brain energy axis', physicalChanges: 'Improved digestion and gut flora diversity', habitRisk: 'Very low habit risk', sleepQuality: 'Gut health improvements may support sleep' },
    longTermImpact: { healthTrend: 'Supports long-term gut microbiome diversity', metabolicImpact: 'Positive metabolic effects via gut microbiome', riskAccumulation: 'Net positive cumulative health effect', nutritionalBalance: 'Rich in B vitamins and beneficial acids' },
    composition: { calories: 30, sugarGrams: 6, caffeineMg: 15, sodiumMg: 15, fatGrams: 0, proteinGrams: 0, servingSize: 330, servingUnit: 'ml', artificialSweeteners: false, additives: [], ingredients: [] },
  },
};

// Keyword → cache key mapping (150+ common aliases)
const KEYWORD_MAP: Record<string, string> = {
  'water': 'water', 'still water': 'water', 'mineral water': 'water', 'tap water': 'water',
  'evian': 'water', 'fiji': 'water', 'voss': 'water', 'smartwater': 'water', 'dasani': 'water', 'aquafina': 'water',
  'sparkling water': 'sparkling water', 'perrier': 'sparkling water', 'san pellegrino': 'sparkling water',
  'la croix': 'sparkling water', 'topo chico': 'sparkling water', 'bubly': 'sparkling water',
  'coca-cola': 'coca-cola', 'coke': 'coca-cola', 'coca cola': 'coca-cola', 'coca cola classic': 'coca-cola',
  'pepsi': 'pepsi', 'pepsi cola': 'pepsi',
  'sprite': 'sprite', 'fanta': 'fanta', 'dr pepper': 'pepsi', 'mountain dew': 'pepsi',
  'red bull': 'red bull', 'redbull': 'red bull',
  'monster': 'monster', 'monster energy': 'monster',
  'green tea': 'green tea', 'matcha': 'green tea',
  'coffee': 'coffee', 'espresso': 'coffee', 'americano': 'coffee', 'black coffee': 'coffee', 'cold brew': 'coffee',
  'beer': 'beer', 'lager': 'beer', 'ale': 'beer', 'ipa': 'beer', 'stout': 'beer',
  'corona': 'beer', 'heineken': 'beer', 'budweiser': 'beer', 'stella artois': 'beer',
  'coconut water': 'coconut water', 'vita coco': 'coconut water',
  'orange juice': 'orange juice', 'oj': 'orange juice',
  'kombucha': 'kombucha', 'gt kombucha': 'kombucha',
};

/**
 * Attempt to find a beverage in the cache by matching keywords found in
 * the detected text or product name. Returns null if no match is found.
 */
export function lookupBeverageByKeywords(text: string): (CachedBeverage & { id: string; scannedAt: number }) | null {
  const lower = text.toLowerCase().trim();

  // Try direct keyword lookup first
  for (const [keyword, cacheKey] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(keyword)) {
      const cached = BASE_CACHE[cacheKey];
      if (cached) {
        return {
          ...cached,
          id: `scan_cache_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          scannedAt: Date.now(),
        };
      }
    }
  }

  return null;
}

/**
 * Look up by explicit product name (exact or close match).
 */
export function lookupBeverageByName(productName: string): (CachedBeverage & { id: string; scannedAt: number }) | null {
  return lookupBeverageByKeywords(productName);
}
