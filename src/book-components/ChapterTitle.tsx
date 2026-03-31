import type { ReactNode } from 'react';

export interface ChapterTitleProps {
  children: ReactNode;
  /** Heading level 1–6; default 1 for chapter */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
}

/**
 * Chapter or section title. Renders an <h1>–<h6> with book-title class.
 */
export function ChapterTitle({
  children,
  level = 1,
  className,
}: ChapterTitleProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <Tag className={className ?? 'book-title'}>{children}</Tag>
  );
}
