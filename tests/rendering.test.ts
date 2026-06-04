import { describe, it, expect } from 'vitest';
import { renderTicket, hasUnresolvedPlaceholders } from '../src/rendering';

describe('rendering.ts', () => {
  it('should render a ticket correctly', () => {
    const ticket = {
      goal: 'Goal',
      order: ['Step 1', 'Step 2'],
      proof: ['Proof 1'],
      boundary: ['Boundary 1'],
      budget: 'Budget',
      fallback: ['Fallback 1'],
    };
    const output = renderTicket(ticket);
    expect(output).toContain('GOAL: Goal');
    expect(output).toContain('1. THE ORDER');
    expect(output).toContain('- Step 1');
    expect(output).toContain('2. THE PROOF');
    expect(output).toContain('- Proof 1');
    expect(output).toContain('3. THE BOUNDARY');
    expect(output).toContain('- Boundary 1');
    expect(output).toContain('4. THE BUDGET');
    expect(output).toContain('- Budget');
    expect(output).toContain('5. THE FALLBACK');
    expect(output).toContain('- Fallback 1');
  });

  it('should detect unresolved placeholders', () => {
    expect(hasUnresolvedPlaceholders('This has [PLACEHOLDER]')).toBe(true);
    expect(hasUnresolvedPlaceholders('This is normal')).toBe(false);
    expect(hasUnresolvedPlaceholders('This has [123_PLACEHOLDER]')).toBe(false);
  });
});
