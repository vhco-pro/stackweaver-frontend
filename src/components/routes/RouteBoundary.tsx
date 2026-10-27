// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { Component, Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface RecoveryProps { children: ReactNode; destination: string; publicDocs: boolean }
interface RecoveryState { failed: boolean; destination: string }

class RouteRecovery extends Component<RecoveryProps, RecoveryState> {
  state: RecoveryState = { failed: false, destination: this.props.destination };

  static getDerivedStateFromError(): Partial<RecoveryState> { return { failed: true }; }

  static getDerivedStateFromProps(props: RecoveryProps, state: RecoveryState): Partial<RecoveryState> | null {
    // Reset only a failed boundary. Successful pages keep their state on parameter changes.
    return props.destination !== state.destination ? { failed: false, destination: props.destination } : null;
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={this.props.publicDocs ? 'flex min-h-[360px] items-center justify-center px-6 pb-6 pt-36' : 'flex min-h-[240px] items-center justify-center p-6'}>
        <div role="alert" className="space-y-4 text-center">
          <p className="font-medium">This page could not be loaded.</p>
          <p className="text-sm text-muted-foreground">Reload to try again and get the latest version.</p>
          <Button variant="outline" onClick={() => { window.location.reload(); }}>Reload page</Button>
        </div>
      </div>
    );
  }
}

function PageLoading({ publicDocs }: { publicDocs: boolean }) {
  return <>
    <div role="status" className={publicDocs ? 'mx-auto max-w-5xl space-y-6 px-6 pt-36' : 'min-h-[240px] space-y-6 p-6'}>
      <p className="text-muted-foreground">Loading page...</p>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-8 w-2/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  </>;
}

export function RouteBoundary({ children, publicDocs = false }: { children: ReactNode; publicDocs?: boolean }) {
  const location = useLocation();
  return <RouteRecovery destination={`${location.pathname}${location.search}${location.hash}`} publicDocs={publicDocs}><Suspense fallback={<PageLoading publicDocs={publicDocs} />}>{children}</Suspense></RouteRecovery>;
}
