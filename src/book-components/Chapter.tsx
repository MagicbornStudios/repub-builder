import type { ReactNode } from 'react';

export interface ChapterProps {
  children: ReactNode;
  id?: string;
  className?: string;
}

/**
 * Wraps a chapter as a semantic <article> with optional id for linking.
 */
export function Chapter({ children, id, className }: ChapterProps) {
  return (
    <article id={id} className={className ?? 'book-chapter'}>
      {children}
    </article>
  );
}
