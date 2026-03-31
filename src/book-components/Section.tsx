import type { ReactNode } from 'react';

export interface SectionProps {
  children: ReactNode;
  id?: string;
  className?: string;
}

/**
 * Section within a chapter. Renders <section>.
 */
export function Section({ children, id, className }: SectionProps) {
  return (
    <section id={id} className={className ?? 'book-section'}>
      {children}
    </section>
  );
}
