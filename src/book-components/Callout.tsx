import type { ReactNode } from "react";

export type CalloutVariant = "note" | "warning" | "tip" | "info" | "quote";

export interface CalloutProps {
  children: ReactNode;
  type?: CalloutVariant;
  title?: string;
  className?: string;
}

export function Callout({
  children,
  type = "note",
  title,
  className,
}: CalloutProps) {
  const cn = className ?? "book-callout";
  return (
    <blockquote className={cn} data-callout={type} role="note">
      {title ? <p className="book-callout-title">{title}</p> : null}
      <div className="book-callout-body">{children}</div>
    </blockquote>
  );
}
