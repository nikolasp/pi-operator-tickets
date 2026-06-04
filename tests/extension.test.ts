import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as extension from '../src/extension';
import * as presets from '../src/presets';

describe('extension.ts', () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    presets.invalidateCache();
    mockCtx = {
      ui: {
        notify: vi.fn(),
        input: vi.fn().mockResolvedValue('some-value'),
        confirm: vi.fn().mockResolvedValue(true),
        editor: vi.fn().mockResolvedValue('edited-content'),
        select: vi.fn().mockImplementation((title, labels) => {
          return labels[0];
        }),
        getEditorText: () => 'existing-content',
        setEditorText: vi.fn(),
      },
    };
  });

  it('handleTicketCommand calls correct handlers', async () => {
    vi.spyOn(presets, 'getLoadWarnings').mockReturnValue([]);
    vi.spyOn(presets, 'getAllPresets').mockReturnValue([]);

    await extension.handleTicketCommand('presets', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('No saved Ticket Presets to manage'), 'info');

    mockCtx.ui.confirm.mockResolvedValue(false);
    await extension.handleTicketCommand('custom', mockCtx);
    expect(mockCtx.ui.editor).toHaveBeenCalled();
  });

  it('handleTicketCommand with id opens picker or runs wizard', async () => {
    // Test with no match
    await extension.handleTicketCommand('non-existent-id', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('No preset matching "non-existent-id"'), 'warning');
  });

  it('runWizard handles placeholders and sections', async () => {
    const mockPreset = {
      id: 'test-id',
      name: 'Test Preset',
      description: 'Test Description',
      placeholders: [
        { key: 'VAR1', label: 'Var 1', description: 'Desc 1', required: true, defaultValue: 'default' }
      ],
      sections: {
        goal: 'Goal [VAR1]',
        order: ['Step 1'],
        proof: ['Proof 1'],
        boundary: ['Boundary 1'],
        budget: 'Budget',
        fallback: ['Fallback 1'],
      },
    };

    await extension.runWizard(mockCtx, mockPreset);
    
    expect(mockCtx.ui.input).toHaveBeenCalled();
    expect(mockCtx.ui.editor).toHaveBeenCalled();
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Operator Ticket inserted into editor.'), 'info');
  });

  it('runWizard handles cancel path for missing placeholders', async () => {
    // Mock confirm to return false for "Missing Placeholders"
    mockCtx.ui.confirm.mockResolvedValue(false);
    const mockPreset = {
      id: 'test-id',
      name: 'Test Preset',
      description: 'Test Description',
      placeholders: [
        { key: 'VAR1', label: 'Var 1', description: 'Desc 1', required: true, defaultValue: 'default' }
      ],
      sections: {
        goal: 'Goal [VAR1]',
        order: ['Step 1'],
        proof: ['Proof 1'],
        boundary: ['Boundary 1'],
        budget: 'Budget',
        fallback: ['Fallback 1'],
      },
    };

    // We need to make sure that VAR1 is NOT filled so that it triggers the missing placeholder check.
    mockCtx.ui.input.mockResolvedValue(undefined);

    await extension.runWizard(mockCtx, mockPreset);
    
    // Should return early before opening editors
    expect(mockCtx.ui.editor).not.toHaveBeenCalled();
  });

  it('openPicker handles different filters', async () => {
    // Test no filter
    await extension.openPicker(mockCtx);
    expect(mockCtx.ui.select).toHaveBeenCalledWith(
      'Choose a ticket preset or create custom:',
      expect.any(Array)
    );

    // Test filter that matches nothing
    mockCtx.ui.notify.mockClear();
    await extension.openPicker(mockCtx, 'non-existent');
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining('No preset matching "non-existent"'),
      'warning'
    );
  });

  it('handleTicketCommand handles empty args', async () => {
    await extension.handleTicketCommand('', mockCtx);
    expect(mockCtx.ui.select).toHaveBeenCalled();
  });

  it('registers commands and warns on session start', async () => {
    vi.spyOn(presets, 'loadPresets').mockReturnValue([]);
    vi.spyOn(presets, 'getLoadWarnings').mockReturnValue(['bad saved preset']);
    const handlers: Record<string, any> = {};
    const pi = {
      registerCommand: vi.fn((name: string, command: any) => {
        handlers[name] = command.handler;
      }),
      on: vi.fn((event: string, handler: any) => {
        handlers[event] = handler;
      }),
    } as any;

    extension.default(pi);
    await handlers.session_start({}, mockCtx);

    expect(pi.registerCommand).toHaveBeenCalledWith('ticket', expect.objectContaining({ description: expect.any(String) }));
    expect(pi.registerCommand).toHaveBeenCalledWith('operator-ticket', expect.objectContaining({ description: expect.any(String) }));
    expect(pi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining('1 preset loading warning(s)'),
      'warning',
    );
  });

  it('selectMapped handles duplicate labels and buildTicket trims/splits sections', async () => {
    const selectCtx = { ui: { select: vi.fn((_title, labels) => labels[1]) } };

    const choice = await extension.selectMapped(selectCtx, 'Pick:', [
      { value: 'first', label: 'Duplicate' },
      { value: 'second', label: 'Duplicate' },
    ]);

    expect(choice).toBe('second');
    expect(selectCtx.ui.select).toHaveBeenCalledWith('Pick:', ['Duplicate', 'Duplicate (2)']);
    expect(extension.buildTicket({
      goal: ' Goal ',
      order: ' Step 1\n\n Step 2 ',
      proof: ' Proof ',
      boundary: ' Boundary ',
      budget: ' Budget ',
      fallback: ' Fallback ',
    } as any)).toEqual({
      goal: 'Goal',
      order: ['Step 1', 'Step 2'],
      proof: ['Proof'],
      boundary: ['Boundary'],
      budget: 'Budget',
      fallback: ['Fallback'],
    });
  });
});
