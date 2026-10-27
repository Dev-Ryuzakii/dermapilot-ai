import { expect, test, vi } from 'vitest';

vi.mock('@/lib/actions', () => ({
  userRequest: vi.fn(async () => [{
    id: 'assessment-1', provider: 'youcam', status: 'completed', summary: 'Saved scan', created_at: '2026-10-26T00:00:00Z',
    raw_result: { data: { results: { output: [{ type: 'pore', ui_score: 81, region: 'nose', mask_urls: ['https://example.com/pore.jpg'] }, { type: 'resize_image', mask_urls: ['https://example.com/original.jpg'] }, { type: 'skin_type', region: 't_zone', skin_type: 'Oily' }] } } },
  }]),
}));

import { GET } from './route';

test('returns saved metrics from the assessment payload without a metrics table', async () => {
  const response = await GET();
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.assessments[0].skin_metrics).toMatchObject([{ metric_key: 'pore', score: 81 }]);
  expect(data.assessments[0].skin_metrics).toHaveLength(1);
  expect(data.assessments[0].summary).toContain('1 scored skin metrics');
  expect(data.assessments[0].visuals).toMatchObject([{ label: 'pore', region: 'nose', url: 'https://example.com/pore.jpg' }]);
  expect(data.assessments[0].snapshot_source).toBe('https://example.com/original.jpg');
  expect(data.assessments[0].skin_types).toMatchObject([{ region: 't zone', value: 'Oily' }]);
  expect(data.assessments[0]).not.toHaveProperty('raw_result');
});
