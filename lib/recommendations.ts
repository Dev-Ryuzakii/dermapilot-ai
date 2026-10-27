export type Product = { id: string; name: string; brand: string; description: string; ingredients: string[]; skin_suitability: string[]; concerns: string[]; category: string; price: number; currency: string; image_url: string | null; retailer_url: string | null; sample_data: boolean };
export type UserPrefs = { budget: number; currency: string; skin_goals: string[]; preferences: Record<string, unknown> };

export function rankProducts(products: Product[], prefs: UserPrefs) {
  const budget = Number(prefs.budget) || 0;
  const currency = prefs.currency || 'USD';
  return products.filter(p => p.currency === currency && p.price <= budget).map(product => {
    let matched = product.concerns.filter(concern => prefs.skin_goals.some(goal => goal.toLowerCase().includes(concern.toLowerCase()) || concern.toLowerCase().includes(goal.toLowerCase())));
    const preferences = Object.entries(prefs.preferences).filter(([, value]) => value === true).map(([key]) => key.toLowerCase());
    const preferenceMatches = preferences.filter(preference => product.skin_suitability.some(s => s.toLowerCase().includes(preference)) || product.ingredients.some(i => i.toLowerCase().includes(preference)));
    const rationale = matched.length ? `Catalog attributes match your ${matched.join(' and ')} goals.` : 'A simple catalog option within your budget and stated skin suitability.';
    return { product, score: matched.length * 3 + preferenceMatches.length * 2 + (product.price <= budget * 0.4 ? 1 : 0), rationale, matched };
  }).sort((a, b) => b.score - a.score || a.product.price - b.product.price);
}

export function buildRoutine(products: Product[], prefs: UserPrefs) {
  const ranked = rankProducts(products, prefs);
  const choose = (category: string) => ranked.find(item => item.product.category === category)?.product ?? null;
  return {
    morning: [
      { category: 'cleanser', product: choose('cleanser'), instructions: 'Massage onto damp skin, then rinse.' },
      { category: 'moisturizer', product: choose('moisturizer'), instructions: 'Apply a comfortable layer after cleansing.' },
      { category: 'sunscreen', product: choose('sunscreen'), instructions: 'Finish with broad-spectrum sunscreen. Reapply as directed on the label.' },
    ].filter(step => step.product),
    evening: [
      { category: 'cleanser', product: choose('cleanser'), instructions: 'Gently remove sunscreen and daily buildup.' },
      { category: 'treatment', product: choose('serum') ?? choose('treatment'), instructions: 'Introduce optional treatments gradually and follow product directions.' },
      { category: 'moisturizer', product: choose('moisturizer'), instructions: 'Apply to support a comfortable skin barrier.' },
    ].filter(step => step.product),
    notes: 'Patch test new products. Introduce one product at a time. Stop use if irritation occurs.'
  };
}
