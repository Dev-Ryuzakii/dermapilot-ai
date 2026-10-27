'use client';

import { FormEvent, useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

const suggestions = [
  'What do my latest skin scores mean?',
  'What should I change in my routine first?',
  'Which catalog products fit my goals and budget?',
];

export default function AdvisorChat() {
  const [scanId, setScanId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [consent, setConsent] = useState(false);
  const [consentStatus, setConsentStatus] = useState<'loading' | 'required' | 'accepted' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setScanId(new URLSearchParams(window.location.search).get('scan') || '');
    let active = true;
    fetch('/api/consents?kind=chat', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || 'Could not load your saved consent. Refresh and try again.');
        return data;
      })
      .then(data => { if (active) setConsentStatus(data.chat ? 'accepted' : 'required'); })
      .catch(cause => { if (active) { setConsentStatus('error'); setError(cause instanceof Error ? cause.message : 'Could not load your saved consent.'); } });
    return () => { active = false; };
  }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;
    if (consentStatus === 'loading' || consentStatus === 'error') { setError('Could not check your saved consent. Refresh and try again.'); return; }
    if (consentStatus === 'required' && !consent) { setError('Agree to share your scan scores and preferences with OpenAI before chatting.'); return; }
    setBusy(true);
    setError('');
    setDraft('');
    try {
      if (consentStatus === 'required') {
        const accepted = await fetch('/api/consents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'chat', accepted: true }) });
        const saved = await accepted.json().catch(() => null);
        if (!accepted.ok) throw new Error(saved?.error || 'Could not save AI chat consent. Please try again.');
        setConsentStatus('accepted');
      }
      const response = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, history: messages.slice(-10), scanId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.answer) throw new Error(data?.error || 'The adviser could not answer. Please try again.');
      setMessages(current => [...current, { role: 'user', content: question }, { role: 'assistant', content: data.answer }]);
    } catch (cause) {
      setDraft(question);
      setError(cause instanceof Error ? cause.message : 'The adviser could not answer. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="surface-card mt-6 p-5 sm:p-6" aria-label="Skincare adviser chat">
    <div className="flex items-start gap-3"><span className="icon-tile"><MessageCircle/></span><div><h2 className="display text-xl font-bold">Ask about your skin results</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Ask follow-up questions about your saved scan, goals, routine, and matching products. This is cosmetic guidance, not a diagnosis.</p></div></div>
    {messages.length ? <div className="mt-5 max-h-[460px] space-y-3 overflow-y-auto rounded-2xl bg-[var(--soft)] p-4" aria-live="polite">
      {messages.map((message, index) => <div key={index} className={`max-w-[90%] whitespace-pre-wrap rounded-2xl p-3 text-sm leading-6 ${message.role === 'user' ? 'ml-auto bg-[var(--brand)] text-white' : 'mr-auto bg-white text-[var(--ink)]'}`}>{message.content}</div>)}
      {busy && <p className="text-sm text-[var(--muted)]">Thinking about your question…</p>}
    </div> : <div className="mt-5 flex flex-wrap gap-2">{suggestions.map(suggestion => <button key={suggestion} type="button" onClick={() => setDraft(suggestion)} className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-left text-sm hover:border-[var(--brand)]">{suggestion}</button>)}</div>}
    <form onSubmit={send} className="mt-5 space-y-3">
      {consentStatus === 'required' && <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 accent-[var(--brand)]"/><span>I agree to send my question, saved scan scores, skin goals, preferences, and relevant catalog details to OpenAI when I use this chat. My selfie is not sent. Chat messages are not saved to my account; OpenAI may retain API abuse-monitoring logs. This choice is saved to my account.</span></label>}
      {consentStatus === 'loading' && <p role="status" className="text-sm text-[var(--muted)]">Checking your saved consent…</p>}
      <div className="flex gap-2"><input aria-label="Ask your skincare question" value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000} placeholder="Ask about your scan or routine…" className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--brand)]"/><button type="submit" disabled={busy || !draft.trim() || consentStatus === 'loading' || consentStatus === 'error' || (consentStatus === 'required' && !consent)} className="primary-button inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"><Send size={16}/><span className="sr-only sm:not-sr-only">Send</span></button></div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <p className="text-xs text-[var(--muted)]">Answers can be wrong. For painful, persistent, or changing skin concerns, speak with a qualified clinician.</p>
    </form>
  </section>;
}
