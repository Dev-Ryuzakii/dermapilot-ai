'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, Info, ScanFace, Sparkles } from 'lucide-react';
import { useLiveData } from '@/lib/use-live-data';

type Metric = { metric_key: string; label: string; score: number; severity?: string | null };
type Visual = { key: string; label: string; region: string; score: number | null; skin_type: string | null; url: string };
type Scan = { id: string; provider: string; summary: string; created_at: string; skin_metrics: Metric[]; visuals: Visual[]; skin_types: { region: string; value: string }[]; snapshot_source: string | null; snapshot_saved: boolean };

function VisualSnapshot({ visual, source }: { visual: Visual; source: string | null }) {
  const [showFindings, setShowFindings] = useState(true);
  const [sourceFailed, setSourceFailed] = useState(false);
  const hasSource = Boolean(source && !sourceFailed);
  return <figure className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
    <div className="relative overflow-hidden bg-[var(--soft)]">
      {hasSource ? <>
        <img src={source!} alt="Your scan photo" referrerPolicy="no-referrer" loading="lazy" onError={() => setSourceFailed(true)} className="block aspect-square w-full object-contain"/>
        {showFindings && <img src={visual.url} alt="" aria-hidden="true" referrerPolicy="no-referrer" loading="lazy" className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-70 mix-blend-multiply"/>}
      </> : <div className="flex aspect-square items-center justify-center p-5 text-center text-sm text-[var(--muted)]">The photo for this scan is unavailable. YouCam’s image links may have expired.</div>}
    </div>
    <figcaption className="p-3 text-sm"><strong className="capitalize">{visual.label}</strong><span className="text-[var(--muted)]"> · {visual.region}</span>{visual.skin_type && <span className="block mt-1">{visual.skin_type}</span>}{visual.score !== null && <span className="block mt-1">Score: {visual.score}</span>}{hasSource && <button type="button" onClick={() => setShowFindings(current => !current)} className="mt-2 font-semibold text-[var(--brand)]">{showFindings ? 'View original photo' : 'Show spotted areas'}</button>}</figcaption>
  </figure>;
}

export default function ResultsPage() {
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState('');
  const [snapshotWarning, setSnapshotWarning] = useState('');
  const [savingSnapshots, setSavingSnapshots] = useState(false);

  async function saveExistingSnapshots() {
    if (!scan) return;
    setSavingSnapshots(true);
    setSnapshotWarning('');
    try {
      const response = await fetch('/api/scan-snapshots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: scan.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save these snapshots.');
      const history = await fetch('/api/history', { cache: 'no-store' });
      const data = await history.json();
      if (!history.ok) throw new Error(data.error || 'Could not reload this scan.');
      const updated = (data.assessments as Scan[])?.find(item => item.id === scan.id);
      if (updated) setScan(updated);
    } catch (error) { setSnapshotWarning(error instanceof Error ? error.message : 'Could not save these snapshots.'); }
    finally { setSavingSnapshots(false); }
  }

  const load = () => {
    const id = new URLSearchParams(window.location.search).get('id');
    fetch('/api/history', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load your scans.');
        return data;
      })
      .then(data => {
        const rows: Scan[] = Array.isArray(data.assessments) ? data.assessments : [];
        const selected = id ? rows.find(row => row.id === id) : rows[0];
        if (selected) {
          setScan(selected);
          setError('');
          const warning = sessionStorage.getItem(`snapshot-warning:${selected.id}`);
          if (warning) { setSnapshotWarning(warning); sessionStorage.removeItem(`snapshot-warning:${selected.id}`); }
        }
        else { setScan(null); setError('No saved scan found yet. Start a scan to see your results here.'); }
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load your scans.'));
  };
  useEffect(() => { load(); }, []);
  useLiveData(load, ['skin_assessments']);

  return <>
    <Link href="/dashboard/history" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)]"><ArrowLeft size={15}/>Back to history</Link>
    <div className="mt-4"><p className="eyebrow">YOUR CHECK-IN</p><h1 className="display mt-2 text-3xl font-bold">Skin analysis results</h1><p className="mt-2 text-[var(--muted)]">Visible characteristics from this scan, with visual snapshots when YouCam provides them.</p></div>
    {error ? <div className="empty-state mt-8"><ScanFace className="mx-auto text-[var(--brand)]"/><p className="mt-4">{error}</p><Link className="primary-button mt-5" href="/dashboard/scan">Start a skin scan</Link></div>
      : !scan ? <div className="surface-card mt-8 p-8"><span className="spinner"/> Loading this check-in…</div>
        : <>
          <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-4 text-sm"><Info size={16} className="mr-2 inline text-[var(--brand)]"/>YouCam results are cosmetic observations, not a medical diagnosis. A score alone does not identify a condition or prescribe a product.</div>
          <section className="surface-card mt-5 p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{scan.provider === 'youcam' ? 'YOUCAM SKIN ANALYSIS' : 'DEVELOPMENT SAMPLE'}</p><h2 className="display mt-2 text-xl font-bold">{scan.summary || 'Your scan is ready'}</h2><p className="mt-2 text-sm text-[var(--muted)]">{new Date(scan.created_at).toLocaleString()}</p></div><span className="icon-tile"><Sparkles/></span></div>
            {scan.skin_metrics?.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2">{scan.skin_metrics.map(metric => <div key={metric.metric_key} className="rounded-xl bg-[var(--soft)] p-4"><p className="font-semibold capitalize">{metric.label}</p><p className="display mt-2 text-2xl font-bold">{metric.score}<span className="ml-1 text-xs font-medium text-[var(--muted)]">YouCam score</span></p>{metric.severity && <p className="mt-1 text-sm text-[var(--muted)]">{metric.severity}</p>}</div>)}</div> : <p className="mt-5 rounded-xl bg-[var(--soft)] p-4 text-sm text-[var(--muted)]">No numeric skin scores were returned for this scan.</p>}
            {scan.skin_types?.length > 0 && <div className="mt-5 rounded-xl bg-[var(--mint)] p-4"><h3 className="font-semibold">Skin type observations</h3><div className="mt-2 flex flex-wrap gap-2 text-sm">{scan.skin_types.map(item => <span key={`${item.region}-${item.value}`} className="rounded-full bg-white px-3 py-1 capitalize">{item.region}: {item.value}</span>)}</div></div>}
          </section>
          <section className="surface-card mt-5 p-6">
            <div className="flex items-start gap-3"><span className="icon-tile"><Camera/></span><div><h2 className="display text-xl font-bold">Spotted areas on your photo</h2><p className="mt-1 text-sm text-[var(--muted)]">Each view layers a YouCam detection result over the resized photo from this same scan. Toggle the overlay to compare it with the photo.</p></div></div>
            {scan.visuals?.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{scan.visuals.map(visual => <VisualSnapshot key={visual.key} visual={visual} source={scan.snapshot_source}/>)}</div> : <p className="mt-5 rounded-xl bg-[var(--soft)] p-4 text-sm text-[var(--muted)]">YouCam did not include visual result images for this scan. Your scores remain attached above.</p>}
            {!scan.snapshot_saved && scan.snapshot_source && <button type="button" onClick={saveExistingSnapshots} disabled={savingSnapshots} className="secondary-button mt-5 disabled:opacity-50">{savingSnapshots ? 'Saving snapshots…' : 'Save these snapshots privately'}</button>}
            {snapshotWarning && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your scan scores are saved, but its photo snapshots are not: {snapshotWarning}</p>}
            <p className="mt-4 text-xs text-[var(--muted)]">{scan.snapshot_saved ? 'This scan photo and available overlays are stored privately in Afribase.' : 'These visuals use temporary YouCam links and may stop loading when they expire. Private Afribase Storage is not yet available for this scan.'}</p>
          </section>
          <section className="surface-card mt-5 p-6"><h2 className="display text-xl font-bold">Use this snapshot in your routine</h2><ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]"><li>Choose one concern that matters to you and add it to your skin goals.</li><li>Keep a simple cleanser, moisturizer, and sun protection routine. Change one product at a time.</li><li>Compare future scans taken in similar light and framing, alongside how your skin feels.</li></ol><Link href="/dashboard/settings" className="secondary-button mt-5">Set skin goals</Link></section>
          <Link href={`/dashboard/advisor?scan=${encodeURIComponent(scan.id)}`} className="primary-button mt-5"><Sparkles size={17}/>Ask your skincare advisor</Link>
        </>}
  </>;
}
