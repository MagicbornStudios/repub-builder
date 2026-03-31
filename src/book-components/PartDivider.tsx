export interface PartDividerProps {
  label?: string;
  className?: string;
}

export function PartDivider({ label, className }: PartDividerProps) {
  const cn = className ?? "book-part-divider";
  return (
    <div className={cn} role="separator">
      <hr />
      {label ? <p className="book-part-label">{label}</p> : null}
    </div>
  );
}
