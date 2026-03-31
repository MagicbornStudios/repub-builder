'use client';

import React from 'react';

export function ReaderEmptyCover({
  title,
  /** When false, hides the top "Empty" label so shelf status chips can sit in the overlay without overlap. */
  showTopLabel = true,
}: {
  title: string;
  showTopLabel?: boolean;
}) {
  const initials =
    title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'EB';

  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-lg border border-border bg-gradient-to-b from-muted/80 to-muted text-left shadow-inner">
      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-foreground/5 to-transparent" />
      <div className="flex flex-1 flex-col justify-between p-4">
        {showTopLabel ? (
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.34em] text-muted-foreground">
            Empty
          </div>
        ) : (
          <div className="min-h-[0.62rem]" aria-hidden />
        )}
        <div className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card font-display text-xl text-foreground">
            {initials}
          </div>
          <div>
            <div className="line-clamp-3 font-display text-xl leading-tight text-foreground">{title}</div>
            <div className="mt-2 text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground">
              Reader edition
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
