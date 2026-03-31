'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardList, PanelRight } from 'lucide-react';
import type { ReaderLinkComponent, ReaderPlanningStripConfig } from './types';
import { useReaderModalStore } from './reader-modal-store';
import { Button } from './ui/button';

export function ReaderPlanningStrip({
  open,
  onToggle,
  config,
  ReaderLink,
}: {
  bookSlug?: string;
  open: boolean;
  onToggle: () => void;
  config: ReaderPlanningStripConfig | null;
  ReaderLink: ReaderLinkComponent;
}) {
  const openPlanningCockpit = useReaderModalStore((s) => s.openPlanningCockpit);

  if (!config) return null;

  const planningLinks = config.planningLinks ?? [];
  const hasPlanningLinks = planningLinks.length > 0;

  return (
    <div className="shrink-0 border-b border-border bg-muted/30">
      <div className="mx-auto flex max-w-[120rem] flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {hasPlanningLinks ? (
            <Button type="button" variant="secondary" size="sm" onClick={onToggle} className="rounded-full uppercase tracking-[0.12em]">
              <ClipboardList size={14} />
              Planning
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => openPlanningCockpit(config.cockpitPayload)}
            className="rounded-full uppercase tracking-[0.12em]"
          >
            <PanelRight size={14} />
            Planning cockpit
          </Button>
        </div>
        <p className="max-w-md text-[0.65rem] text-muted-foreground">
          Opens the modular cockpit (uploads + repo pane); optional EPUB tab — no need to leave the reader.
        </p>
      </div>
      <AnimatePresence initial={false}>
        {open && hasPlanningLinks ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-border/60"
          >
            <div className="mx-auto flex max-w-[120rem] flex-wrap gap-2 px-4 py-3 md:px-5">
              {planningLinks.map((item) => (
                <ReaderLink
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  {item.label}
                </ReaderLink>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
