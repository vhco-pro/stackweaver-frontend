// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content?: string;
  className?: string;
  /** Control seated on the "On this page" row: the desktop pane's collapse button. */
  headerAction?: React.ReactNode;
  /** Leave out the "On this page" row, for a container that titles the outline itself (the phone drawer). */
  hideHeader?: boolean;
}

export function TableOfContents({ content, className, headerAction, hideHeader = false }: TableOfContentsProps) {
  const location = useLocation();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [isManualScroll, setIsManualScroll] = useState(false);

  useEffect(() => {
    // Wait for ReactMarkdown to render headings before extracting them
    const updateHeadings = () => {
      const markdownContent = document.querySelector('.markdown-content');
      if (!markdownContent) {
        return;
      }

      const headingElements = markdownContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const extractedHeadings: Heading[] = [];

      headingElements.forEach((element) => {
        const id = element.id || element.textContent?.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || '';
        const text = element.textContent || '';
        const level = parseInt(element.tagName.charAt(1), 10);

        if (id && text) {
          extractedHeadings.push({ id, text, level });
          // Ensure element has ID for anchor links
          if (!element.id) {
            element.id = id;
          }
        }
      });

      if (extractedHeadings.length > 0) {
        setHeadings(extractedHeadings);
      }
    };

    // Try immediately, then with a delay to catch async renders
    const timeoutId1 = setTimeout(updateHeadings, 100);
    const timeoutId2 = setTimeout(updateHeadings, 500);

    // Also use MutationObserver to catch when headings are added
    const observer = new MutationObserver(updateHeadings);
    const markdownContent = document.querySelector('.markdown-content');
    if (markdownContent) {
      observer.observe(markdownContent, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      observer.disconnect();
    };
  }, [content, location.pathname]);

  // The current section is the last heading that has scrolled up to the reading line, a
  // quarter of the way down the viewport (or just below the fixed navigation, when that sits
  // lower). It is measured rather than waited for, so an outline that mounts mid-page, like the
  // phone drawer's, marks the section in view as soon as it opens.
  useEffect(() => {
    if (headings.length === 0) return;

    const measure = () => {
      const elements = headings
        .map((heading) => document.getElementById(heading.id))
        .filter((element): element is HTMLElement => element !== null);
      if (elements.length === 0) return;

      const scrollMargin = Number.parseFloat(getComputedStyle(elements[0]).scrollMarginTop) || 0;
      const line = Math.max(window.innerHeight * 0.25, scrollMargin + 16);
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

      let current = elements[0];
      for (const element of elements) {
        const top = element.getBoundingClientRect().top;
        // At the bottom of the page the last sections can never reach the line, so the
        // last heading on screen wins instead.
        if (top <= line || (atBottom && top < window.innerHeight)) current = element;
      }
      setActiveId(current.id);
    };

    let frame = 0;
    const onScroll = () => {
      if (isManualScroll || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    if (!isManualScroll) measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headings, isManualScroll]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Set manual scroll flag to prevent IntersectionObserver from overriding
      setIsManualScroll(true);
      setActiveId(id);

      // Where the heading lands below the fixed navigation is the heading's own
      // scroll-margin-top (index.css), shared with deep links and in-page links.
      element.scrollIntoView({ block: 'start', behavior: 'smooth' });

      // Re-enable IntersectionObserver after scroll completes
      setTimeout(() => {
        setIsManualScroll(false);
      }, 1000);
    }
  };

  // With a header action the heading row still renders on a page without
  // headings: it is the only place the pane's collapse button lives.
  if (headings.length === 0 && !headerAction) {
    return null;
  }

  return (
    <nav aria-label="On this page" className={cn('px-4 pb-4', className)}>
      {/* Pinned while a long outline scrolls. */}
      {!hideHeader && (
        <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-background px-4 pb-3 pt-4">
          <h2 className="flex min-h-9 min-w-0 flex-1 items-center gap-2 px-3 text-sm font-semibold text-foreground">
            <Menu className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">On this page</span>
          </h2>
          {headerAction}
        </div>
      )}
      <ul className="space-y-1 pl-3">
        {headings.map((heading) => {
          const isActive = activeId === heading.id;
          const indentClass = {
            1: 'pl-0',
            2: 'pl-3',
            3: 'pl-6',
            4: 'pl-9',
            5: 'pl-12',
            6: 'pl-15',
          }[heading.level] || 'pl-0';

          return (
            <li key={heading.id}>
              <button
                onClick={() => scrollToHeading(heading.id)}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  'w-full text-left text-sm py-1.5 rounded-md transition-colors',
                  'text-muted-foreground hover:text-foreground',
                  isActive && 'text-foreground font-medium',
                  indentClass
                )}
              >
                {heading.text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
