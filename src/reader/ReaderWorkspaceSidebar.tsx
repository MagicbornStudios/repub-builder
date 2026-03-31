'use client';

import React from 'react';
import { BookOpen, Home, LayoutGrid, LibraryBig, PanelLeftClose, PanelLeft, ScrollText } from 'lucide-react';
import type { ReaderLinkComponent } from './types';
import { readerChromeClasses as t } from './reader-chrome-theme';
import { readerAppHref } from './reader-routes';
import { Button } from './ui/button';

export type ReaderShellNavLink = { href: string; label: string };

function navItemClass(active: boolean): string {
  return active ? t.readerNavItemActive : t.readerNavItem;
}

function SidebarNavSections({
  showLabels,
  readerAppPath,
  isLibraryView,
  activeTitle,
  ReaderLink,
  extraLinks,
  showDesktopCollapse,
  expanded,
  onToggleExpanded,
}: {
  showLabels: boolean;
  readerAppPath: string;
  isLibraryView: boolean;
  activeTitle: string;
  ReaderLink: ReaderLinkComponent;
  extraLinks: ReaderShellNavLink[];
  showDesktopCollapse: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const Link = ReaderLink;
  const libraryHref = readerAppHref(readerAppPath);
  const rowPad = showLabels ? 'px-3' : 'justify-center px-2';
  const brandLinkClass = `block min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`;

  return (
    <>
      <div className={`flex items-center justify-between gap-2 border-b px-2 py-3 md:px-3 ${t.readerNavHeader}`}>
        {showLabels ? (
          <Link href={libraryHref} className={brandLinkClass}>
            <p className={`text-[0.65rem] font-semibold uppercase tracking-[0.2em] ${t.readerNavKicker}`}>Reader</p>
            <p className={`mt-0.5 truncate font-display text-sm ${t.readerNavTitle}`}>Workspace</p>
          </Link>
        ) : (
          <Link
            href={libraryHref}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-lg p-2 ${t.readerNavIconButton}`}
            aria-label="Reader library"
            title="Library"
          >
            <LibraryBig size={20} className="shrink-0 opacity-90" aria-hidden />
          </Link>
        )}
        {showDesktopCollapse ? (
          <Button
            onClick={onToggleExpanded}
            variant="outline"
            size="icon-sm"
            className={`shrink-0 ${t.readerNavIconButton}`}
            aria-label={expanded ? 'Collapse reader sidebar' : 'Expand reader sidebar'}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {expanded ? <PanelLeftClose size={18} aria-hidden /> : <PanelLeft size={18} aria-hidden />}
          </Button>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="Reader workspace">
        <Link
          href={libraryHref}
          className={`flex items-center gap-2.5 rounded-xl py-2.5 text-sm font-medium transition-colors ${rowPad} ${navItemClass(isLibraryView)}`}
        >
          <LibraryBig size={18} className="shrink-0 opacity-90" aria-hidden />
          {showLabels ? <span>Library</span> : <span className="sr-only">Library</span>}
        </Link>

        {!isLibraryView ? (
          <div
            className={`rounded-xl border py-2 ${showLabels ? 'px-3' : 'flex justify-center px-2'} ${t.readerNavNowReading}`}
          >
            {showLabels ? (
              <>
                <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${t.readerNavKicker}`}>
                  Now reading
                </p>
                <p className={`mt-1 line-clamp-2 font-display text-sm leading-snug ${t.readerNavTitle}`}>
                  {activeTitle}
                </p>
              </>
            ) : (
              <>
                <BookOpen size={20} className={t.iconAccent} aria-hidden />
                <span className="sr-only">Now reading: {activeTitle}</span>
              </>
            )}
          </div>
        ) : null}

        {extraLinks.length > 0 ? <div className={`my-2 h-px ${t.readerNavDivider}`} /> : null}

        {extraLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-xl py-2 text-sm transition-colors ${rowPad} ${navItemClass(false)}`}
          >
            {item.href === '/' ? (
              <Home size={17} className="shrink-0 opacity-90" aria-hidden />
            ) : item.href.startsWith('/docs') ? (
              <ScrollText size={17} className="shrink-0 opacity-90" aria-hidden />
            ) : item.href.startsWith('/apps') ? (
              <LayoutGrid size={17} className="shrink-0 opacity-90" aria-hidden />
            ) : (
              <span className="w-[17px] shrink-0" />
            )}
            {showLabels ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function ReaderWorkspaceSidebar({
  readerAppPath,
  isLibraryView,
  activeTitle,
  ReaderLink,
  expanded,
  onToggleExpanded,
  extraLinks = [],
}: {
  readerAppPath: string;
  isLibraryView: boolean;
  activeTitle: string;
  ReaderLink: ReaderLinkComponent;
  expanded: boolean;
  onToggleExpanded: () => void;
  extraLinks?: ReaderShellNavLink[];
}) {
  const shellClass = `${t.readerNavPanel} flex flex-col border-r`;

  return (
    <aside
      className={`hidden min-h-0 shrink-0 transition-[width] duration-200 ease-out md:flex md:flex-col ${expanded ? 'w-[15.5rem]' : 'w-[4.25rem]'} ${shellClass}`}
      aria-label="Reader workspace navigation"
    >
      <SidebarNavSections
        showLabels={expanded}
        readerAppPath={readerAppPath}
        isLibraryView={isLibraryView}
        activeTitle={activeTitle}
        ReaderLink={ReaderLink}
        extraLinks={extraLinks}
        showDesktopCollapse
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
      />
    </aside>
  );
}
