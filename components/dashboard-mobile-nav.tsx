'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';

const links = [
  ['/dashboard', 'Overview'],
  ['/dashboard/scan', 'New scan'],
  ['/dashboard/history', 'Scan history'],
  ['/dashboard/advisor', 'Skin advisor'],
  ['/dashboard/routines', 'Routines'],
  ['/dashboard/settings', 'Settings'],
  ['/dashboard/guide', 'How it works'],
  ['/dashboard/privacy', 'Privacy'],
] as const;

export default function DashboardMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return <div className="md:hidden">
    <div className="flex items-center gap-2">
      <Link href="/dashboard/scan" className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[var(--brand)] px-3 text-xs font-bold text-white">New scan <ArrowRight size={14}/></Link>
      <button type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="dashboard-mobile-menu" onClick={() => setOpen(value => !value)} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--ink)]">{open ? <X size={20}/> : <Menu size={20}/>}</button>
    </div>
    {open && <nav id="dashboard-mobile-menu" aria-label="Dashboard navigation" className="absolute inset-x-0 top-full z-50 grid grid-cols-2 gap-2 border-b border-[var(--line)] bg-white p-4 shadow-lg">
      {links.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={pathname === href ? 'page' : undefined} className={`rounded-xl px-3 py-3 text-sm font-semibold ${pathname === href ? 'bg-[var(--mint)] text-[var(--brand-dark)]' : 'bg-[var(--soft)] text-[var(--ink)]'}`}>{label}</Link>)}
    </nav>}
  </div>;
}
