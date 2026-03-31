import type { ReactNode } from 'react';

export interface FigureProps {
  children: ReactNode;
  caption?: string;
  alt?: string;
  className?: string;
}

export function Figure({
  children,
  caption,
  className,
}: FigureProps) {
  return (
    <figure className={className ?? 'book-figure'}>
      {children}
      {caption != null && caption !== '' ? (
        <figcaption className="book-figure-caption">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
