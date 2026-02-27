// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

declare module 'react-use-measure' {
  export interface RectReadOnly {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  }
  
  export type UseMeasureResult<T extends HTMLElement = HTMLDivElement> = [
    (node: T | null) => void,
    RectReadOnly
  ];
  
  export default function useMeasure<T extends HTMLElement = HTMLDivElement>(
    options?: {
      offset?: boolean;
      scroll?: boolean;
      debounce?: number | { scroll?: number; resize?: number };
    }
  ): UseMeasureResult<T>;
}

