// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { Cloud } from 'lucide-react';
import { brandById } from '@/lib/brands';
import { defaultLogo } from '@/lib/brandAssets';
import { cn } from '@/lib/utils';
import { providerIconSource, type ProviderBrandId } from './providerIconSource';

function ThemedBrand({ id, className }: { id: ProviderBrandId; className?: string }) {
  const brand = brandById(id, 'all');
  if (!brand) return <Cloud className={cn('text-muted-foreground', className)} aria-hidden="true" />;
  return (
    <>
      <img src={brand.light} alt="" aria-hidden="true" className={cn('object-contain', brand.dark && 'dark:hidden', className)} />
      {brand.dark && <img src={brand.dark} alt="" aria-hidden="true" className={cn('hidden object-contain dark:block', className)} />}
    </>
  );
}

/** The OpenTofu mark, for rows that belong to the engine rather than to a provider (outputs). */
export function OpenTofuIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <ThemedBrand id="opentofu" className={className} />;
}

/** The icon of the provider behind a resource; see providerIconSource for what each one shows. */
export function ProviderIcon({ providerName, resourceType, className = 'h-4 w-4' }: {
  providerName?: string;
  resourceType?: string;
  className?: string;
}) {
  const source = providerIconSource(providerName, resourceType);
  // A file that fails to load falls back to the neutral icon; keyed by its path, so another
  // provider's icon is tried afresh.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  switch (source.kind) {
    case 'brand':
      return <ThemedBrand id={source.id} className={className} />;
    case 'stackweaver':
      return <img src={defaultLogo} alt="" aria-hidden="true" className={cn('object-contain', className)} />;
    case 'file':
      if (failedSrc !== source.src) {
        return (
          <img
            src={source.src}
            alt=""
            aria-hidden="true"
            className={cn('object-contain', className)}
            onError={() => { setFailedSrc(source.src); }}
          />
        );
      }
      return <Cloud className={cn('text-muted-foreground', className)} aria-hidden="true" />;
    case 'generic':
      return <Cloud className={cn('text-muted-foreground', className)} aria-hidden="true" />;
  }
}
