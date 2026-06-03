import type { OperatorTicket } from './types';

/**
 * Render a filled OperatorTicket into a clean runnable prompt following
 * the five-part structure. No title, no metadata — just the prompt.
 */
export function renderTicket(ticket: OperatorTicket): string {
  const lines: string[] = [];

  lines.push(`GOAL: ${ticket.goal}`);
  lines.push('');

  // 1. THE ORDER
  lines.push('1. THE ORDER');
  for (const item of ticket.order) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  // 2. THE PROOF
  lines.push('2. THE PROOF');
  for (const item of ticket.proof) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  // 3. THE BOUNDARY
  lines.push('3. THE BOUNDARY');
  for (const item of ticket.boundary) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  // 4. THE BUDGET
  lines.push('4. THE BUDGET');
  if (ticket.budget.trim()) {
    lines.push(`- ${ticket.budget}`);
  }
  lines.push('');

  // 5. THE FALLBACK
  lines.push('5. THE FALLBACK');
  for (const item of ticket.fallback) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  return lines.join('\n').trimEnd() + '\n';
}

/**
 * Return true if any bracket placeholder like [SOMETHING] remains unresolved.
 */
export function hasUnresolvedPlaceholders(text: string): boolean {
  return /\[[A-Z][A-Z0-9_ ]+\]/.test(text);
}
