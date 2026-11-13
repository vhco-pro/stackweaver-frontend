// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';

interface Turnstile {
  render(element: HTMLElement, options: {
    sitekey: string;
    action: string;
    theme: 'auto';
    size: 'compact';
    appearance: 'always';
    callback: (token: string) => void;
    'error-callback': () => void;
    'expired-callback': () => void;
  }): string;
  remove(id: string): void;
}

type TurnstileWindow = Window & { turnstile?: Turnstile };

let scriptLoad: Promise<Turnstile> | undefined;

function loadTurnstile(): Promise<Turnstile> {
  const browser = window as TurnstileWindow;
  if (browser.turnstile) return Promise.resolve(browser.turnstile);
  scriptLoad ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    const failed = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error('Spam check unavailable'));
    };
    const timeout = window.setTimeout(failed, 10_000);
    script.async = true;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onerror = failed;
    script.onload = () => {
      if (!browser.turnstile) {
        failed();
        return;
      }
      window.clearTimeout(timeout);
      resolve(browser.turnstile);
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    scriptLoad = undefined;
    throw error;
  });
  return scriptLoad;
}

export function ContactChallenge({ siteKey, onVerified, onProblem }: {
  siteKey: string;
  onVerified: (token: string) => void;
  onProblem: (problem: string) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  useMountEffect(() => {
    let active = true;
    let widget: { api: Turnstile; id: string } | undefined;
    void loadTurnstile().then(api => {
      if (!active || !mount.current) return;
      const id = api.render(mount.current, {
        sitekey: siteKey,
        action: 'contact',
        theme: 'auto',
        size: 'compact',
        appearance: 'always',
        callback: token => { if (active) onVerified(token); },
        'error-callback': () => { if (active) onProblem('The spam check could not load. Retry it or email us directly.'); },
        'expired-callback': () => { if (active) onProblem('The spam check expired. Retry it before sending.'); },
      });
      widget = { api, id };
    }).catch(() => {
      if (active) onProblem('The spam check could not load. Retry it or email us directly.');
    });
    return () => {
      active = false;
      if (widget) widget.api.remove(widget.id);
    };
  });
  return <div ref={mount} />;
}
