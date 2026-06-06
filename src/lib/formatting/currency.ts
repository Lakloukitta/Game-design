/**
 * Currency/amount formatting helpers. Authoritative supplier amounts are always
 * kept as exact decimal strings elsewhere; these helpers are display-only.
 */

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain formatted number + code.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Parses an exact decimal amount string into a number for ranking/display.
 * Throws on non-finite or non-positive values rather than inventing a price.
 */
export function parseAmount(amountText: string): number {
  const value = Number(amountText);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid amount value: "${amountText}".`);
  }
  return value;
}

/** Compares two exact decimal strings for monetary equality. */
export function amountsEqual(a: string, b: string): boolean {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return a.trim() === b.trim();
  // Compare to the cent to avoid float representation noise.
  return Math.round(na * 100) === Math.round(nb * 100);
}

/** Signed difference a - b rounded to cents, for "costs $X more" copy. */
export function amountDifference(a: string, b: string): number {
  return Math.round((Number(a) - Number(b)) * 100) / 100;
}
