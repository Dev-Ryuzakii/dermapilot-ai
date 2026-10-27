import { NextResponse } from 'next/server';
import { userRequest } from '@/lib/actions';
import { rankProducts, buildRoutine, type Product, type UserPrefs } from '@/lib/recommendations';

export async function GET() {
  try {
    const [profiles, products] = await Promise.all([
      userRequest('/rest/v1/profiles?select=*&limit=1'),
      userRequest('/rest/v1/skincare_products?select=*&active=eq.true'),
    ]);
    const profile = profiles[0] || {};
    const prefs: UserPrefs = {
      budget: Number(profile.budget) || 100,
      currency: profile.currency || 'USD',
      skin_goals: Array.isArray(profile.skin_goals) ? profile.skin_goals : [],
      preferences: profile.preferences || {},
    };
    const catalog = products as Product[];
    const ranked = rankProducts(catalog, prefs);
    const routine = buildRoutine(catalog, prefs);
    const reasonById = new Map(ranked.map(item => [item.product.id, item.rationale]));
    const steps = [
      ...routine.morning.map(step => ({ ...step, period: 'morning' })),
      ...routine.evening.map(step => ({ ...step, period: 'evening' })),
    ].filter((step): step is typeof step & { product: Product } => step.product !== null);
    const recommendations = steps.map(step => ({
      ...step.product,
      product: step.product,
      period: step.period,
      category: step.category,
      instructions: step.instructions,
      reason: reasonById.get(step.product.id) || 'Matches your catalog filters and budget.',
    }));
    const total = recommendations.reduce((sum, item) => sum + Number(item.price || 0), 0);
    return NextResponse.json({
      products: recommendations,
      routine,
      total: { amount: total, currency: prefs.currency },
      explanation: recommendations.length
        ? 'These catalog products match your saved goals, preferences, and budget. Follow each product label and introduce new products gradually.'
        : 'No catalog products match your current currency and budget. Update your profile or ask an administrator to add suitable products.',
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not generate recommendations.' }, { status: 401 });
  }
}
