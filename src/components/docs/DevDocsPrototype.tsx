// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function DevDocsPrototype({ docPath, docsBase }: { docPath: string; docsBase: string }) {
  const src = '/__dev/docs-prototypes/' + docPath;
  const folder = docPath.includes('/') ? '/' + docPath.slice(0, docPath.lastIndexOf('/')) : '';
  const { data: source, isPending, isError, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['dev-docs-prototype', src], retry: false,
    queryFn: async () => {
      const response = await fetch(src, { method: 'HEAD' });
      if (!response.ok) throw new Error('Saved review is unavailable');
      return src;
    },
  });
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1>Saved HTML page</h1><p className="text-sm text-muted-foreground">Development preview from internal documentation.</p></div>
      <Link className="text-primary underline" to={`${docsBase}${folder}`}>Back to folder</Link>
    </div>
    {isPending ? <Skeleton className="h-96 w-full" /> : isError ? <div role="alert" className="space-y-3">
      <p>Saved review is unavailable</p><Button variant="outline" onClick={() => { void refetch(); }}>Retry</Button>
    </div> : <iframe key={`${src}:${dataUpdatedAt}`} title="Saved HTML page" src={source} sandbox="allow-scripts" referrerPolicy="no-referrer" className="w-full h-[80vh] min-h-[640px] rounded-xl border border-border bg-background" />}
  </section>;
}
