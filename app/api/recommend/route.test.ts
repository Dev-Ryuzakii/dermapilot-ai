import { expect, test, vi } from 'vitest';

vi.mock('@/lib/actions', () => ({
  userRequest: vi.fn(async (path: string) => path.includes('/profiles')
    ? [{ budget: 100, currency: 'USD', skin_goals: ['dryness'], preferences: {} }]
    : [{ id: 'moisturizer-1', name: 'Gentle Moisturizer', brand: 'Example', description: '', ingredients: [], skin_suitability: [], concerns: ['dryness'], category: 'moisturizer', price: 25, currency: 'USD', image_url: null, retailer_url: null, sample_data: true }]),
}));

import { GET } from './route';

test('returns catalog products in the shape the advisor and routine save use', async () => {
  const response = await GET();
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.products[0]).toMatchObject({ id: 'moisturizer-1', period: 'morning', reason: expect.any(String), product: { id: 'moisturizer-1' } });
  expect(data.total).toMatchObject({ amount: 50, currency: 'USD' });
  expect(data.explanation).toContain('catalog');
});
