export interface BookMetaProps {
  title?: string;
  author?: string;
  description?: string;
  /** Additional key-value metadata (e.g. isbn, publisher) */
  [key: string]: string | undefined;
}

/**
 * Book metadata block. Renders a hidden or visible metadata section for repub.json / EPUB.
 * In static HTML output this can be a <dl> or a script/json block; consumers (repub pack, epub) read it.
 */
export function BookMeta({
  title,
  author,
  description,
  ...rest
}: BookMetaProps) {
  const entries = [
    ...(title ? [['title', title]] : []),
    ...(author ? [['author', author]] : []),
    ...(description ? [['description', description]] : []),
    ...Object.entries(rest).filter(([, v]) => v != null && v !== ''),
  ];
  if (entries.length === 0) return null;
  return (
    <dl className="book-meta" data-book-meta="true" hidden>
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
