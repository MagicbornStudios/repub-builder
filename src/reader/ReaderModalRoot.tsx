'use client';

import React, { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useReaderModalStore } from './reader-modal-store';
import type { ReaderPlanningCockpitPayload } from './types';
import { Button } from './ui/button';

export function ReaderModalRoot({
  renderPlanningCockpit,
  epubPlanningContext,
  repoPlannerAppHref = '/apps/repo-planner',
}: {
  renderPlanningCockpit?: (
    payload: ReaderPlanningCockpitPayload,
    onClose: () => void,
    epubPlanning?: { buffer: ArrayBuffer; bookSlug: string } | null,
  ) => ReactNode;
  /** Active built-in EPUB bytes for planning extraction (same slug as modal payload when aligned). */
  epubPlanningContext?: { buffer: ArrayBuffer; bookSlug: string } | null;
  /** In-app link shown in the modal header (host route to full Repo Planner app). */
  repoPlannerAppHref?: string;
}) {
  const open = useReaderModalStore((s) => s.open);
  const payload = useReaderModalStore((s) => s.payload);
  const close = useReaderModalStore((s) => s.closePlanningCockpit);

  if (!open || !payload || !renderPlanningCockpit) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6">
      <Button
        type="button"
        aria-label="Close"
        variant="ghost"
        onClick={close}
        className="absolute inset-0 z-0 h-full min-h-full w-full rounded-none border-0 bg-black/75 p-0 backdrop-blur-sm hover:bg-black/75 focus-visible:ring-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Repo Planner cockpit"
        className="relative z-[201] flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-dark-alt shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/80 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Repo Planner</p>
            <h2 className="font-display text-xl text-primary sm:text-2xl">Planning cockpit</h2>
            <p className="mt-1 max-w-2xl text-xs text-text-muted sm:text-sm">
              Same client as{' '}
              <a href={repoPlannerAppHref} className="text-accent underline" onClick={close}>
                Apps - Repo Planner
              </a>
              . From the reader you can open this modal with planning packs for the active work — no second reader
              inside the cockpit.
            </p>
          </div>
          <Button
            type="button"
            onClick={close}
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full border-border text-text-muted hover:border-accent hover:text-primary"
            aria-label="Close"
          >
            <X size={20} />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
          {renderPlanningCockpit(payload, close, epubPlanningContext ?? null)}
        </div>
      </div>
    </div>
  );
}
