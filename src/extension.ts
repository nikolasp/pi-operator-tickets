import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { OperatorTicket, TicketSection } from './types';
import { HIGH_RISK_SECTIONS, SECTION_PROMPTS } from './types';
import type { LoadedPreset } from './types';
import {
  loadPresets,
  getEffectivePresets,
  getAllPresets,
  findPreset,
  savePreset,
  deletePreset,
  sourceLabel,
  slugify,
  getLoadWarnings,
} from './presets';
import { renderTicket, hasUnresolvedPlaceholders } from './rendering';

/**
 * pi-operator-tickets extension.
 * Registers /ticket and /operator-ticket commands for interactive
 * Operator Ticket creation, guided by the five-part ticket structure.
 */
export default function (pi: ExtensionAPI) {
  // ── Command Registration ────────────────────────────────────────────

  pi.registerCommand('ticket', {
    description: 'Create an Operator Ticket for a complex task',
    handler: async (args: string, ctx: any) => {
      await handleTicketCommand(args, ctx);
    },
  });
  pi.registerCommand('operator-ticket', {
    description: 'Create an Operator Ticket for a complex task',
    handler: async (args: string, ctx: any) => {
      await handleTicketCommand(args, ctx);
    },
  });

  // Reload preset cache on session start so saved-preset files are fresh
  pi.on('session_start', async (_event, ctx: any) => {
    loadPresets();
    const warnings = getLoadWarnings();
    if (warnings.length > 0) {
      ctx.ui.notify(`${warnings.length} preset loading warning(s). Use /ticket presets to review.`, 'warning');
    }
  });
}

// ── Command Handler ──────────────────────────────────────────────────

async function handleTicketCommand(args: string, ctx: any): Promise<void> {
  const trimmed = args?.trim() ?? '';

  // /ticket presets — manage saved presets
  if (trimmed === 'presets') {
    await handlePresetManagement(ctx);
    return;
  }

  // /ticket custom — compose a one-off Custom Operator Ticket
  if (trimmed === 'custom') {
    await runWizard(ctx, null);
    return;
  }

  // /ticket <id> — try exact match, otherwise open filtered picker
  if (trimmed.length > 0) {
    const found = findPreset(trimmed);
    if (found) {
      await runWizard(ctx, found.preset, found);
      return;
    }
    // No exact match — open picker filtered to matching text
    await openPicker(ctx, trimmed);
    return;
  }

  // /ticket with no args — open full picker
  await openPicker(ctx);
}

// ── Picker ────────────────────────────────────────────────────────────

async function openPicker(ctx: any, filter?: string): Promise<void> {
  // Surface preset loading warnings
  const presLoadWarnings = getLoadWarnings();
  if (presLoadWarnings.length > 0) {
    ctx.ui.notify(`${presLoadWarnings.length} preset loading warning(s) — use /ticket presets for details.`, 'warning');
  }

  const presets = getEffectivePresets();
  let items = presets.map(p => ({
    value: p.preset.id,
    label: `${p.preset.name} [${p.preset.id}, ${sourceLabel(p.source)}]`,
  }));

  // Filter by typed text if provided
  if (filter) {
    const lower = filter.toLowerCase();
    items = items.filter(item => {
      if (item.value === lower) return true;
      if (item.value.includes(lower)) return true;
      if (item.label.toLowerCase().includes(lower)) return true;
      const preset = presets.find(p => p.preset.id === item.value);
      if (preset?.preset.tags?.some(t => t.includes(lower))) return true;
      return false;
    });

    if (items.length === 0) {
      ctx.ui.notify(`No preset matching "${filter}". Try /ticket custom or /ticket presets.`, 'warning');
      return;
    }
  }

  // Add custom option always
  items.push({
    value: '__custom__',
    label: 'Custom Operator Ticket — compose from scratch, section by section',
  });

  const choice = await selectMapped(
    ctx,
    'Choose a ticket preset or create custom:',
    items,
  );

  if (!choice) return;

  if (choice === '__custom__') {
    await runWizard(ctx, null);
    return;
  }

  const loaded = presets.find(p => p.preset.id === choice);
  if (loaded) {
    await runWizard(ctx, loaded.preset, loaded);
  }
}

// ── Wizard ────────────────────────────────────────────────────────────

async function runWizard(ctx: any, preset: any | null, loaded?: LoadedPreset): Promise<void> {
  const placeholders: Record<string, string> = {};

  // ---- Step 1: Fill placeholders (preset only) ----
  if (preset && preset.placeholders?.length > 0) {
    for (const ph of preset.placeholders) {
      const prompt = `${ph.label}${ph.required ? ' (required)' : ''}: ${ph.description}`;
      const value = await ctx.ui.input(prompt, ph.defaultValue ?? '');
      if (value !== undefined) {
        placeholders[ph.key] = value;
      }
    }

    // Warn about unfilled required placeholders
    const unfilled = preset.placeholders
      .filter((ph: any) => ph.required && !placeholders[ph.key])
      .map((ph: any) => ph.key);
    if (unfilled.length > 0) {
      const ok = await ctx.ui.confirm(
        'Missing Placeholders',
        `Required placeholders unfilled: ${unfilled.join(', ')}.\n\nContinue with unresolved placeholders?`,
      );
      if (!ok) return;
    }
  }

  // ---- Step 2: Section-by-section editing ----
  const sections: Record<TicketSection, string> = {
    goal: '',
    order: '',
    proof: '',
    boundary: '',
    budget: '',
    fallback: '',
  };

  const sectionOrder: TicketSection[] = ['goal', 'order', 'proof', 'boundary', 'budget', 'fallback'];
  const sectionLabels: Record<TicketSection, string> = {
    goal: 'GOAL',
    order: '1. THE ORDER',
    proof: '2. THE PROOF',
    boundary: '3. THE BOUNDARY',
    budget: '4. THE BUDGET',
    fallback: '5. THE FALLBACK',
  };

  for (const section of sectionOrder) {
    let prefilled: string;

    if (preset) {
      // Prefill from preset, substituting placeholders
      if (section === 'goal' || section === 'budget') {
        prefilled = substitute(preset.sections[section], placeholders);
      } else {
        const arr = preset.sections[section] as string[];
        prefilled = arr.map((line: string) => substitute(line, placeholders)).join('\n');
      }
    } else {
      // Custom ticket: start with an empty/helpful prompt
      prefilled = SECTION_PROMPTS[section];
    }

    const text = await ctx.ui.editor(
      `${sectionLabels[section]}${prefilled ? '' : ' (empty)'}`,
      prefilled,
    );

    if (text !== undefined) {
      sections[section] = text;
    } else {
      // User cancelled editor
      sections[section] = prefilled;
    }
  }

  // ---- Step 3: Warnings ----
  const missingSections: TicketSection[] = [];
  const unresolvedSections: TicketSection[] = [];

  for (const sec of sectionOrder) {
    const content = sections[sec]?.trim() ?? '';
    if (content === '' || content === SECTION_PROMPTS[sec]) {
      missingSections.push(sec);
    } else if (hasUnresolvedPlaceholders(content)) {
      unresolvedSections.push(sec);
    }
  }

  // Warn about missing high-risk sections
  const missingHighRisk = missingSections.filter(s => HIGH_RISK_SECTIONS.includes(s));
  if (missingHighRisk.length > 0) {
    const names = missingHighRisk.map(s => sectionLabels[s]).join(', ');
    const ok = await ctx.ui.confirm(
      'Missing High-Risk Sections',
      `The following sections are empty: ${names}.\n\nThese are critical for a reliable Operator Ticket. Insert anyway?`,
    );
    if (!ok) return;
  }

  // Warn about remaining missing sections
  const missingOther = missingSections.filter(s => !HIGH_RISK_SECTIONS.includes(s));
  if (missingOther.length > 0) {
    const names = missingOther.map(s => sectionLabels[s]).join(', ');
    await ctx.ui.confirm(
      'Missing Sections',
      `The following sections are empty: ${names}.\n\nPress Enter to continue anyway.`,
    );
  }

  // Warn about unresolved placeholders
  if (unresolvedSections.length > 0) {
    const names = unresolvedSections.map(s => sectionLabels[s]).join(', ');
    const ok = await ctx.ui.confirm(
      'Unresolved Placeholders',
      `${names} still contain placeholder brackets like [THIS]. Insert anyway?`,
    );
    if (!ok) return;
  }

  // ---- Step 4: Build ticket and render ----
  const ticket = buildTicket(sections);

  const rendered = renderTicket(ticket);

  // ---- Step 5: Insert into editor ----
  await insertIntoEditor(ctx, rendered);

  // ---- Step 6: Offer to save as preset (custom tickets only) ----
  if (!preset) {
    const save = await ctx.ui.confirm(
      'Save as Preset?',
      'Do you want to save this Custom Operator Ticket as a reusable Ticket Preset?',
    );

    if (save) {
      await saveCustomAsPreset(ctx, ticket);
    }
  }

  ctx.ui.notify('Operator Ticket inserted into editor.', 'info');
}

// ── Helpers ───────────────────────────────────────────────────────────

type SelectItem<T extends string> = {
  value: T;
  label: string;
};

/**
 * ctx.ui.select currently accepts string options only. Keep values separate
 * so the TUI renders useful labels instead of object stringification.
 */
async function selectMapped<T extends string>(ctx: any, title: string, items: SelectItem<T>[]): Promise<T | undefined> {
  const labels: string[] = [];
  const labelCounts = new Map<string, number>();
  const valueByLabel = new Map<string, T>();

  for (const item of items) {
    const previousCount = labelCounts.get(item.label) ?? 0;
    labelCounts.set(item.label, previousCount + 1);

    const label = previousCount === 0 ? item.label : `${item.label} (${previousCount + 1})`;
    labels.push(label);
    valueByLabel.set(label, item.value);
  }

  const choice = await ctx.ui.select(title, labels);
  return choice ? valueByLabel.get(choice) : undefined;
}

function substitute(text: string, placeholders: Record<string, string>): string {
  return text.replace(/\[([A-Z][A-Z0-9_ ]+)\]/g, (_, key) => {
    return placeholders[key] ?? `[${key}]`;
  });
}

function buildTicket(sections: Record<TicketSection, string>): OperatorTicket {
  const splitLines = (text: string): string[] => {
    return text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
  };

  return {
    goal: sections.goal?.trim() ?? '',
    order: splitLines(sections.order ?? ''),
    proof: splitLines(sections.proof ?? ''),
    boundary: splitLines(sections.boundary ?? ''),
    budget: sections.budget?.trim() ?? '',
    fallback: splitLines(sections.fallback ?? ''),
  };
}

async function insertIntoEditor(ctx: any, text: string): Promise<void> {
  const current = ctx.ui.getEditorText?.() ?? '';

  if (current.trim().length === 0) {
    ctx.ui.setEditorText(text);
    return;
  }

  const action = await selectMapped(ctx, 'Editor already has text:', [
    { value: 'replace', label: 'Replace — discard current editor text and insert ticket' },
    { value: 'append', label: 'Append — add ticket after current editor text' },
    { value: 'cancel', label: 'Cancel — do not insert ticket' },
  ]);

  if (action === 'replace') {
    ctx.ui.setEditorText(text);
  } else if (action === 'append') {
    ctx.ui.setEditorText(current + '\n\n' + text);
  }
}

async function saveCustomAsPreset(ctx: any, ticket: OperatorTicket): Promise<void> {
  const name = await ctx.ui.input('Preset name:', 'My Custom Ticket');
  if (!name) return;

  let id = await ctx.ui.input('Preset ID (used for /ticket <id>):', slugify(name));
  if (!id) return;

  const scopeChoice = await selectMapped(ctx, 'Save scope:', [
    { value: 'project', label: 'Project-local — available only in this project (.pi/operator-tickets/presets.json)' },
    { value: 'global', label: 'Global — available everywhere (~/.pi/agent/operator-tickets/presets.json)' },
  ]);

  if (!scopeChoice) return;

  const scope = scopeChoice as 'global' | 'project';

  const preset: any = {
    id,
    name,
    description: `Custom Operator Ticket: ${ticket.goal.slice(0, 80)}${ticket.goal.length > 80 ? '...' : ''}`,
    category: 'custom',
    tags: ['custom'],
    placeholders: [],
    sections: {
      goal: ticket.goal,
      order: ticket.order,
      proof: ticket.proof,
      boundary: ticket.boundary,
      budget: ticket.budget,
      fallback: ticket.fallback,
    },
  };

  const saved = savePreset(preset, scope);
  if (saved) {
    ctx.ui.notify(`Saved Ticket Preset "${name}" to ${scope} presets.`, 'info');
  } else {
    ctx.ui.notify(`Failed to save preset. Check file permissions.`, 'error');
  }
}

// ── Preset Management ─────────────────────────────────────────────────

export async function handlePresetManagement(ctx: any): Promise<void> {
  let showedWarnings = false;

  // Loop to allow multiple deletes. Rebuild each pass so deletion refreshes the list.
  while (true) {
    const all = getAllPresets();

    if (!showedWarnings) {
      showedWarnings = true;
      const warnings = getLoadWarnings();
      for (const warning of warnings) {
        ctx.ui.notify(warning, 'warning');
      }
    }

    const savedPresets = all
      .filter(p => p.source !== 'built-in')
      .sort((a, b) => {
        if (a.overridden !== b.overridden) return a.overridden ? -1 : 1;
        if (a.source !== b.source) {
          const order: Record<string, number> = { global: 1, project: 2 };
          return (order[a.source] ?? 0) - (order[b.source] ?? 0);
        }
        return a.preset.name.localeCompare(b.preset.name);
      });

    if (savedPresets.length === 0) {
      ctx.ui.notify('No saved Ticket Presets to manage. Built-in presets are available via /ticket and cannot be deleted.', 'info');
      return;
    }

    // Build display list with a lookup map (avoids encoding issues in IDs)
    const presetMap = new Map<string, LoadedPreset>();
    const items = savedPresets.map((p, i) => {
      const key = `__pt${i}`;
      presetMap.set(key, p);
      const overriddenMark = p.overridden ? ` [overridden by ${p.overriddenBy}]` : '';
      const sourceLabelText = sourceLabel(p.source);
      return {
        value: key,
        label: `${p.preset.name} [${p.preset.id}, ${sourceLabelText}]${overriddenMark}`,
      };
    });

    // Add a "done" option
    items.push({ value: '__done__', label: 'Done — close preset management' });

    const choice = await selectMapped(ctx, 'Saved Ticket Presets:', items);
    if (!choice || choice === '__done__') return;

    const entry = presetMap.get(choice);
    if (!entry) continue;
    const presetId = entry.preset.id;
    const source = entry.source;
    if (source === 'built-in') continue;
    const overridden = entry.overridden;

    // Pre-check: will deletion reveal a lower-priority preset?
    let revealMsg = '';
    if (!overridden) {
      const all = getAllPresets();
      const lower = all.find(
        p => p.preset.id === presetId && p.overridden && p.overriddenBy === source,
      );
      if (lower) {
        revealMsg = `\n\nThe ${lower.source} version of "${presetId}" will become active after deletion.`;
      }
    }

    // Confirm deletion (with pre-deletion revelation warning)
    const confirmMsg = overridden
      ? `Delete the ${source} preset "${presetId}"?\n\nIt is currently overridden and not in use.`
      : `Delete the ${source} preset "${presetId}"?${revealMsg}\n\nThis preset is currently active.`;

    const confirmed = await ctx.ui.confirm('Delete Preset', confirmMsg);
    if (!confirmed) continue;

    const result = deletePreset(presetId, source);
    if (result.success) {
      if (!overridden && result.revealFrom) {
        ctx.ui.notify(`Preset "${presetId}" deleted. The ${result.revealFrom} version is now active.`, 'info');
      } else {
        ctx.ui.notify(`Preset "${presetId}" deleted.`, 'info');
      }
    } else {
      ctx.ui.notify(`Failed to delete preset "${presetId}".`, 'error');
    }
  }
}
