// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

declare module 'shiki' {
  export interface Highlighter {
    codeToHtml(code: string, options?: {
      lang?: string;
      themes?: string[];
      defaultColor?: string;
      theme?: string;
      [key: string]: unknown;
    }): string;
  }
  
  export function getHighlighter(options?: {
    themes?: string[];
    langs?: string[];
  }): Promise<Highlighter>;
  
  export function codeToHtml(code: string, options?: {
    lang?: string;
    themes?: string[] | { light: string; dark: string };
    defaultColor?: string;
    theme?: string;
    [key: string]: unknown;
  }): Promise<string>;
  
  export default {
    getHighlighter,
    codeToHtml,
  };
}

