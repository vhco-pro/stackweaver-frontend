// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { useState, type SyntheticEvent } from 'react';
import { cn } from '@/lib/utils';
import { TOUR_SCREENS } from './tourScreens';

const imageClass = 'absolute inset-0 w-full h-full object-cover object-top max-lg:object-[right_top] transition-opacity duration-300';

/** Only nearby captures load ahead; the last decoded image covers a delayed selection. */
export function TourImages({ active, theme }: { active: number; theme: 'light' | 'dark' }) {
  const target = TOUR_SCREENS[active].image[theme];
  const [decoded, setDecoded] = useState<ReadonlySet<string>>(() => new Set());
  const [display, setDisplay] = useState<{ current: string; previous?: string }>({ current: target });
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const ready = decoded.has(target);
  if (ready && display.current !== target) setDisplay({ current: target, previous: display.current });

  const visible = ready ? target : display.current;
  // A theme switch replaces each normal image's source. Keep the old-theme image behind the
  // new image until it has decoded and faded in; source-less placeholders never enter the DOM.
  const previous = display.current !== target ? display.current : display.previous;
  const retained = previous && !TOUR_SCREENS.some(screen => screen.image[theme] === previous) ? previous : undefined;

  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const src = image.getAttribute('src');
    if (!src) return;
    void image.decode().then(() => {
      setDecoded(old => new Set([...old, src]));
    }).catch(() => { setFailed(old => new Set([...old, src])); });
  };

  return (
    <>
      {retained && <img data-tour-retained src={retained} alt="" aria-hidden="true" className={cn(imageClass, 'opacity-100')} />}
      {TOUR_SCREENS.map((screen, index) => {
        const src = screen.image[theme];
        const requested = Math.abs(index - active) <= 1 || decoded.has(src) || src === display.current;
        return (
          <img
            key={`${screen.id}:${theme}`}
            data-tour-screen={screen.id}
            data-active={index === active}
            data-theme={theme}
            src={requested ? src : undefined}
            alt={`Screenshot: ${screen.title}`}
            aria-hidden={index !== active}
            decoding="async"
            draggable={false}
            onLoad={onLoad}
            onError={() => { setFailed(old => new Set([...old, src])); }}
            className={cn(imageClass, src === visible ? 'opacity-100' : 'opacity-0')}
          />
        );
      })}
      {!ready && <span role="status" className="sr-only">{failed.has(target) ? 'Screenshot could not be loaded. Choose another screen to continue.' : 'Loading screenshot...'}</span>}
    </>
  );
}
