/** Stable string from thrown values in catch blocks (mirrors portfolio `lib/unknown-error`). */
export function unknownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
