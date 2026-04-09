'use client';

import React, { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useReaderModalStore } from './reader-modal-store';
import { Button } from './ui/button';

export function ReaderModalRoot({
  renderContent,
  ariaLabel = 'Reader dialog',
}: {
  renderContent?: (payload: unknown, onClose: () => void) => ReactNode;
  /** Accessible name for the dialog surface (host can override). */
  ariaLabel?: string;
}) {
  const open = useReaderModalStore((s) => s.open);
  const payload = useReaderModalStore((s) => s.payload);
  const close = useReaderModalStore((s) => s.closeReaderModal);

  if (!open || payload === null || !renderContent) return null;

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
        aria-label={ariaLabel}
        className="relative z-[201] flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-dark-alt shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-end border-b border-border/80 px-3 py-2 sm:px-4">
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
          {renderContent(payload, close)}
        </div>
      </div>
    </div>
  );
}
