'use client';

import React from 'react';
import { ArrowUpRight, BookOpen, Clock3, PanelRightOpen } from 'lucide-react';
import type { ReaderBookEntry, ReaderLinkComponent, ReaderPlanningCockpitPayload } from './types';
import type { ReaderShelfStatus } from './reader-progress';
import { ReaderEmptyCover } from './ReaderEmptyCover';
import { useReaderModalStore } from './reader-modal-store';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { cn } from './ui/cn';

function statusBadgeClasses(kind: ReaderShelfStatus['kind']) {
  switch (kind) {
    case 'done':
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200';
    case 'progress':
      return 'border-primary/40 bg-primary/10 text-foreground';
    case 'coming-soon':
      return 'border-muted-foreground/35 bg-muted text-muted-foreground';
    default:
      return 'border-border bg-secondary text-secondary-foreground';
  }
}

/** Icon-only controls; reserved width keeps the title from colliding when they fade in on hover. */
const iconActionClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-[color,background-color,opacity] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const hoverActionClusterClass =
  'absolute right-0 top-0 z-10 flex gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100';

export function ReaderShelfCard({
  book,
  status,
  isActive,
  readerHref,
  ReaderLink,
  planningCockpitPayload,
  showStatusBadge = true,
}: {
  book: ReaderBookEntry;
  status: ReaderShelfStatus;
  isActive: boolean;
  readerHref: string;
  ReaderLink: ReaderLinkComponent;
  planningCockpitPayload?: ReaderPlanningCockpitPayload | null;
  showStatusBadge?: boolean;
}) {
  const openPlanningCockpit = useReaderModalStore((s) => s.openPlanningCockpit);
  const canOpen = book.hasEpub;
  const showPlanningCta = Boolean(canOpen && planningCockpitPayload);
  const description =
    book.description?.trim() || 'A built-in reading edition is prepared for the in-browser reader workspace.';
  const genres = book.genres?.filter((g) => g.trim()) ?? [];

  const cover = (
    <div className="relative aspect-[11/16] overflow-hidden rounded-lg">
      {book.coverImage ? (
        <img src={book.coverImage} alt={`${book.title} cover`} className="h-full w-full object-cover" />
      ) : (
        <ReaderEmptyCover title={book.title} showTopLabel={false} />
      )}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-3">
        {showStatusBadge || status.kind === 'coming-soon' ? (
          <Badge
            variant="outline"
            className={`px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.14em] shadow-sm ${statusBadgeClasses(status.kind)}`}
          >
            {status.label}
          </Badge>
        ) : null}
        {canOpen ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/70 text-foreground shadow-sm backdrop-blur-sm">
            <ArrowUpRight size={14} aria-hidden />
          </span>
        ) : null}
      </div>
    </div>
  );

  /** ~2× icon column + gap so long titles wrap under reserved strip, not under icons. */
  const titleReserveClass = 'min-w-0 pr-[4.5rem]';

  const headerRow = (
    <div className={`relative ${titleReserveClass}`}>
      <h2 className="font-display text-[1.35rem] leading-tight text-foreground">{book.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{book.author?.trim() || 'Portfolio edition'}</p>

      <div className={hoverActionClusterClass} role="toolbar" aria-label="Book actions">
        {canOpen ? (
          <ReaderLink
            href={readerHref}
            className={iconActionClass}
            title="Open in reader workspace"
            aria-label="Open in reader workspace"
          >
            <BookOpen size={16} aria-hidden />
          </ReaderLink>
        ) : null}
        {showPlanningCta && planningCockpitPayload ? (
          <Button
            type="button"
            onClick={() => openPlanningCockpit(planningCockpitPayload)}
            variant="outline"
            size="icon"
            className={iconActionClass}
            title="Planning cockpit"
            aria-label="Open planning cockpit"
          >
            <PanelRightOpen size={16} aria-hidden />
          </Button>
        ) : null}
        {!canOpen ? (
          <span
            className={`${iconActionClass} cursor-default hover:bg-card/95 hover:text-muted-foreground`}
            title="Reading build not emitted yet"
            aria-label="Reading build not emitted yet"
            role="note"
          >
            <Clock3 size={16} aria-hidden />
          </span>
        ) : null}
      </div>
    </div>
  );

  const metaBlock = (
    <div className="mt-4 min-w-0 flex-1 space-y-2">
      {genres.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Genres">
          {genres.map((g) => (
            <Badge
              key={g}
              variant="outline"
              className="border-border bg-muted/60 px-2.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground"
            >
              {g}
            </Badge>
          ))}
        </div>
      ) : null}
      <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );

  const coverBlock =
    canOpen ? (
      <ReaderLink
        href={readerHref}
        className="mt-4 block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {cover}
      </ReaderLink>
    ) : (
      <div className="mt-4">{cover}</div>
    );

  return (
    <Card
      className={cn(
        'group relative flex h-full flex-col p-5 transition-[box-shadow,background-color,border-color] hover:border-border hover:bg-muted/15 hover:shadow-md',
        isActive ? 'ring-2 ring-primary/35 ring-offset-2 ring-offset-background' : '',
      )}
    >
      {headerRow}
      {coverBlock}
      {metaBlock}
    </Card>
  );
}
