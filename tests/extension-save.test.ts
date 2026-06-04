import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as extension from '../src/extension';
import * as presets from '../src/presets';

const ticket = {
  goal: 'Goal',
  order: ['Order'],
  proof: ['Proof'],
  boundary: ['Boundary'],
  budget: 'Budget',
  fallback: ['Fallback'],
};

describe('extension.ts - saveCustomAsPreset', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    presets.invalidateCache();
    mockCtx = {
      ui: {
        input: vi.fn(),
        select: vi.fn(),
        confirm: vi.fn(),
        notify: vi.fn(),
      },
    };
  });

  it('saves a custom ticket as a project preset', async () => {
    mockCtx.ui.input
      .mockResolvedValueOnce('My Custom Ticket')
      .mockResolvedValueOnce('custom-id');
    mockCtx.ui.select.mockImplementation((_title: string, labels: string[]) => {
      return labels.find(l => l.includes('Project-local'));
    });
    vi.spyOn(presets, 'savePreset').mockReturnValue(true);

    await extension.saveCustomAsPreset(mockCtx, ticket);

    expect(mockCtx.ui.input).toHaveBeenCalledTimes(2);
    expect(mockCtx.ui.select).toHaveBeenCalled();
    expect(presets.savePreset).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'custom-id', name: 'My Custom Ticket' }),
      'project',
    );
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining('Saved Ticket Preset "My Custom Ticket"'),
      'info',
    );
  });

  it('notifies error if saving fails', async () => {
    mockCtx.ui.input
      .mockResolvedValueOnce('My Custom Ticket')
      .mockResolvedValueOnce('custom-id');
    mockCtx.ui.select.mockImplementation((_title: string, labels: string[]) => {
      return labels.find(l => l.includes('Project-local'));
    });
    vi.spyOn(presets, 'savePreset').mockReturnValue(false);

    await extension.saveCustomAsPreset(mockCtx, ticket);

    expect(mockCtx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save preset'),
      'error',
    );
  });

  it('returns early when preset name is cancelled', async () => {
    mockCtx.ui.input.mockResolvedValueOnce(undefined);
    const saveSpy = vi.spyOn(presets, 'savePreset');

    await extension.saveCustomAsPreset(mockCtx, ticket);

    expect(mockCtx.ui.select).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('returns early when preset id is cancelled', async () => {
    mockCtx.ui.input
      .mockResolvedValueOnce('My Custom Ticket')
      .mockResolvedValueOnce(undefined);
    const saveSpy = vi.spyOn(presets, 'savePreset');

    await extension.saveCustomAsPreset(mockCtx, ticket);

    expect(mockCtx.ui.select).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('returns early when save scope is cancelled', async () => {
    mockCtx.ui.input
      .mockResolvedValueOnce('My Custom Ticket')
      .mockResolvedValueOnce('custom-id');
    mockCtx.ui.select.mockResolvedValueOnce(undefined);
    const saveSpy = vi.spyOn(presets, 'savePreset');

    await extension.saveCustomAsPreset(mockCtx, ticket);

    expect(saveSpy).not.toHaveBeenCalled();
    expect(mockCtx.ui.notify).not.toHaveBeenCalled();
  });
});
