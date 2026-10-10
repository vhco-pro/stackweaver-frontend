// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { MermaidConfig } from 'mermaid';

export type MermaidThemeMode = 'light' | 'dark';

/**
 * Placeholder gradient id referenced from the theme CSS. Mermaid's config is global, so the id
 * cannot be made unique per diagram there; withBrandGradient() rewrites it per rendered SVG.
 */
const GRADIENT_ID = 'sw-mermaid-gradient';

const FONT_FAMILY = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

interface Palette {
  node: string;
  text: string;
  mutedText: string;
  line: string;
  softLine: string;
  cluster: string;
  clusterBorder: string;
  clusterText: string;
  labelBackground: string;
  note: string;
  noteBorder: string;
  activation: string;
}

// Light mode gets real light values and dark mode sits beside it (issue #680): the diagram is
// drawn on the page's own surface, so one palette cannot serve both.
const PALETTES: Record<MermaidThemeMode, Palette> = {
  dark: {
    node: '#0b1324',
    text: '#e2e8f0',
    mutedText: '#94a3b8',
    line: '#6366f1',
    softLine: '#475569',
    cluster: 'rgba(56,189,248,0.045)',
    clusterBorder: 'rgba(148,163,184,0.28)',
    clusterText: '#67e8f9',
    labelBackground: '#0b1324',
    note: 'rgba(168,85,247,0.14)',
    noteBorder: 'rgba(168,85,247,0.55)',
    activation: '#22d3ee',
  },
  light: {
    node: '#ffffff',
    text: '#0f172a',
    mutedText: '#475569',
    line: '#6366f1',
    softLine: '#94a3b8',
    cluster: 'rgba(99,102,241,0.045)',
    clusterBorder: 'rgba(100,116,139,0.35)',
    clusterText: '#4f46e5',
    labelBackground: '#ffffff',
    note: 'rgba(168,85,247,0.10)',
    noteBorder: 'rgba(147,51,234,0.5)',
    activation: '#06b6d4',
  },
};

function themeCss(c: Palette): string {
  return `
    .node rect,.node polygon,.node circle,.node path,rect.actor{stroke:url(#${GRADIENT_ID}) ${c.line}!important;stroke-width:1.6px!important}
    .node rect,rect.actor{rx:10px;ry:10px}
    .cluster rect{rx:14px;ry:14px;stroke-dasharray:5 4;stroke-width:1px!important}
    .cluster-label,.cluster-label span,.cluster text{font-weight:600;letter-spacing:.04em;font-size:12.5px!important;fill:${c.clusterText}!important;color:${c.clusterText}!important}
    .flowchart-link,.messageLine0,.messageLine1{stroke-width:1.5px!important;opacity:.9}
    .edgeLabel,.edgeLabel span,.edgeLabel p{font-size:12.5px!important;color:${c.mutedText}!important;fill:${c.mutedText}!important;background:${c.labelBackground}!important}
    .actor-line{stroke-dasharray:3 4}
    .messageText{font-size:13px!important}
  `;
}

/**
 * The Stackweaver house style for Mermaid diagrams: glass nodes with the brand gradient border,
 * dashed group panels, and the app's own font, paired for light and dark.
 */
export function mermaidConfig(mode: MermaidThemeMode): MermaidConfig {
  const c = PALETTES[mode];
  return {
    startOnLoad: false,
    // AUD-078: 'strict' sanitizes rendered HTML and disallows click-handlers/script in diagram
    // source, closing a stored-XSS vector (diagrams come from Markdown docs that can be
    // contributed via PR). 'loose' would let a crafted diagram inject markup/handlers.
    securityLevel: 'strict',
    // 'base' is the only Mermaid theme that honours themeVariables in full; the named themes
    // override most of them.
    theme: 'base',
    look: 'classic',
    flowchart: { wrappingWidth: 220, padding: 14, nodeSpacing: 44, rankSpacing: 52 },
    themeVariables: {
      darkMode: mode === 'dark',
      fontFamily: FONT_FAMILY,
      fontSize: '15px',
      background: 'transparent',
      primaryColor: c.node,
      primaryTextColor: c.text,
      primaryBorderColor: c.line,
      lineColor: c.line,
      secondaryColor: c.node,
      tertiaryColor: c.node,
      mainBkg: c.node,
      nodeBorder: c.line,
      textColor: c.text,
      clusterBkg: c.cluster,
      clusterBorder: c.clusterBorder,
      titleColor: c.clusterText,
      edgeLabelBackground: c.labelBackground,
      actorBkg: c.node,
      actorBorder: c.line,
      actorTextColor: c.text,
      actorLineColor: c.softLine,
      signalColor: c.line,
      signalTextColor: c.text,
      labelBoxBkgColor: c.node,
      labelBoxBorderColor: c.clusterBorder,
      labelTextColor: c.mutedText,
      loopTextColor: c.mutedText,
      noteBkgColor: c.note,
      noteBorderColor: c.noteBorder,
      noteTextColor: c.text,
      activationBkgColor: c.activation,
      activationBorderColor: c.activation,
      sequenceNumberColor: c.node,
    },
    themeCSS: themeCss(c),
  };
}

/**
 * Adds the brand gradient definition to a rendered diagram and points the theme CSS at it.
 * The gradient id is made unique per diagram so several diagrams on one page never share a
 * definition that a hidden or unmounted sibling owns. The theme CSS carries a solid fallback
 * colour, so a diagram still gets a border if the definition is ever missing.
 */
export function withBrandGradient(svg: string, diagramId: string): string {
  const gradientId = `${GRADIENT_ID}-${diagramId}`;
  const defs =
    `<defs><linearGradient id="${gradientId}" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">` +
    '<stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#3b82f6"/><stop offset="1" stop-color="#a855f7"/>' +
    '</linearGradient></defs>';
  // Match the bare fragment, not the whole url(): Mermaid's CSS pass may quote the reference
  // (url("#id")), and a reference that misses its definition paints no border at all.
  return svg
    .replaceAll(`#${GRADIENT_ID}`, `#${gradientId}`)
    .replace(/(<svg[^>]*>)/, `$1${defs}`);
}
