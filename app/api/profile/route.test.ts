import { beforeEach, expect, test, vi } from 'vitest';

const { userRequest } = vi.hoisted(() => ({ userRequest: vi.fn() }));
vi.mock('@/lib/actions', () => ({ userRequest }));
vi.mock('@/lib/auth', () => ({ currentUser: async () => ({ id: 'user-1' }) }));

import { GET, PUT } from './route';

beforeEach(() => userRequest.mockReset());

test('loads only the signed-in profile', async () => {
  userRequest.mockResolvedValueOnce([{ id: 'user-1', skin_goals: ['Hydration'] }]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(userRequest.mock.calls[0][0]).toContain('id=eq.user-1');
  expect(await response.json()).toMatchObject({ skin_goals: ['Hydration'] });
});

test('saves goals and the selected currency', async () => {
  userRequest.mockImplementationOnce(async (_path, init) => [JSON.parse(init.body)]);
  const response = await PUT(new Request('http://localhost/api/profile', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: 'A', skin_goals: ['Hydration', 'Texture'], budget: 90, currency: 'GBP' }),
  }) as never);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ id: 'user-1', skin_goals: ['Hydration', 'Texture'], budget: 90, currency: 'GBP' });
});
