/* Scoring and claim checks. Pure functions: no DOM, easy to test.
   Sources: FSSAI Advertising & Claims Regulations 2018 (Schedule I, compendium v3),
   WHO guidance, UK front-of-pack "high" cut-offs, Chile warning cut-offs.
   All numbers are per 100 g (solid) or per 100 ml (drink). */

const RDA_PROTEIN_G = 50;      // ASSUMPTION: replace with an ICMR RDA for your target group
const LOW_SUGAR_SOLID_G = 5;   // FSSAI compendium shows both 5 g and 6 g: confirm the current one

const LIMITS = {
  solid: { sugarHigh:22.5, sugarMid:10,   sugarLow:5,   satHigh:5,   satMid:1.5,  naHigh:600, naMid:300, lowFat:3,   lowSugar:LOW_SUGAR_SOLID_G, fibreHigh:6, protHighPct:20, protSrcPct:10 },
  drink: { sugarHigh:11.25, sugarMid:5,   sugarLow:2.5, satHigh:2.5, satMid:0.75, naHigh:300, naMid:150, lowFat:1.5, lowSugar:2.5,            fibreHigh:3, protHighPct:10, protSrcPct:5  }
};

const CLAIM_TYPES = [
  ['protein','High protein'],['fibre','High fibre'],['sugar_free','Sugar free'],
  ['low_sugar','Low sugar'],['low_fat','Low fat'],['natural','Natural / healthy / 100%']
];

const num = v => (typeof v === 'number' && !isNaN(v) ? v : null);

function evaluate(d) {
  const L = LIMITS[d.type] || LIMITS.solid, n = d.per100 || {};
  let s = 100; const flags = [];
  const sug = num(n.sugar_g), sat = num(n.sat_fat_g), na = num(n.sodium_mg),
        tr = num(n.trans_fat_g), pro = num(n.protein_g), fib = num(n.fibre_g);

  if (sug !== null) {
    if (sug > L.sugarHigh) { s -= 35; flags.push(`Sugar ${sug} g is very high (limit for "high" is ${L.sugarHigh} g)`); }
    else if (sug > L.sugarMid) { s -= 20; flags.push(`Sugar ${sug} g is high`); }
    else if (sug > L.sugarLow) s -= 8;
  }
  if (sat !== null) {
    if (sat > L.satHigh) { s -= 15; flags.push(`Saturated fat ${sat} g is high`); }
    else if (sat > L.satMid) s -= 6;
  }
  if (na !== null) {
    if (na > L.naHigh) { s -= 20; flags.push(`Sodium ${na} mg is very high (salt about ${(na / 400).toFixed(1)} g)`); }
    else if (na > L.naMid) s -= 10;
  }
  if (tr !== null && tr >= 0.2) { s -= 10; flags.push(`Trans fat ${tr} g: FSSAI allows "trans fat free" only below 0.2 g`); }

  const first = (d.ingredients || [])[0] || '';
  if (/sugar|syrup|jaggery|glucose|fructose|maltodextrin|cane|dextrose/i.test(first)) {
    s -= 10; flags.push(`First ingredient is "${first}", so it is the largest by weight`);
  }
  const add = (d.ingredients || []).filter(i => /^INS\s*\d+|E\d{3}|flavour|colour|emulsifier|preservative/i.test(i.trim())).length;
  if (add) { s -= Math.min(15, add * 3); if (add >= 3) flags.push(`${add} additives or flavours listed`); }

  if (pro !== null && pro >= RDA_PROTEIN_G * L.protHighPct / 100) s += 8;
  if (fib !== null) s += fib >= L.fibreHigh ? 8 : fib >= L.fibreHigh / 2 ? 4 : 0;
  return { score: Math.max(0, Math.min(100, Math.round(s))), flags };
}

/* returns [status, message] where status is "ok" | "bad" | "na" */
function checkClaim(type, d) {
  const L = LIMITS[d.type] || LIMITS.solid, n = d.per100 || {}, u = d.type === 'drink' ? '100 ml' : '100 g';
  const v = k => num(n[k]);
  switch (type) {
    case 'protein': { if (v('protein_g') === null) return ['na', 'Protein value missing'];
      const need = RDA_PROTEIN_G * L.protHighPct / 100;
      return v('protein_g') >= need ? ['ok', `Protein ${v('protein_g')} g per ${u} meets the high-protein test (${need} g)`]
        : ['bad', `Only ${v('protein_g')} g protein per ${u}; "high protein" needs ${need} g at the assumed RDA`]; }
    case 'fibre': { if (v('fibre_g') === null) return ['na', 'Fibre value missing'];
      return v('fibre_g') >= L.fibreHigh ? ['ok', `Fibre ${v('fibre_g')} g per ${u} qualifies`] : ['bad', `Fibre is ${v('fibre_g')} g; "high fibre" needs ${L.fibreHigh} g`]; }
    case 'sugar_free': { if (v('sugar_g') === null) return ['na', 'Sugar value missing'];
      return v('sugar_g') <= 0.5 ? ['ok', `Sugar ${v('sugar_g')} g qualifies`] : ['bad', `Sugar is ${v('sugar_g')} g; "sugar free" allows up to 0.5 g`]; }
    case 'low_sugar': { if (v('sugar_g') === null) return ['na', 'Sugar value missing'];
      return v('sugar_g') <= L.lowSugar ? ['ok', `Sugar ${v('sugar_g')} g qualifies as low`] : ['bad', `Sugar is ${v('sugar_g')} g; "low sugar" allows up to ${L.lowSugar} g`]; }
    case 'low_fat': { if (v('fat_g') === null) return ['na', 'Fat value missing'];
      return v('fat_g') <= L.lowFat ? ['ok', `Fat ${v('fat_g')} g qualifies`] : ['bad', `Fat is ${v('fat_g')} g; "low fat" allows up to ${L.lowFat} g`]; }
    default: return ['na', 'FSSAI does not allow a plain "healthy" claim, and "100%" claims were told to be removed. Judge by sugar, salt and ingredients instead'];
  }
}

function verdict(score) { return score >= 70 ? 'Fairly good' : score >= 45 ? 'Eat with care' : 'Eat rarely'; }
