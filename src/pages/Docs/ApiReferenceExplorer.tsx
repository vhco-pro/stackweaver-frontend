// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { glassSurface } from '@/lib/surfaces';

/**
 * The rendered API reference (#794).
 *
 * Stackweaver publishes a complete OpenAPI 3 document but rendered it nowhere, so reading the
 * API meant pasting 770KB into an external tool. This renders it in place.
 *
 * The document is the one the docs build publishes, which is byte-identical to what the server
 * serves at /openapi/stable.json. Fetching it here rather than handing Scalar the URL is
 * deliberate: it is what makes the loading and error states ours, so a failed fetch shows a
 * retry instead of an empty pane that reads as "this API has no endpoints".
 */

/** The published document. Same bytes as GET /openapi/stable.json - see docs/api-reference/README.md. */
const DOCUMENT_URL = '/docs/api-reference/openapi.json';

/**
 * Scalar is loaded on demand, following the pattern the docs components already use for shiki,
 * mermaid and jszip. It is ~1.1MB gzipped across its own chunks, which must not enter the main
 * entry bundle for the benefit of readers who never open this page.
 */
/**
 * Scalar reaches third-party origins by default, and more than one feature does it:
 *
 *   - the default theme injects @font-face rules pointing at fonts.scalar.com;
 *   - the registry/"Ask AI" integration calls api.scalar.com, including
 *     `/vector/registry/search?query=` - which would send a reader's search terms to a vendor;
 *   - `telemetry` defaults to true.
 *
 * The configuration flags below turn each of those off, but flags are a promise a dependency
 * makes and can rename in a minor bump, at which point the calls resume silently. This guard is
 * the part that cannot regress: same-origin requests pass, everything else is refused before it
 * leaves the browser. A self-hosted Stackweaver renders its own documentation without calling
 * anyone, and an air-gapped one must not hang trying.
 */
const sameOriginFetch: typeof fetch = (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const resolved = new URL(url, window.location.href);
  if (resolved.origin !== window.location.origin) {
    return Promise.reject(
      new Error(`blocked a cross-origin request from the API reference: ${resolved.origin}`),
    );
  }
  return fetch(input, init);
};

async function loadScalar() {
  const [mod] = await Promise.all([
    import('@scalar/api-reference-react'),
    // Scoped to this chunk so the stylesheet is not fetched by anyone who never opens the page.
    import('@scalar/api-reference-react/style.css'),
  ]);
  return { ApiReference: mod.ApiReferenceReact as ComponentType<{ configuration: unknown }> };
}

/**
 * Scalar's dark surfaces, restated in the docs framework's slate family.
 *
 * Only dark mode differs enough to matter: Scalar paints #0f0f0f, a neutral near-black, against
 * the docs surface of #020617 - slate-950, visibly blue beside it. Light mode is #fff against
 * #f8fafc, a difference nobody can see, so it is left alone rather than churned.
 *
 * Keyed on `html.dark`, our own theme class, rather than Scalar's `.dark-mode`, which it puts on
 * <body>. Body is an ANCESTOR of this wrapper, so `.scalar-scope .dark-mode` selects nothing.
 * Custom properties inherit, so defining them on the wrapper reaches everything Scalar renders
 * inside it and nothing outside.
 *
 * Both families are needed. The sidebar does not read --scalar-background-*; it has its own
 * --scalar-sidebar-* set, and overriding only the first leaves a black sidebar against a navy
 * page - worse than the uniform grey it replaced.
 *
 * NOT overridden, deliberately: --scalar-background-alert, --scalar-background-danger and
 * --scalar-tooltip-background are `color-mix` expressions that hardcode #0f0f0f, so they keep a
 * faintly warmer base. They are small, rare, and chasing every derived colour would turn this
 * into a fork of Scalar's theme that silently drifts on each upgrade. The E2E spec asserts the
 * two surfaces that matter, so an upgrade that moves them fails a test rather than the page
 * quietly reverting to black.
 *
 * Contrast improves rather than degrades: slate-950 is darker than #0f0f0f, so every
 * light-on-dark element gains. Measured on the rendered page, text on the main surface comes out
 * at 4.63:1, 8.09:1 and 16.31:1 - all above the 4.5:1 WCAG AA threshold for body text.
 */
const SCALAR_DARK_SURFACES = `
  html.dark .scalar-scope {
    --scalar-background-1: #020617;
    --scalar-background-2: #0f172a;
    --scalar-background-3: #1e293b;
    --scalar-border-color: rgba(255, 255, 255, 0.1);

    --scalar-sidebar-background-1: #020617;
    --scalar-sidebar-border-color: rgba(255, 255, 255, 0.1);
    --scalar-sidebar-item-hover-background: #0f172a;
    --scalar-sidebar-item-active-background: #0f172a;
    --scalar-sidebar-search-background: #0f172a;
    --scalar-sidebar-search-border-color: rgba(255, 255, 255, 0.1);
    --scalar-sidebar-indent-border: rgba(255, 255, 255, 0.1);
    --scalar-sidebar-indent-border-hover: rgba(255, 255, 255, 0.2);
    --scalar-sidebar-indent-border-active: rgba(255, 255, 255, 0.2);
  }
`;

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className={`${glassSurface} w-full max-w-md p-8 text-center`}>{children}</div>
    </div>
  );
}

export default function ApiReferenceExplorer() {
  const { resolvedTheme } = useTheme();

  const apiDocument = useQuery({
    queryKey: ['openapi-document'],
    queryFn: async () => {
      const res = await fetch(DOCUMENT_URL);
      if (!res.ok) {
        throw new Error(`The API description could not be loaded (HTTP ${res.status}).`);
      }
      return (await res.json()) as unknown;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const scalar = useQuery({
    queryKey: ['scalar-renderer'],
    queryFn: loadScalar,
    staleTime: Infinity,
    retry: false,
  });

  const failed = apiDocument.error ?? scalar.error;
  const ready = scalar.data !== undefined && apiDocument.data !== undefined;

  return (
    // Full-bleed. Scalar ships its own sidebar, search and on-this-page rail, so nesting it in
    // the docs shell produced three navigation columns and left the reference itself a narrow
    // strip in the middle. The one piece of our chrome kept is a way back: Scalar has no
    // affordance that returns a reader to Stackweaver, and a full-page takeover with no exit is
    // its own defect.
    <div className="flex h-screen flex-col bg-white dark:bg-[#020617]">
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-2.5 dark:border-white/10">
        <Link
          to="/docs/api-reference"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Docs
        </Link>
        <span className="text-sm font-medium text-gray-900 dark:text-white">API Reference</span>
      </div>

      {failed ? (
        <Centered>
          <AlertCircle
            className="mx-auto mb-4 h-10 w-10 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
          {/* role=alert, because the failure this replaces was a blank pane that reads as
              "this API has no endpoints" rather than "the description did not load". */}
          <p role="alert" className="mb-6 text-sm text-gray-700 dark:text-gray-300">
            {failed.message}
          </p>
          <Button
            onClick={() => {
              if (apiDocument.error) void apiDocument.refetch();
              if (scalar.error) void scalar.refetch();
            }}
          >
            Retry
          </Button>
        </Centered>
      ) : !ready ? (
        <Centered>
          <Loader2
            className="mx-auto mb-4 h-8 w-8 animate-spin text-violet-600 dark:text-violet-400"
            aria-hidden="true"
          />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading the API description…</p>
        </Centered>
      ) : (
        // Scalar paints its own full-surface chrome, so it is given the width rather than being
        // nested inside another card. The wrapper is a named hook for scoping its styles if that
        // ever becomes necessary; measured today it does not leak, which the E2E spec pins by
        // comparing a neighbouring docs page against a context that never loaded the renderer.
        <div className="scalar-scope min-h-0 flex-1 overflow-auto">
          <scalar.data.ApiReference
            configuration={{
              content: apiDocument.data,
              darkMode: resolvedTheme === 'dark',
              // Scalar's default theme injects @font-face rules pointing at
              // https://fonts.scalar.com. Our CSP blocks font-src to 'self', so those requests
              // fail noisily on every load - and a self-hosted, air-gapped Stackweaver should
              // not be reaching a vendor CDN to render its own documentation. Off; the app's
              // own font stack applies instead, which also matches the surrounding docs.
              withDefaultFonts: false,
              hideClientButton: true,
              // Read-only for v1 by owner decision; live requests are tracked in #795.
              hideTestRequestButton: true,
              // Scalar's own toolbar ("Configure", "Share", "Deploy") and developer tools are
              // its platform's chrome, not ours. Both default to 'localhost', so they are
              // invisible in production and present in dev - a hostname heuristic is a poor
              // reason for a page to differ between the two. Off everywhere.
              showToolbar: 'never',
              showDeveloperTools: 'never',
              // "Ask AI" is Scalar's agent integration: a Scalar-branded chat drawer, with its
              // own terms-agreement prompt, backed by api.scalar.com. useAgent() enables it
              // whenever the page is on a local URL and otherwise only with an agent key - so
              // like the toolbar it would appear in dev and vanish in production. Disabled
              // explicitly: the guards below mean it could never work here anyway, and a
              // vendor's AI assistant is not something Stackweaver's own docs should offer.
              agent: { disabled: true },
              // Separate from the agent: Scalar also renders a "Generate MCP" link that hands
              // this document to its own MCP tooling. Same objection - it is the vendor's
              // platform surfacing inside Stackweaver's documentation.
              mcp: { disabled: true },
              // No usage reporting from a self-hosted product's own docs page.
              telemetry: false,
              // The registry / "Ask AI" integration calls api.scalar.com directly rather than
              // through the configured fetch. Point it at our own origin so the request cannot
              // leave the deployment even if the feature is somehow reached.
              externalUrls: {
                registryUrl: window.location.origin,
                dashboardUrl: window.location.origin,
                apiBaseUrl: window.location.origin,
                proxyUrl: '',
              },
              // Belt to the flags' braces - see sameOriginFetch above.
              fetch: sameOriginFetch,
              customFetch: sameOriginFetch,
              customCss: SCALAR_DARK_SURFACES,
              _integration: 'react',
            }}
          />
        </div>
      )}
    </div>
  );
}
