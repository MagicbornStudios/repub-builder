/**
 * Reader workspace chrome uses the same Tailwind / shadcn semantic tokens as the portfolio app
 * (`bg-background`, `border-border`, `text-foreground`, etc. from `globals.css`).
 *
 * The former "ember" / "ink" toggle was an alternate palette; the reader now always follows site theme.
 */
export const readerChromeClasses = {
  shell: 'bg-background text-foreground',
  headerBar: 'border-border bg-card/95 supports-[backdrop-filter]:backdrop-blur-sm',
  headerWell: '',
  title: 'text-foreground',
  kicker: '',
  iconAccent: 'text-primary',
  tabList: 'border-border bg-muted/50',
  tabActive: 'border-primary/60 bg-primary/15 text-foreground shadow-sm',
  tabInactive:
    'border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
  tabDisabled: 'border-border bg-muted/40 text-muted-foreground opacity-70',
  pillButton:
    'border-border bg-secondary text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground',
  inset: 'border-border bg-card shadow-lg',
  libraryDragRing: 'ring-primary/35',
  librarySection: 'border-border bg-muted/25',
  libraryImportCard: 'border-border bg-card',
  searchIcon: 'text-muted-foreground',
  searchInput:
    'border-input bg-background text-foreground shadow-inner placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35',
  mutedText: 'text-muted-foreground',
  emptyState: 'border-dashed border-border bg-muted/30 text-muted-foreground',
  chip: 'border-border bg-secondary text-secondary-foreground transition-colors hover:bg-muted',
  chipActive: 'border-primary/55 bg-primary/15 text-foreground',
  readerNavPanel: 'border-border bg-card',
  readerNavHeader: 'border-border bg-muted/40',
  readerNavKicker: 'text-muted-foreground',
  readerNavTitle: 'text-foreground',
  readerNavIconButton:
    'border-border bg-secondary text-foreground transition-colors hover:bg-muted',
  readerNavItem:
    'border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground',
  readerNavItemActive: 'border-primary/45 bg-muted font-medium text-foreground',
  readerNavNowReading: 'border-border bg-muted/40',
  readerNavDivider: 'bg-border',
} as const;

export type ReaderChromeClasses = typeof readerChromeClasses;
