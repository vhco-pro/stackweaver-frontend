// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

'use client';

/* eslint-disable react-hooks/static-components */
import * as React from 'react';
import { motion, isMotionComponent, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';

type AnyProps = Record<string, unknown>;

type DOMMotionProps<T extends HTMLElement = HTMLElement> = Omit<
  HTMLMotionProps<keyof HTMLElementTagNameMap>,
  'ref'
> & { ref?: React.Ref<T> };

type WithAsChild<Base extends object> =
  | (Base & { asChild: true; children: React.ReactElement })
  | (Base & { asChild?: false | undefined });

type SlotProps<T extends HTMLElement = HTMLElement> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children?: any;
} & DOMMotionProps<T>;

function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref).current = node;
      }
    });
  };
}

function mergeProps<T extends HTMLElement>(
  childProps: AnyProps,
  slotProps: DOMMotionProps<T>,
): AnyProps {
  const merged: AnyProps = { ...childProps, ...slotProps };

  if (childProps.className || slotProps.className) {
    merged.className = cn(
      childProps.className as string,
      slotProps.className as string,
    );
  }

  if (childProps.style || slotProps.style) {
    merged.style = {
      ...(childProps.style as React.CSSProperties),
      ...(slotProps.style as React.CSSProperties),
    };
  }

  return merged;
}

function Slot<T extends HTMLElement = HTMLElement>({
  children,
  ref,
  ...props
}: SlotProps<T>) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const childType = React.isValidElement(children) ? children.type : null;
  let isAlreadyMotion = false;
  if (childType && typeof childType === 'object' && childType !== null && typeof childType !== 'function') {
    try {
      isAlreadyMotion = isMotionComponent(childType);
    } catch {
      isAlreadyMotion = false;
    }
  }

  // motion.create is designed to be called during render - this is the intended pattern
  const Base = React.useMemo(
    () => {
      if (!childType || typeof childType !== 'object') return null;
      return isAlreadyMotion
        ? (childType as React.ElementType)
        : motion.create(childType as React.ElementType);
    },
    [isAlreadyMotion, childType],
  );

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  if (!React.isValidElement(children) || !Base) return null;

  const { ref: childRef, ...childProps } = children.props as AnyProps;

  const mergedProps = mergeProps(childProps, props);

  // Base component is created via useMemo above - this is the intended pattern for motion components
  return (
    <Base {...mergedProps} ref={mergeRefs(childRef as React.Ref<T>, ref)} />
  );
}

export {
  Slot,
  type SlotProps,
  type WithAsChild,
  type DOMMotionProps,
  type AnyProps,
};
