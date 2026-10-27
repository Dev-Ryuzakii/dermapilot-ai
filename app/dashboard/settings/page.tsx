'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, CircleUserRound, Save, UserRound } from 'lucide-react';

const goals = ['Hydration', 'Uneven tone', 'Texture', 'Sensitivity', 'Sun protection', 'Simple routine'];
type Profile = { display_name?: string; skin_type?: string; skin_goals?: string[]; budget?: number; currency?: string };

export default function Settings() {
  const [data, setData] = useState<Profile>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/profile', { cache: 'no-store' })
      .then(async response => {
        const profile = await response.json();
        if (!response.ok) throw new Error(profile.error || 'Could not load profile.');
        return profile;
      })
      .then(profile => { if (active) { setData(profile || {}); setLoaded(true); } })
      .catch(error => { if (active) setMsg(error instanceof Error ? error.message : 'Could not load profile.'); });
    return () => { active = false; };
  }, []);

  function toggle(goal: string) {
    setData(current => {
      const selected = current.skin_goals || [];
      return { ...current, skin_goals: selected.includes(goal) ? selected.filter(item => item !== goal) : [...selected, goal] };
    });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || 'Could not save changes.');
      setData(saved);
      setMsg('Your preferences have been saved.');
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Could not save changes. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-3xl">
    <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)]"><ArrowLeft size={15}/>Back to dashboard</Link>
    <p className="eyebrow mt-5">YOUR ACCOUNT</p>
    <h1 className="display mt-2 text-3xl font-bold">Profile & preferences</h1>
    <p className="mt-2 text-[var(--muted)]">Keep your details and skincare goals up to date.</p>
    <form onSubmit={save} className="surface-card mt-7 space-y-7 p-6 sm:p-8">
      <section>
        <h2 className="flex items-center gap-2 font-bold"><CircleUserRound size={19}/>Profile</h2>
        <label className="field-label mt-5 block">Username<input className="form-input mt-2" value={data.display_name || ''} onChange={event => setData(current => ({ ...current, display_name: event.target.value }))} placeholder="What should we call you?"/></label>
        <label className="field-label mt-4 block">Skin type<select className="form-input mt-2" value={data.skin_type || ''} onChange={event => setData(current => ({ ...current, skin_type: event.target.value }))}><option value="">Choose if known</option>{['Dry', 'Oily', 'Combination', 'Normal', 'Sensitive', 'Not sure'].map(type => <option key={type}>{type}</option>)}</select></label>
      </section>
      <section>
        <h2 className="font-bold">Your skin goals</h2>
        <div className="mt-3 flex flex-wrap gap-2">{goals.map(goal => <button type="button" key={goal} aria-pressed={(data.skin_goals || []).includes(goal)} onClick={() => toggle(goal)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${(data.skin_goals || []).includes(goal) ? 'border-[var(--brand)] bg-[var(--mint)] text-[var(--brand-dark)]' : 'border-[var(--line)] bg-white'}`}>{goal}</button>)}</div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">Routine budget<input type="number" min="0" className="form-input mt-2" value={data.budget ?? ''} onChange={event => setData(current => ({ ...current, budget: event.target.value === '' ? undefined : Number(event.target.value) }))} placeholder="Monthly amount"/></label>
        <label className="field-label">Currency<select className="form-input mt-2" value={data.currency || 'NGN'} onChange={event => setData(current => ({ ...current, currency: event.target.value }))}>{['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'GBP'].map(currency => <option key={currency}>{currency}</option>)}</select></label>
      </section>
      <p className="flex items-center gap-2 text-sm text-[var(--muted)]"><UserRound size={16}/>Profile details are private to your account.</p>
      {msg && <p role="status" className="text-sm text-[var(--brand)]">{msg}</p>}
      <button disabled={busy || !loaded} className="btn-primary inline-flex items-center gap-2"><Save size={16}/>{busy ? 'Saving…' : 'Save preferences'}</button>
    </form>
  </main>;
}
