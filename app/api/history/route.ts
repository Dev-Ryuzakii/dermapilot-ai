import { NextResponse } from 'next/server';
import { userRequest } from '@/lib/actions';
import { normalizeMetrics, normalizeSkinTypes, normalizeSnapshotSource, normalizeVisuals } from '@/lib/youcam';
import { savedSnapshotMetadata } from '@/lib/scan-snapshots';

type Assessment = {
  id: string;
  provider: string;
  status: string;
  summary: string;
  created_at: string;
  raw_result: unknown;
};

export async function GET() {
  try {
    const rows = await userRequest('/rest/v1/skin_assessments?select=id,provider,status,summary,created_at,raw_result&order=created_at.desc') as Assessment[];
    const assessments = rows.map(({ raw_result, ...assessment }) => {
      const skin_metrics = normalizeMetrics(raw_result);
      const saved = savedSnapshotMetadata(raw_result);
      const visuals = normalizeVisuals(raw_result).map(visual => ({
        ...visual,
        url: saved?.visuals[visual.key]
          ? `/api/scan-image?id=${encodeURIComponent(assessment.id)}&kind=overlay&key=${encodeURIComponent(visual.key)}`
          : visual.url,
      }));
      return {
        ...assessment,
        summary: assessment.provider === 'youcam' && skin_metrics.length
          ? `Analysis returned ${skin_metrics.length} scored skin metrics from YouCam. Cosmetic guidance only, not a medical diagnosis.`
          : assessment.summary,
        skin_metrics,
        visuals,
        skin_types: normalizeSkinTypes(raw_result),
        snapshot_source: saved?.source
          ? `/api/scan-image?id=${encodeURIComponent(assessment.id)}&kind=source`
          : normalizeSnapshotSource(raw_result),
        snapshot_saved: Boolean(saved?.source),
      };
    });
    return NextResponse.json({ assessments });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'History unavailable.' }, { status: 401 });
  }
}
