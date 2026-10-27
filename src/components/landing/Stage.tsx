// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { defaultLogo } from '@/lib/brandAssets';
import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileText, X } from 'lucide-react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { cn } from '@/lib/utils';
import { getVcsProviderIcon } from '@/lib/vcs';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useInterval } from '@/hooks/useInterval';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { TourImages } from '@/components/landing/TourImages';
import { PublicNav } from '@/components/navigation/PublicNav';
import { Slide } from '@/components/animate-ui/primitives/effects/slide';
import { Shine } from '@/components/animate-ui/primitives/effects/shine';
import { SplittingText } from '@/components/animate-ui/primitives/texts/splitting';
import { TypingText, TypingTextCursor } from '@/components/animate-ui/primitives/texts/typing';
import { RotatingTextContainer, RotatingText } from '@/components/animate-ui/primitives/texts/rotating';
import {
  STAGE_HERO as HERO,
  STAGE_STEP as STEP,
  STAGE_TAIL as TAIL,
  TOUR_INTERVAL_MS,
  TOUR_SCREENS,
  type TourScreen,
} from '@/components/landing/tourScreens';

/* =====================================================================================
 * The hero and the product tour are one pinned scroll sequence.
 *   act 1  the hero copy lifts away and the logo flies into the navigation bar
 *   act 2  the product window rises in, then each scroll step shows one real screen
 * Visitors who prefer reduced motion, and viewports too short to pin, get the two blocks
 * stacked: a tabbed tour from tablet width up, one card per screen on a phone.
 *
 * Nothing here listens for scroll events. `motion` turns scroll progress into style values
 * without re-rendering, and React state changes only when the active screen does.
 * ===================================================================================== */

const N = TOUR_SCREENS.length;
/** Scroll distance the pinned stage takes, in viewport heights. */
const TRAVEL = HERO + N * STEP + TAIL;
/** Where inside a step a jump lands: far enough in that the screen has settled. */
const STEP_LANDING = 0.12;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const c = clamp(v);
  return c * c * (3 - 2 * c);
};

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => { mq.removeEventListener('change', onChange); };
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

const glassCard = 'rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md';
const captionTitle = 'font-semibold bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 dark:from-blue-300 dark:via-indigo-300 dark:to-purple-300 bg-clip-text text-transparent';

/* ---------- hero ---------- */

function HeroCopy() {
  return (
    <>
      <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-500 dark:from-white dark:via-blue-100 dark:to-blue-300 bg-clip-text text-transparent min-h-[1.2em]">
        <SplittingText text="Stackweaver" type="chars" delay={400} inView inViewOnce />
      </h1>
      <div className="text-xl md:text-2xl text-slate-800 dark:text-gray-300 max-w-3xl mx-auto flex flex-col items-center">
        <TypingText
          inView
          inViewOnce
          delay={800}
          duration={17}
          text="The DevOps automation platform for managing infrastructure and configuration at scale."
        >
          <TypingTextCursor />
        </TypingText>
        {/* a div, not a p: Shine renders a block element */}
        <div className="mt-4 flex flex-wrap justify-center gap-x-1.5 text-sm md:text-base text-slate-600 dark:text-gray-400">
          <span>Your one-stop shop for all </span>
          <Shine>
            <span className="font-bold text-blue-600 dark:text-blue-400">infrastructure automation</span>
          </Shine>
        </div>
      </div>
    </>
  );
}

const HeroLogo = () => (
  <Slide direction="up" delay={200} inView inViewOnce>
    <img src={defaultLogo} alt="Stackweaver" className="h-32 w-32 md:h-48 md:w-48 lg:h-56 lg:w-56 drop-shadow-2xl" />
  </Slide>
);

const ScrollHint = () => (
  <>
    <span className="w-6 h-10 border-2 border-slate-400 dark:border-white/30 rounded-full flex items-start justify-center p-2 animate-bounce">
      <span className="w-1 h-3 bg-slate-400 dark:bg-white/50 rounded-full" />
    </span>
    <span>Scroll to look inside</span>
  </>
);

/* ---------- tour pieces ---------- */

function TourHeading({ className }: { className?: string }) {
  return (
    <h2 className={cn('font-bold tracking-tight text-slate-700 dark:text-gray-200 flex flex-wrap items-center gap-x-3', className)}>
      <span>Orchestrate</span>
      <RotatingTextContainer
        text={['OpenTofu', 'Ansible']}
        className="inline-flex text-blue-600 dark:text-blue-400 min-w-[100px] sm:min-w-[140px] justify-start"
        y={40}
        duration={2400}
      >
        <RotatingText transition={{ type: 'spring', damping: 25, stiffness: 300 }} />
      </RotatingTextContainer>
    </h2>
  );
}

const TourBadge = () => (
  <span className="inline-flex items-center px-4 py-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-medium tracking-wide text-slate-600 dark:text-gray-300 uppercase shadow-xs">
    A look behind the login
  </span>
);

/** One segment of the progress bar. The gradient spans the whole bar, each segment shows its slice. */
function ProgressSegment({ index, position, active, onSelect }: { index: number; position: MotionValue<number>; active: number; onSelect: (index: number) => void }) {
  const clipPath = useTransform(position, (p) => {
    const step = Math.floor(p);
    const filled = index < step ? 100 : index === step ? Math.round((p - step) * 100) : 0;
    return `inset(0 ${100 - filled}% 0 0 round 9999px)`;
  });
  return (
    <button type="button" data-tour-progress={TOUR_SCREENS[index].id} aria-label={`Show ${TOUR_SCREENS[index].label}`} aria-current={index === active ? 'step' : undefined} onClick={() => { onSelect(index); }} className="relative flex-1 h-11 rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <span className="absolute inset-x-0 top-5 h-1 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
      <motion.div
        className="absolute inset-0"
        style={{
          clipPath,
          backgroundImage: 'linear-gradient(90deg,#3b82f6,#6366f1,#a855f7)',
          backgroundSize: `${N * 100}% 100%`,
          backgroundPosition: `${(index / (N - 1)) * 100}% 0`,
        }}
      />
      </span>
    </button>
  );
}

/**
 * The caption card. All seven captions sit in one grid cell, so the card is as tall as the
 * longest of them and the screen beside or below it never moves when the caption changes.
 */
function TourCaption({ active, position, onSelect, className }: { active: number; position: MotionValue<number>; onSelect: (index: number) => void; className?: string }) {
  return (
    <div data-tour-caption className={cn(glassCard, 'p-5', className)}>
      <div className="grid">
        {TOUR_SCREENS.map((screen, i) => (
          <div
            key={screen.id}
            aria-hidden={i !== active}
            className={cn('col-start-1 row-start-1 transition-opacity duration-200', i === active ? 'opacity-100' : 'opacity-0 pointer-events-none')}
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div data-tour-title data-active={i === active} className={cn(captionTitle, 'text-lg [@media(max-height:640px)]:max-lg:text-base')}>
                {screen.title}
              </div>
              {/* holds the width of the counter, which is drawn once over all seven */}
              <div className="text-xs font-mono shrink-0 invisible" aria-hidden="true">
                {N} / {N}
              </div>
            </div>
            {/* on a short phone the caption takes smaller type, which gives height back to the screen below it */}
            <p className="text-sm leading-relaxed text-slate-600 dark:text-gray-400 [@media(max-height:640px)]:max-lg:text-[13px] [@media(max-height:640px)]:max-lg:leading-snug">
              {screen.description}
            </p>
          </div>
        ))}
        <div data-tour-count className="col-start-1 row-start-1 justify-self-end self-start mt-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
          {active + 1} / {N}
        </div>
      </div>
      <div className="mt-1 flex gap-1.5">
        {TOUR_SCREENS.map((screen, i) => (
          <ProgressSegment key={screen.id} index={i} position={position} active={active} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function TourPills({ active, onSelect, className }: { active: number; onSelect: (index: number) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="tablist" aria-label="Product tour">
      {TOUR_SCREENS.map((screen, i) => {
        const on = i === active;
        return (
          <button
            key={screen.id}
            type="button"
            role="tab"
            data-tour-pill={screen.id}
            aria-selected={on}
            aria-controls="tour-visual"
            onClick={() => { onSelect(i); }}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all duration-300 cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
              on
                ? 'bg-white dark:bg-white/10 border-blue-500/60 dark:border-blue-400/50 text-slate-900 dark:text-white shadow-md shadow-blue-500/10'
                : 'bg-white border-slate-200 shadow-xs dark:bg-white/5 dark:border-white/10 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/10'
            )}
          >
            <screen.icon className={cn('w-4 h-4 transition-colors', on ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-gray-400')} />
            <span>{screen.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TourActions({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col sm:flex-row gap-3', className)}>
      <GradientButton asChild className="sm:w-auto justify-center h-11 px-5 text-sm font-semibold">
        <a href="https://github.com/vhco-pro" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
          {getVcsProviderIcon('github', 'w-4 h-4')}
          <span>View on GitHub</span>
        </a>
      </GradientButton>
      <Button
        variant="outline"
        asChild
        className="border-slate-200 bg-white text-slate-900 hover:bg-slate-50 dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10 h-11 px-5 text-sm"
      >
        <Link to="/docs" className="flex items-center">
          <FileText className="w-4 h-4 mr-2" />
          Documentation
        </Link>
      </Button>
    </div>
  );
}

interface TourWindowProps {
  active: number;
  theme: 'dark' | 'light';
  /** Below the desktop breakpoint the capture is cropped to the page content and a tap enlarges it. */
  onEnlarge?: () => void;
  className?: string;
}

/** The product window: a browser frame around the capture of the active screen. */
function TourWindow({ active, theme, onEnlarge, className }: TourWindowProps) {
  const screens = <TourImages active={active} theme={theme} />;
  const frame = 'relative block w-full overflow-hidden bg-white dark:bg-slate-950 aspect-[1024/800] lg:aspect-[16/10]';
  return (
    <div
      data-tour-window
      className={cn(
        'relative w-full rounded-xl overflow-hidden shadow-2xl shadow-blue-950/40 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900',
        className
      )}
    >
      <div className="h-7 lg:h-10 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 flex items-center px-4 gap-4">
        <div className="flex gap-2 shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="h-5 lg:h-6 flex-1 min-w-0 max-w-md mx-auto bg-slate-200/70 dark:bg-white/5 rounded-md flex items-center justify-center text-[11px] font-mono text-slate-500 dark:text-slate-400 px-3">
          <span className="truncate">stackweaver.example.com{TOUR_SCREENS[active].url}</span>
        </div>
        <div className="w-10 shrink-0 max-lg:hidden" />
      </div>
      {onEnlarge ? (
        <>
          <button type="button" data-tour-screens onClick={onEnlarge} aria-label="Enlarge this screenshot" className={cn(frame, 'cursor-zoom-in')}>
            {screens}
          </button>
          <div className="h-[22px] flex items-center justify-center text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-white/10">
            Tap the screen to enlarge
          </div>
        </>
      ) : (
        <div data-tour-screens className={frame}>
          {screens}
        </div>
      )}
    </div>
  );
}

/** The enlarged capture opens scrolled past the application's sidebar, onto the page content. */
const startPastSidebar = (el: HTMLDivElement | null) => { el?.scrollTo(180, 0); };

function ZoomOverlay({ screen, theme, onClose }: { screen: TourScreen; theme: 'dark' | 'light'; onClose: () => void }) {
  const source = screen.image[theme];
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Enlarged screenshot: ${screen.title}`}
      className="fixed inset-0 z-[60] bg-slate-950/95 overflow-auto overscroll-contain"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      ref={startPastSidebar}
    >
      <button
        type="button"
        autoFocus
        onClick={onClose}
        className="fixed top-4 right-4 z-10 inline-flex items-center gap-2 h-11 px-4 rounded-full bg-white text-slate-900 text-sm font-semibold shadow-lg"
      >
        <X className="h-4 w-4" />
        Close
      </button>
      <img src={source} alt={`Screenshot: ${screen.title}`} width={1920} height={1200} className={cn('block w-[1100px] max-w-none', loaded === source ? 'visible' : 'invisible')} onLoad={(event) => {
        const image = event.currentTarget;
        void image.decode().then(() => { setLoaded(source); }).catch(() => { setFailed(source); });
      }} onError={() => { setFailed(source); }} />
      {loaded !== source && <div role="status" className="fixed top-20 left-4 rounded-lg bg-white px-4 py-2 text-slate-900">{failed === source ? 'Screenshot could not be loaded. Close and try again.' : 'Loading screenshot...'}</div>}
    </div>
  );
}

/** One card per screen: the tour for a phone that cannot pin the stage. */
function TourCards({ theme, onEnlarge }: { theme: 'dark' | 'light'; onEnlarge: (index: number) => void }) {
  return (
    <div className="flex flex-col gap-5">
      {TOUR_SCREENS.map((screen, i) => (
        <article key={screen.id} data-tour-card={screen.id} className={cn(glassCard, 'overflow-hidden')}>
          <div className="p-4">
            <div className="flex items-start justify-between gap-4 mb-1.5">
              <h3 className={cn(captionTitle, 'text-base')}>{screen.title}</h3>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0 mt-1">
                {i + 1} / {N}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-gray-400">{screen.description}</p>
          </div>
          <button
            type="button"
            onClick={() => { onEnlarge(i); }}
            aria-label={`Enlarge the screenshot: ${screen.title}`}
            className="relative block w-full aspect-[1024/800] overflow-hidden border-t border-slate-200 dark:border-white/10 cursor-zoom-in"
          >
            <img
              src={screen.image[theme]}
              alt={`Screenshot: ${screen.title}`}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover object-[right_top]"
            />
          </button>
        </article>
      ))}
    </div>
  );
}

/* ---------- the stage ---------- */

interface StageProps {
  /** The hero's decorative background, drawn behind both acts. */
  background?: ReactNode;
}

export function Stage({ background }: StageProps) {
  const { resolvedTheme: theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const tallEnough = useMediaQuery('(min-height: 560px)');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const tablet = useMediaQuery('(min-width: 768px)');
  const pinned = tallEnough && !reduceMotion;

  const trackRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  /** How far, and to what scale, the hero logo travels to land on the navigation logo. */
  const flight = useRef({ dx: 0, dy: 0, k: 1 });

  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);
  const [zoomed, setZoomed] = useState<number | null>(null);

  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });
  /** Act 1, 0 to 1: the hero leaving. */
  const exit = useTransform(scrollYProgress, (p) => clamp((p * TRAVEL) / HERO));
  /** Act 2: the screen index plus how far through its step the visitor is. */
  const scrollPosition = useTransform(scrollYProgress, (p) => Math.min(N - 0.0001, clamp((p * TRAVEL - HERO) / (N * STEP)) * N));
  /** In the stacked tour there is no scroll position: the bar fills up to the chosen screen. */
  const pickedPosition = useMotionValue(0.9999);
  const position = pinned ? scrollPosition : pickedPosition;

  useMotionValueEvent(scrollPosition, 'change', (p) => {
    if (pinned) setActive(Math.floor(p));
  });

  const select = (index: number) => {
    setActive(index);
    pickedPosition.set(index + 0.9999);
  };

  // Stacked from tablet width up: the tour advances on its own until the visitor picks a screen.
  useInterval(
    () => { select((active + 1) % N); },
    !pinned && tablet && !reduceMotion && !picked ? TOUR_INTERVAL_MS : null
  );

  // The hero logo's resting place and the navigation logo's, measured in layout coordinates so
  // the transforms in flight do not disturb the measurement.
  useMountEffect(() => {
    const measure = () => {
      const pin = pinRef.current;
      const logo = logoRef.current;
      const navLogo = document.querySelector<HTMLElement>('[data-nav-logo]');
      if (!pin || !logo || !navLogo) return;
      let x = 0;
      let y = 0;
      for (let el: HTMLElement | null = logo; el && el !== pin; el = el.offsetParent as HTMLElement | null) {
        x += el.offsetLeft;
        y += el.offsetTop;
      }
      const nav = navLogo.getBoundingClientRect();
      if (!logo.offsetWidth || !nav.width) return;
      flight.current = {
        dx: nav.left + nav.width / 2 - (x + logo.offsetWidth / 2),
        dy: nav.top + nav.height / 2 - (y + logo.offsetHeight / 2),
        k: nav.width / logo.offsetWidth,
      };
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (pinRef.current) observer.observe(pinRef.current);
    return () => { observer.disconnect(); };
  });

  const flown = useTransform(exit, (e) => smooth(e / 0.85));
  const logoX = useTransform(flown, (f) => flight.current.dx * f);
  const logoY = useTransform(flown, (f) => flight.current.dy * f);
  const logoScale = useTransform(flown, (f) => 1 + (flight.current.k - 1) * f);
  const logoVisibility = useTransform<number, string>(flown, (f) => (f >= 0.999 ? 'hidden' : 'visible'));
  const navLogoOpacity = useTransform<number, number>(flown, (f) => (f >= 0.999 ? 1 : 0));
  const copyOpacity = useTransform(exit, (e) => 1 - clamp(e / 0.45));
  const copyY = useTransform(exit, (e) => -70 * clamp(e / 0.45));
  const copyScale = useTransform(exit, (e) => 1 - 0.06 * clamp(e / 0.45));
  const hintOpacity = useTransform(exit, (e) => 1 - clamp(e / 0.15));
  const backgroundOpacity = useTransform(exit, (e) => 1 - 0.6 * smooth(e));
  // the product window rises from below and tips upright, then the copy slides in
  const rise = useTransform(exit, (e) => smooth((e - 0.25) / 0.75));
  const windowOpacity = useTransform(exit, (e) => clamp((e - 0.2) / 0.35));
  const windowY = useTransform(rise, (a) => (1 - a) * 0.5 * (pinRef.current?.offsetHeight ?? 0));
  const windowTilt = useTransform(rise, (a) => (1 - a) * 24);
  const windowScale = useTransform(rise, (a) => 0.78 + 0.22 * a);
  const tourCopyOpacity = useTransform(exit, (e) => smooth((e - 0.6) / 0.4));
  const tourCopyY = useTransform(exit, (e) => (1 - smooth((e - 0.6) / 0.4)) * 24);
  const tourPointerEvents = useTransform<number, string>(exit, (e) => (e > 0.6 ? 'auto' : 'none'));

  const jumpToStep = (index: number) => {
    const track = trackRef.current;
    const pin = pinRef.current;
    if (!track || !pin) return;
    const top = track.getBoundingClientRect().top + window.scrollY + (HERO + (index + STEP_LANDING) * STEP) * pin.offsetHeight;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const zoom = zoomed !== null && <ZoomOverlay screen={TOUR_SCREENS[zoomed]} theme={theme} onClose={() => { setZoomed(null); }} />;

  if (!pinned) {
    return (
      <section id="top" ref={trackRef} data-stage data-stage-mode="stacked" className="relative">
        <PublicNav activeLink="home" />
        <div className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[92vh] pointer-events-none overflow-hidden">{background}</div>
          <div className="relative z-10 min-h-[92vh] flex items-center justify-center">
            <div className="max-w-6xl mx-auto px-6 text-center pt-24 pb-16">
              <div className="mb-8 flex justify-center">
                <HeroLogo />
              </div>
              <div data-hero-copy>
                <HeroCopy />
              </div>
            </div>
          </div>
        </div>

        <div id="overview" className="relative px-4 md:px-6 py-12 md:py-20 scroll-mt-24 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
          <div className="w-full max-w-[1560px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-4 flex flex-col gap-5 min-w-0">
              <div>
                <TourBadge />
              </div>
              <TourHeading className="text-2xl sm:text-3xl xl:text-4xl" />
              {tablet ? (
                <>
                  <TourCaption active={active} position={position} onSelect={(i) => { setPicked(true); select(i); }} />
                  <TourPills active={active} onSelect={(i) => { setPicked(true); select(i); }} />
                </>
              ) : (
                <TourCards theme={theme} onEnlarge={setZoomed} />
              )}
              <TourActions />
            </div>
            {tablet && (
              <div id="tour-visual" role="tabpanel" className="lg:col-span-8 min-w-0 flex justify-center">
                <TourWindow active={active} theme={theme} onEnlarge={desktop ? undefined : () => { setZoomed(active); }} />
              </div>
            )}
          </div>
        </div>
        {zoom}
      </section>
    );
  }

  return (
    <section
      id="top"
      ref={trackRef}
      data-stage
      data-stage-mode="pinned"
      className="relative"
      style={{ height: `calc(${1 + TRAVEL} * 100svh)` }}
    >
      <PublicNav activeLink="home" logoOpacity={navLogoOpacity} />
      {/* The stretch of the track in which the tour is on screen: what `#overview` scrolls to. */}
      <div id="overview" aria-hidden="true" className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ top: `calc(${HERO + STEP_LANDING * STEP} * 100svh)` }} />

      <div ref={pinRef} data-stage-pin className="sticky top-0 h-svh overflow-hidden">
        <motion.div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: backgroundOpacity }}>
          {background}
        </motion.div>

        {/* act 1: the hero */}
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="max-w-6xl mx-auto px-6 text-center pt-24 pb-16">
            <div className="mb-8 flex justify-center">
              <motion.div ref={logoRef} style={{ x: logoX, y: logoY, scale: logoScale, visibility: logoVisibility }}>
                <HeroLogo />
              </motion.div>
            </div>
            <motion.div data-hero-copy style={{ opacity: copyOpacity, y: copyY, scale: copyScale }}>
              <HeroCopy />
            </motion.div>
          </div>
          <motion.div
            className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-2 text-xs text-slate-500 dark:text-white/50"
            style={{ opacity: hintOpacity }}
          >
            <ScrollHint />
          </motion.div>
        </div>

        {/* act 2: the product, one real screen per scroll step */}
        <motion.div
          className="absolute inset-0 z-10 flex items-stretch lg:items-center px-4 md:px-6 pt-[108px] pb-3 lg:pt-[112px] lg:pb-7 [@media(max-height:640px)]:max-lg:pt-[104px] text-slate-900 dark:text-white"
          style={{ pointerEvents: tourPointerEvents }}
        >
          <div className="w-full max-w-[1560px] mx-auto h-full lg:h-auto flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:gap-10 lg:items-center">
            <motion.div data-tour-copy className="lg:col-span-4 flex flex-col gap-2.5 lg:gap-5 min-w-0 shrink-0" style={{ opacity: tourCopyOpacity, y: tourCopyY }}>
              <div className="max-lg:hidden">
                <TourBadge />
              </div>
              <TourHeading className="text-xl lg:text-3xl xl:text-4xl [@media(max-height:640px)]:max-lg:hidden" />
              <TourCaption active={active} position={position} onSelect={jumpToStep} className="max-lg:p-3.5" />
              <TourPills active={active} onSelect={jumpToStep} className="max-lg:hidden" />
              <TourActions className="max-lg:hidden" />
            </motion.div>

            <div
              id="tour-visual"
              role="tabpanel"
              className="lg:col-span-8 min-w-0 flex justify-center items-start flex-1 min-h-0 lg:flex-none lg:items-center [container-type:size] lg:[container-type:normal]"
              style={{ perspective: 1800 }}
            >
              <motion.div
                className="w-full max-w-[max(200px,min(100cqw,calc((100cqh_-_50px)_*_1.28)))] lg:max-w-[calc((100svh_-_204px)_*_1.6)]"
                style={{ opacity: windowOpacity, y: windowY, rotateX: windowTilt, scale: windowScale }}
              >
                <TourWindow active={active} theme={theme} onEnlarge={desktop ? undefined : () => { setZoomed(active); }} />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
      {zoom}
    </section>
  );
}
