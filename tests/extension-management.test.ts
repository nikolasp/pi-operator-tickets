import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as extension from '../src/extension';
import * as presets from '../src/presets';

describe('extension.ts - handlePresetManagement', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    presets.invalidateCache();
    mockCtx = {
      ui: {
        notify: vi.fn(),
        select: vi.fn(),
        confirm: vi.fn(),
        input: vi.fn(),
        getEditorText: vi.fn(),
        setEditorText: vi.fn(),
      },
    };
  });

  it('notifies warnings and returns when no saved presets exist', async () => {
    vi.spyOn(presets, 'getLoadWarnings').mockReturnValue(['warning 1']);
    vi.spyOn(presets, 'getAllPresets').mockReturnValue([]);

    await extension.handlePresetManagement(mockCtx);

    expect(mockCtx.ui.notify).toHaveBeenCalledWith('warning 1', 'warning');
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining('No saved Ticket Presets to manage'),
      'info',
    );
  });

  it('handles successful deletion with revealed lower-priority preset notice', async () => {
    const presetId = 'test-delete';
    const projectPreset = {
      preset: { id: presetId, name: 'Test' },
      source: 'project',
      overridden: false,
    } as any;
    const hiddenGlobalPreset = {
      preset: { id: presetId, name: 'Global Test' },
      source: 'global',
      overridden: true,
      overriddenBy: 'project',
    } as any;

    vi.spyOn(presets, 'getLoadWarnings').mockReturnValue([]);
    vi.spyOn(presets, 'getAllPresets').mockReturnValue([projectPreset, hiddenGlobalPreset]);
    vi.spyOn(presets, 'deletePreset').mockReturnValue({
      success: true,
      revealFrom: 'global',
    });

    mockCtx.ui.select
      .mockImplementationOnce((_title: string, labels: string[]) => labels.find(l => l.includes('[test-delete, project]')))
      .mockImplementationOnce((_title: string, labels: string[]) => labels.find(l => l.startsWith('Done')));
    mockCtx.ui.confirm.mockResolvedValue(true);

    await extension.handlePresetManagement(mockCtx);

    expect(presets.deletePreset).toHaveBeenCalledWith(presetId, 'project');
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining(`Preset "${presetId}" deleted. The global version is now active.`),
      'info',
    );
  });

  it('handles failed deletion', async () => {
    const presetId = 'test-delete';
    const mockPresets = [
      {
        preset: { id: presetId, name: 'Test' },
        source: 'project',
        overridden: false,
      },
    ] as any;

    vi.spyOn(presets, 'getLoadWarnings').mockReturnValue([]);
    vi.spyOn(presets, 'getAllPresets').mockReturnValue(mockPresets);
    vi.spyOn(presets, 'deletePreset').mockReturnValue({ success: false });

    mockCtx.ui.select
      .mockImplementationOnce((_title: string, labels: string[]) => labels.find(l => l.includes('test-delete')))
      .mockImplementationOnce((_title: string, labels: string[]) => labels.find(l => l.startsWith('Done')));
    mockCtx.ui.confirm.mockResolvedValue(true);

    await extension.handlePresetManagement(mockCtx);

    expect(presets.deletePreset).toHaveBeenCalledWith(presetId, 'project');
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to delete preset "${presetId}"`),
      'error',
    );
  });
});
