import type { ReactNode } from 'react';

export interface BookRootProps {
  children: ReactNode;
  /** Optional className for the root wrapper */
  className?: string;
}

/**
 * Root wrapper for book content. Renders a semantic <main> with book class.
 * Use as the top-level component in MDX.
 */
export function BookRoot({ children, className }: BookRootProps) {
  return (
    <main className={className ?? 'book-root'} role="main">
      {children}
    </main>
  );
}
