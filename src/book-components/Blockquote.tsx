import type { ReactNode } from "react";

export interface BlockquoteProps {
  children: ReactNode;
  cite?: string;
  className?: string;
}

export function Blockquote({ children, cite, className }: BlockquoteProps) {
  const cn = className ?? "book-blockquote";
  return (
    <blockquote className={cn}>
      <div className="book-blockquote-content">{children}</div>
      {cite ? <footer className="book-blockquote-cite">— {cite}</footer> : null}
    </blockquote>
  );
}
