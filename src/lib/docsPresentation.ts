// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import type { DocsCodeBlockPresentation } from '@/components/docs/DocsEnvironment';

/**
 * Stackweaver's own choice of docs code frame. The docs framework defaults to the framed style
 * with the default tone; Stackweaver selects the deep tone, which darkens the fills in dark mode.
 * Shared by the SPA host and the prerendered public pages so both render the same frames.
 */
export const stackweaverDocsCodeBlocks: DocsCodeBlockPresentation = { tone: 'deep' };
