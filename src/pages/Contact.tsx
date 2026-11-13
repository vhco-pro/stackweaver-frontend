// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef, useState, type SubmitEvent } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContactChallenge } from '@/components/ContactChallenge';
import { contactEmailHref, contactPageEnabled } from '@/lib/contactSite';
import { sendContact, type ContactResult } from '@/lib/contactDelivery';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Footer } from '@/components/layout/Footer';
import { PublicNav } from '@/components/navigation/PublicNav';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { glassDivider, glassSurface } from '@/lib/surfaces';
import { cn } from '@/lib/utils';

const topics = ['Platform engineering', 'Software development', 'Something else'];
const linkClass = 'inline-flex min-h-11 items-center gap-2 rounded text-sm font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-blue-300';
const fieldClass = 'min-h-11 border-slate-300 bg-white/85 text-base text-slate-950 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100';

const outcomeText: Record<Exclude<ContactResult, 'accepted'>, string> = {
  pending: 'Your message is still being processed. Check its status in a moment.',
  uncertain: 'We couldn’t confirm that your message was sent. Check its status or email us directly.',
  limited: 'The form is receiving too many messages. Try again later or email us directly.',
  invalid: 'Check your message and complete the spam check again before sending.',
  verify_again: 'Complete a new spam check to try sending this message again.',
  unavailable: 'The contact form is temporarily unavailable. You can email us directly.',
};

export default function Contact() {
  const siteKey = typeof window !== 'undefined' && window.isSecureContext && contactPageEnabled()
    ? window.__STACKWEAVER__?.VITE_CONTACT_TURNSTILE_SITE_KEY
    : undefined;
  const [challengeToken, setChallengeToken] = useState('');
  const [challengeProblem, setChallengeProblem] = useState('');
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  const [result, setResult] = useState<Exclude<ContactResult, 'accepted'>>();
  const [retryUntil, setRetryUntil] = useState(0);
  const retryTimer = useRef<number | undefined>(undefined);
  useMountEffect(() => () => window.clearTimeout(retryTimer.current));
  const [sending, setSending] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const currentAttempt = useRef<{ id: string; fingerprint: string; startedAt?: number } | undefined>(undefined);
  const inFlight = useRef(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'write' | 'review' | 'sent'>('write');
  const nameInput = useRef<HTMLInputElement>(null);
  const panelTitle = useRef<HTMLHeadingElement>(null);

  const recovering = result === 'pending' || result === 'uncertain';
  const terminal = result === 'unavailable';
  const draft = { name: name.trim(), email: email.trim(), topic, message: message.trim() };

  function restartChallenge() {
    setChallengeToken('');
    setChallengeProblem('');
    setChallengeAttempt(attempt => attempt + 1);
  }

  function review(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const fingerprint = JSON.stringify(draft);
    if (!siteKey) return;
    if (currentAttempt.current?.fingerprint !== fingerprint) {
      currentAttempt.current = { id: crypto.randomUUID(), fingerprint };
      setResult(undefined);
    }
    restartChallenge();
    setStep('review');
    requestAnimationFrame(() => panelTitle.current?.focus());
  }

  function edit() {
    setStep('write');
    requestAnimationFrame(() => nameInput.current?.focus());
  }

  async function submit() {
    const attempt = currentAttempt.current;
    if (!attempt || !siteKey || inFlight.current || terminal || retryUntil > Date.now() || (!recovering && !challengeToken)) return;
    // The Worker remembers IDs for 24 hours. Do not retry an expired attempt.
    if (attempt.startedAt && Date.now() - attempt.startedAt >= 23 * 60 * 60 * 1000) {
      setResult('unavailable');
      return;
    }
    attempt.startedAt ??= Date.now();
    inFlight.current = true;
    setSending(true);
    const { outcome, retryAfter } = await sendContact(draft, attempt.id, recovering ? '' : challengeToken);
    inFlight.current = false;
    setSending(false);
    if (outcome === 'accepted') {
      setStep('sent');
      requestAnimationFrame(() => panelTitle.current?.focus());
      return;
    }
    if (outcome === 'pending' || outcome === 'uncertain') setUnconfirmed(true);
    // A fresh check can safely retry the same ID. Keep the draft locked until
    // that ID settles, because the original request may still be processing.
    setResult(unconfirmed && outcome === 'unavailable' ? 'uncertain' : outcome);
    setChallengeToken('');
    setChallengeProblem('');
    if (outcome === 'limited') {
      const delay = (retryAfter ?? 60) * 1000;
      setRetryUntil(Date.now() + delay);
      retryTimer.current = window.setTimeout(() => setRetryUntil(0), delay);
    }
    if (outcome === 'invalid' || outcome === 'limited' || outcome === 'verify_again') restartChallenge();
  }

  return (
    <>
      <PublicNav activeLink="contact" />
      <main className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4 pb-16 pt-32 text-slate-950 sm:px-6 sm:pt-40 lg:pb-24 dark:from-slate-950 dark:via-[#101932] dark:to-slate-950 dark:text-white">
        <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)] lg:gap-16">
          <header className="min-w-0 lg:pt-8">
            <h1 className="max-w-lg text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Contact <span className="bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 bg-clip-text text-transparent dark:from-sky-300 dark:via-blue-300 dark:to-violet-300">Stackweaver</span>
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-slate-700 sm:text-lg dark:text-slate-300">
              Tell us what you’re automating and where you could use a hand. We can help with setup, migration, and running Stackweaver for your team.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-0.5 sm:mt-8">
              <a href={contactEmailHref} className={linkClass}><Mail className="size-4" aria-hidden="true" /> Email us directly</a>
              <Link reloadDocument to="/docs" className={linkClass}><BookOpen className="size-4" aria-hidden="true" /> Read the docs</Link>
            </div>
          </header>

          <section aria-labelledby="contact-form-title" className={cn(glassSurface, 'min-w-0 bg-white/70 p-5 sm:p-8 dark:bg-slate-900/55')}>
            <h2 ref={panelTitle} id="contact-form-title" tabIndex={-1} className="text-2xl font-semibold tracking-tight focus:outline-none">
              {step === 'write' ? 'Send a message' : step === 'review' ? 'Review your message' : 'Message sent'}
            </h2>

            {!siteKey && (
              <p className="mt-4 text-slate-700 dark:text-slate-300">Use the email link to send us your question.</p>
            )}

            {siteKey && step === 'write' && (
              <form className="mt-5 grid gap-5" onSubmit={review}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="contact-name">Name</Label>
                    <Input ref={nameInput} id="contact-name" name="name" autoComplete="name" maxLength={120} required value={name} onChange={event => { event.target.setCustomValidity(event.target.value.trim() ? '' : 'Enter your name.'); setName(event.target.value); }} className={fieldClass} />
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input id="contact-email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} className={fieldClass} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact-topic">Topic <span className="ml-1 font-normal text-slate-600 dark:text-slate-300">(optional)</span></Label>
                  <div className="relative">
                    <select id="contact-topic" name="topic" value={topic} onChange={event => setTopic(event.target.value)} className={cn(fieldClass, 'w-full appearance-none rounded-md border px-3 pr-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-300 dark:[color-scheme:dark]')}>
                      <option value="">Choose a topic</option>
                      {topics.map(item => <option key={item}>{item}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea id="contact-message" name="message" rows={4} maxLength={5000} required value={message} onChange={event => { event.target.setCustomValidity(event.target.value.trim() ? '' : 'Enter a message.'); setMessage(event.target.value); }} placeholder="What are you working on, and how can we help?" className={cn(fieldClass, 'min-h-28 bg-white/85 dark:bg-slate-950/60')} />
                </div>
                <GradientButton type="submit" size="lg" className="sm:w-auto sm:justify-self-start">
                  Review message <ArrowRight className="size-4" aria-hidden="true" />
                </GradientButton>
              </form>
            )}

            {siteKey && step === 'review' && (
              <div className="mt-5 grid gap-5">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="font-medium text-slate-600 dark:text-slate-300">From</dt>
                    <dd className="mt-1 break-words">{name.trim()}<br />{email.trim()}</dd>
                  </div>
                  {topic && <div><dt className="font-medium text-slate-600 dark:text-slate-300">Topic</dt><dd className="mt-1">{topic}</dd></div>}
                </dl>
                <p className={cn(glassDivider, 'max-h-64 overflow-y-auto border-t pt-4 whitespace-pre-wrap break-words')}>{message.trim()}</p>
                {!recovering && !terminal && (
                  <ContactChallenge key={challengeAttempt} siteKey={siteKey}
                    onVerified={token => { setChallengeToken(token); setChallengeProblem(''); }}
                    onProblem={problem => { setChallengeToken(''); setChallengeProblem(problem); }} />
                )}
                <p role="status" className="text-sm text-slate-700 dark:text-slate-300">
                  {sending ? 'Sending…' : challengeProblem || (result ? outcomeText[result] : !challengeToken && 'Complete the spam check to send your message.')}
                </p>
                <div className="flex flex-wrap gap-3">
                  <GradientButton type="button" size="lg" className="w-auto" disabled={sending || retryUntil > 0 || terminal || (!recovering && !challengeToken)} onClick={() => { void submit(); }}>
                    {recovering ? 'Check status' : 'Send message'}
                  </GradientButton>
                  <Button type="button" size="lg" variant="outline" disabled={sending || unconfirmed} onClick={edit}>Edit message</Button>
                  {challengeProblem && <Button type="button" size="lg" variant="outline" onClick={restartChallenge}>Retry spam check</Button>}
                </div>
              </div>
            )}

            {step === 'sent' && (
              <div role="status" className="mt-4 flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                <p>Thanks for reaching out. Your message was sent.</p>
              </div>
            )}

            <div className={cn(glassDivider, 'mt-5 border-t pt-2 text-sm text-slate-700 dark:text-slate-300')}>
              <details className="group">
                <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-300 [&::-webkit-details-marker]:hidden">
                  <ChevronDown className="size-4 group-open:rotate-180" aria-hidden="true" /> Privacy
                </summary>
                <p className="pb-2 leading-relaxed">We use your email to reply. Cloudflare helps prevent spam and deliver messages. Spam limits and retry records expire after 24 hours. Email is retained separately under provider policies.</p>
              </details>
            </div>
          </section>
        </div>
      </main>
      <Footer reloadDocument />
    </>
  );
}
