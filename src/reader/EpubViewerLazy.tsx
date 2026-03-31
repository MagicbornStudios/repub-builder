'use client';

import React, { lazy, Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { EpubViewerProps } from './EpubViewer';

const EpubViewer = lazy(async () => {
  const m = await import('./EpubViewer');
  return { default: m.default };
});

export default function EpubViewerLazy(props: EpubViewerProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-[400px] items-center justify-center gap-3 text-sm text-text-muted">
          <LoaderCircle size={18} className="animate-spin" />
          <span>Loading book...</span>
        </div>
      }
    >
      <EpubViewer {...props} />
    </Suspense>
  );
}

export type { EpubViewerProps } from './EpubViewer';
