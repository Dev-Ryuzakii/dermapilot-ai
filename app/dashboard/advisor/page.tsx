import Advisor from '@/components/advisor';
import AdvisorChat from '@/components/advisor-chat';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
export default function AdvisorPage(){return <><Link href="/dashboard/results" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)]"><ArrowLeft size={15}/>Back to results</Link><p className="eyebrow mt-5">PERSONALIZED GUIDANCE</p><h1 className="display mt-2 text-3xl font-bold">Your skincare advisor</h1><p className="mt-2 text-[var(--muted)]">Explore catalog recommendations and ask questions about your saved skin results.</p><AdvisorChat/><Advisor/></>}
