// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

declare module 'motion/react' {
  import * as React from 'react';
  
  // Motion library uses complex animation values that can be numbers, strings, or objects
  // These types need to be flexible for library compatibility
  type AnimationValue = number | string | Record<string, unknown> | Array<number | string>;
  type DragInfo = { point: { x: number; y: number }; offset: { x: number; y: number }; velocity: { x: number; y: number } };
  
  export interface HTMLMotionProps<T extends keyof HTMLElementTagNameMap = 'div'> 
    extends Omit<React.HTMLAttributes<HTMLElementTagNameMap[T]>, 'style'> {
    initial?: AnimationValue | Variant | Variants;
    animate?: AnimationValue | Variant | Variants;
    exit?: AnimationValue | Variant | Variants;
    variants?: Variants;
    transition?: Transition;
    whileHover?: AnimationValue | Variant;
    whileTap?: AnimationValue | Variant;
    whileFocus?: AnimationValue | Variant;
    whileInView?: AnimationValue | Variant;
    viewport?: { root?: Element; margin?: string; amount?: number | 'some' | 'all'; once?: boolean };
    layout?: boolean | 'position' | 'size' | 'preserve-aspect';
    layoutId?: string;
    layoutDependency?: unknown;
    layoutRoot?: boolean;
    drag?: boolean | 'x' | 'y' | 'lockDirection';
    dragConstraints?: { top?: number; left?: number; right?: number; bottom?: number } | React.RefObject<Element>;
    dragElastic?: number;
    dragMomentum?: boolean;
    dragTransition?: Transition;
    dragPropagation?: boolean;
    dragDirectionLock?: boolean;
    onDrag?: (event: MouseEvent | TouchEvent | PointerEvent, info: DragInfo) => void;
    onDragStart?: (event: MouseEvent | TouchEvent | PointerEvent, info: DragInfo) => void;
    onDragEnd?: (event: MouseEvent | TouchEvent | PointerEvent, info: DragInfo) => void;
    // CSSProperties declares x, y and scale itself (as plain values), which would otherwise
    // intersect the MotionValue away from the transform shorthands below.
    style?: Omit<React.CSSProperties, 'opacity' | 'visibility' | 'pointerEvents' | 'clipPath' | 'x' | 'y' | 'scale'> & {
      // Properties a scroll-linked MotionValue may drive directly.
      opacity?: number | string | MotionValue<number>;
      visibility?: React.CSSProperties['visibility'] | MotionValue<string>;
      pointerEvents?: React.CSSProperties['pointerEvents'] | MotionValue<string>;
      clipPath?: string | MotionValue<string>;
      rotateX?: number | string | MotionValue<number>;
      rotateY?: number | string | MotionValue<number>;
      rotateZ?: number | string | MotionValue<number>;
      x?: number | string | MotionValue<number>;
      y?: number | string | MotionValue<number>;
      z?: number | string | MotionValue<number>;
      scale?: number | string | MotionValue<number>;
      scaleX?: number | string | MotionValue<number>;
      scaleY?: number | string | MotionValue<number>;
      scaleZ?: number | string | MotionValue<number>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }
  
  export interface SVGMotionProps<T extends keyof SVGElementTagNameMap = 'svg'>
    extends React.SVGProps<SVGElementTagNameMap[T]> {
    initial?: AnimationValue | Variant | Variants;
    animate?: AnimationValue | Variant | Variants;
    exit?: AnimationValue | Variant | Variants;
    variants?: Variants;
    transition?: Transition;
    [key: string]: unknown;
  }
  
  export interface Transition {
    duration?: number;
    delay?: number;
    ease?: number[] | string;
    times?: number[];
    repeat?: number;
    repeatType?: 'loop' | 'reverse' | 'mirror';
    repeatDelay?: number;
    [key: string]: unknown;
  }
  
  export interface SpringOptions {
    stiffness?: number;
    damping?: number;
    mass?: number;
    velocity?: number;
    restSpeed?: number;
    restDelta?: number;
  }
  
  export interface Variant {
    [key: string]: unknown;
  }
  
  export type Variants = {
    [key: string]: Variant;
  };
  
  export interface TargetAndTransition {
    [key: string]: unknown;
  }
  
  export interface UseInViewOptions {
    root?: Element | null;
    margin?: string;
    amount?: 'some' | 'all' | number;
    once?: boolean;
  }
  
  export type MotionValue<T = number> = {
    get(): T;
    set(newValue: T, render?: boolean): void;
    update(updater: (latest: T) => T): void;
    onChange(subscription: (latest: T) => void): () => void;
    on(event: 'change', subscription: (latest: T) => void): () => void;
  };
  
  export function useMotionValue<T>(initial: T): MotionValue<T>;
  export function useSpring(source: MotionValue<number> | number, config?: SpringOptions): MotionValue<number>;
  export function useTransform<T, O>(value: MotionValue<T>, transform: (latest: T) => O): MotionValue<O>;
  export function useTransform<T, O>(value: MotionValue<T>, input: [T, T], output: [O, O]): MotionValue<O>;
  export function useTransform<T, O>(value: MotionValue<T>, input: T[], output: O[]): MotionValue<O>;
  export function useInView(ref: React.RefObject<Element>, options?: UseInViewOptions): boolean;

  export interface UseScrollOptions {
    /** The element whose passage through the viewport is tracked. */
    target?: React.RefObject<Element | null>;
    container?: React.RefObject<Element | null>;
    /** Intersections of target and container that mark progress 0 and 1, e.g. ['start start', 'end end']. */
    offset?: string[];
    axis?: 'x' | 'y';
  }
  export function useScroll(options?: UseScrollOptions): {
    scrollX: MotionValue<number>;
    scrollY: MotionValue<number>;
    scrollXProgress: MotionValue<number>;
    scrollYProgress: MotionValue<number>;
  };
  export function useMotionValueEvent<T>(value: MotionValue<T>, event: 'change', callback: (latest: T) => void): void;
  /** True when the visitor asked the system for reduced motion; null before that is known. */
  export function useReducedMotion(): boolean | null;
  export function isMotionComponent(component: unknown): boolean;
  
  export const motion: {
    [K in keyof HTMLElementTagNameMap]: React.ComponentType<HTMLMotionProps<K>>;
  } & {
    [K in keyof SVGElementTagNameMap]: React.ComponentType<SVGMotionProps<K>>;
  } & {
    create: <T extends React.ElementType>(component: T) => React.ComponentType<React.ComponentProps<T> & HTMLMotionProps>;
    div: React.ComponentType<HTMLMotionProps<'div'>>;
    span: React.ComponentType<HTMLMotionProps<'span'>>;
    svg: React.ComponentType<SVGMotionProps<'svg'>>;
    circle: React.ComponentType<SVGMotionProps<'circle'>>;
    line: React.ComponentType<SVGMotionProps<'line'>>;
    [key: string]: React.ComponentType<unknown> | ((component: React.ElementType) => React.ComponentType<unknown>);
  };
  
  export const AnimatePresence: React.ComponentType<{
    children?: React.ReactNode;
    initial?: boolean;
    exitBeforeEnter?: boolean;
    mode?: 'sync' | 'wait' | 'popLayout';
    presenceAffectsLayout?: boolean;
    onExitComplete?: () => void;
  }>;
  
  export default motion;
}

