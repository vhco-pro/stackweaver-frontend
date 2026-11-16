// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import type { Brand } from '@/lib/brands';
import { cn } from '@/lib/utils';
import './brand-icon.css';

/**
 * A brand logo sized to the surrounding text. Both theme variants are in the markup and CSS shows one,
 * so prerendered pages need no script to pick the right artwork. Decorative by default: the brand name
 * is always in the adjacent text; pass `label` where the logo stands alone.
 */
export function BrandIcon({ brand, className, label }: { brand: Brand; className?: string; label?: string }) {
  const accessible = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return <span className={cn('brand-icon', brand.dark && 'brand-icon-themed', className)} data-brand={brand.id} {...accessible}>
    <img src={brand.light} alt="" className="brand-icon-light" decoding="async" draggable={false}/>
    {brand.dark && <img src={brand.dark} alt="" className="brand-icon-dark" decoding="async" draggable={false}/>}
  </span>;
}
