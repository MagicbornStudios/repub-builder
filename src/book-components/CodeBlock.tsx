import type { ReactNode } from 'react';

export interface CodeBlockProps {
  children: ReactNode;
  language?: string;
  title?: string;
  className?: string;
}

export function CodeBlock({
  children,
  language,
  title,
  className,
}: CodeBlockProps) {
  return (
    <div className={className ?? 'book-code-block'}>
      {title != null && title !== '' ? (
        <div className="book-code-block-title">{title}</div>
      ) : null}
      <pre>
        <code data-language={language ?? undefined}>{children}</code>
      </pre>
    </div>
  );
}
