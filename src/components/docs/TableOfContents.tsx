// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
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
}

export function TableOfContents({ content, className }: TableOfContentsProps) {
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
  }, [content]);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Don't update if user just manually clicked a TOC item
        if (isManualScroll) return;
        
        // Find the first heading that's in view
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.5, 1],
      }
    );

    // Observe all headings
    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [headings, isManualScroll]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100; // Account for fixed nav
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      // Set manual scroll flag to prevent IntersectionObserver from overriding
      setIsManualScroll(true);
      setActiveId(id);

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      // Re-enable IntersectionObserver after scroll completes
      setTimeout(() => {
        setIsManualScroll(false);
      }, 1000);
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className={cn('p-4', className)}>
      <h2 className="text-sm font-semibold text-foreground mb-3 px-3 flex items-center gap-2">
        <Menu className="h-4 w-4 text-muted-foreground" />
        On this page
      </h2>
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
