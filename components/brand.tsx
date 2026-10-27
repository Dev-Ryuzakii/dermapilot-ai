import Link from 'next/link';
import { Leaf } from 'lucide-react';

type BrandProps={light?:boolean;large?:boolean;href?:string};
export default function Brand({light=false,large=false,href='/'}:BrandProps){return <Link href={href} aria-label="DermaPilot home" className={`inline-flex items-center gap-2.5 font-extrabold tracking-[-.05em] ${large?'text-2xl':'text-xl'} ${light?'text-white':'text-[var(--ink)]'}`}><span className={`grid place-items-center rounded-xl ${large?'h-11 w-11':'h-9 w-9'} ${light?'bg-white/15 text-[#d6ead9]':'bg-[var(--mint)] text-[var(--brand)]'}`}><Leaf size={large?22:18} strokeWidth={2.4}/></span><span>derma<span className={light?'text-[#c5dfca]':'text-[var(--brand)]'}>pilot</span></span><span className={`rounded-full px-2 py-1 text-[9px] font-bold tracking-[.16em] ${light?'border border-white/25 text-white/80':'bg-[var(--soft)] text-[var(--muted)]'}`}>AI</span></Link>}
