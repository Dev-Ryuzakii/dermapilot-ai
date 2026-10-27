'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, ScanFace, ShoppingBag, Sparkles } from 'lucide-react';
import { useLiveData } from '@/lib/use-live-data';

type Summary = { profile?: { display_name?: string; currency?: string }; scans: any[]; routines: any[] };

export default function DashboardPage() {
  const [data, setData] = useState<Summary>({ scans: [], routines: [] });

  const load = () => {
    Promise.all([
      fetch('/api/profile').then(response => response.json()),
      fetch('/api/history').then(response => response.json()),
      fetch('/api/routines').then(response => response.json()),
    ]).then(([profile, scans, routines]) => setData({
      profile,
      scans: Array.isArray(scans?.assessments) ? scans.assessments : [],
      routines: Array.isArray(routines) ? routines : [],
    })).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useLiveData(load, ['skin_assessments', 'skincare_routines', 'profiles']);

  const latest = data.scans[0];
  return <>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><p className="eyebrow">YOUR SKINSPACE</p><h1 className="display mt-2 text-2xl font-bold leading-tight sm:text-3xl">A little more clarity, every day.</h1><p className="mt-2 text-sm text-[var(--muted)] sm:text-base">{data.profile?.display_name?.trim() ? `Welcome back, ${data.profile.display_name.trim()}.` : 'Your personal skincare dashboard.'}</p></div>
      <Link href="/dashboard/scan" className="primary-button w-full shrink-0 sm:w-auto"><ScanFace size={17}/>Start a skin scan</Link>
    </div>

    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:mt-8 md:grid-cols-3">
      <div className="stat-card"><span className="icon-tile"><ScanFace/></span><p className="mt-3 text-xs text-[var(--muted)] sm:text-sm">Skin scans</p><p className="display mt-1 text-2xl font-bold sm:text-3xl">{data.scans.length}</p></div>
      <div className="stat-card"><span className="icon-tile"><CalendarDays/></span><p className="mt-3 text-xs text-[var(--muted)] sm:text-sm">Routine plans</p><p className="display mt-1 text-2xl font-bold sm:text-3xl">{data.routines.length}</p></div>
      <div className="stat-card col-span-2 flex items-center gap-3 md:col-span-1 md:block"><span className="icon-tile"><ShoppingBag/></span><div><p className="text-xs text-[var(--muted)] md:mt-3 md:text-sm">Currency</p><p className="display mt-1 text-2xl font-bold sm:text-3xl">{data.profile?.currency || 'NGN'}</p></div></div>
    </div>

    <div className="mt-6 grid min-w-0 gap-4 md:mt-8 lg:grid-cols-[1.4fr_.8fr] lg:gap-5">
      <section className="surface-card min-w-0 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">LATEST CHECK-IN</p><h2 className="display mt-2 text-lg font-bold sm:text-xl">Your skin progress</h2></div><Link href="/dashboard/history" className="whitespace-nowrap text-sm font-semibold text-[var(--brand)]">See history <ArrowRight size={14} className="inline"/></Link></div>
        {latest ? <div className="mt-4 rounded-xl bg-[var(--soft)] p-4 sm:mt-5"><p className="break-words font-semibold">{latest.provider === 'mock' ? 'Development sample' : 'YouCam Skin Analysis'} · {new Date(latest.created_at).toLocaleDateString()}</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{latest.summary || 'Your scan results are ready.'}</p><Link className="mt-3 inline-block text-sm font-bold text-[var(--brand)]" href={`/dashboard/results?id=${encodeURIComponent(latest.id)}`}>View results</Link></div>
          : <div className="empty-state mt-5"><span className="icon-tile mx-auto"><Sparkles/></span><h3 className="mt-4 font-semibold">Your first check-in starts here</h3><p className="mt-2 text-sm">Take a private scan to begin a more informed routine.</p><Link href="/dashboard/scan" className="secondary-button mt-4">Start your first scan</Link></div>}
      </section>
      <section className="surface-card min-w-0 p-4 sm:p-6"><p className="eyebrow">A THOUGHTFUL NEXT STEP</p><h2 className="display mt-2 text-lg font-bold sm:text-xl">Build your routine</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Explore products that fit your budget and preferences, then save a morning and evening plan.</p><Link href="/dashboard/products" className="secondary-button mt-5">Explore products <ArrowRight size={15}/></Link></section>
    </div>
  </>;
}
