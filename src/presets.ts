import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { TicketPreset, SavedPresetsFile, LoadedPreset } from './types';

const BUILTIN_PATH = resolve(__dirname, 'builtin-presets.json');
const GLOBAL_DIR = resolve(homedir(), '.pi/agent/operator-tickets');
const GLOBAL_PATH = resolve(GLOBAL_DIR, 'presets.json');
const PROJECT_PATH = '.pi/operator-tickets/presets.json';

let cachedPresets: LoadedPreset[] | null = null;
let loadWarnings: string[] = [];

/** Return any warnings collected during the last loadPresets() call. */
export function getLoadWarnings(): string[] {
  return [...loadWarnings];
}

/**
 * Validate a presets JSON file string. Returns parsed valid presets
 * plus any warnings. Invalid entries are skipped with warnings.
 */
function validatePresetsFile(raw: string, source: string): { presets: TicketPreset[]; warnings: string[] } {
  const warnings: string[] = [];
  let parsed: any;

  try {
    parsed = JSON.parse(raw);
  } catch (e: any) {
    warnings.push(`[${source}] Failed to parse presets file: ${e.message}`);
    return { presets: [], warnings };
  }

  if (!parsed || typeof parsed !== 'object') {
    warnings.push(`[${source}] Presets file is not a valid object`);
    return { presets: [], warnings };
  }

  if (typeof parsed.version !== 'number') {
    warnings.push(`[${source}] Presets file missing or invalid 'version' field`);
    return { presets: [], warnings };
  }

  if (!Array.isArray(parsed.presets)) {
    warnings.push(`[${source}] Presets file missing or invalid 'presets' array`);
    return { presets: [], warnings };
  }

  const valid: TicketPreset[] = [];
  for (let i = 0; i < parsed.presets.length; i++) {
    const p = parsed.presets[i];
    const prefix = `[${source}] preset #${i + 1}`;

    if (!p || typeof p !== 'object') {
      warnings.push(`${prefix}: Skipped — not a valid object`);
      continue;
    }
    if (typeof p.id !== 'string' || !p.id.trim()) {
      warnings.push(`${prefix}: Skipped — missing or invalid 'id'`);
      continue;
    }
    if (typeof p.name !== 'string' || !p.name.trim()) {
      warnings.push(`${prefix} "${p.id}": missing 'name'`);
    }

    const sections = p.sections;
    if (!sections || typeof sections !== 'object') {
      warnings.push(`${prefix} "${p.id}": Skipped — missing 'sections'`);
      continue;
    }

    // Check placeholder metadata
    if (Array.isArray(p.placeholders)) {
      for (let j = 0; j < p.placeholders.length; j++) {
        const ph = p.placeholders[j];
        if (!ph.key || !ph.label || !ph.description) {
          warnings.push(`${prefix} "${p.id}": placeholder #${j + 1} missing key/label/description metadata`);
        }
      }
    }

    const pres: TicketPreset = {
      id: p.id,
      name: typeof p.name === 'string' ? p.name : p.id,
      description: typeof p.description === 'string' ? p.description : '',
      category: typeof p.category === 'string' ? p.category : undefined,
      tags: Array.isArray(p.tags) ? p.tags : undefined,
      placeholders: Array.isArray(p.placeholders) ? p.placeholders : [],
      sections: {
        goal: typeof sections.goal === 'string' ? sections.goal : '',
        order: Array.isArray(sections.order) ? sections.order : [],
        proof: Array.isArray(sections.proof) ? sections.proof : [],
        boundary: Array.isArray(sections.boundary) ? sections.boundary : [],
        budget: typeof sections.budget === 'string' ? sections.budget : '',
        fallback: Array.isArray(sections.fallback) ? sections.fallback : [],
      },
    };
    valid.push(pres);
  }

  return { presets: valid, warnings };
}

/**
 * Load all presets (built-in, global, project) respecting precedence:
 *   project > global > built-in.
 * Later sources override earlier ones by id; overridden entries are marked.
 * Warnings from malformed files or invalid entries are collected and available via getLoadWarnings().
 */
export function loadPresets(): LoadedPreset[] {
  const all: LoadedPreset[] = [];
  loadWarnings = [];

  // 1. Built-in presets
  try {
    const raw = readFileSync(BUILTIN_PATH, 'utf-8');
    const file: SavedPresetsFile = JSON.parse(raw);
    for (const p of file.presets) {
      all.push({ preset: p, source: 'built-in', overridden: false });
    }
  } catch {
    loadWarnings.push('[built-in] Failed to load built-in presets');
    return [];
  }

  // 2. Global saved presets
  try {
    const raw = readFileSync(GLOBAL_PATH, 'utf-8');
    const result = validatePresetsFile(raw, 'global');
    loadWarnings.push(...result.warnings);
    mergePresets(all, result.presets, 'global');
  } catch { /* file does not exist yet */ }

  // 3. Project saved presets
  try {
    const raw = readFileSync(PROJECT_PATH, 'utf-8');
    const result = validatePresetsFile(raw, 'project');
    loadWarnings.push(...result.warnings);
    mergePresets(all, result.presets, 'project');
  } catch { /* file does not exist yet */ }

  cachedPresets = all;
  return all;
}

/** Merge a higher-priority source into the loaded list. Overrides by id. */
function mergePresets(all: LoadedPreset[], newPresets: TicketPreset[], source: 'global' | 'project'): void {
  for (const p of newPresets) {
    // Mark any existing non-overridden entry with same id as overridden
    for (const entry of all) {
      if (entry.preset.id === p.id && !entry.overridden) {
        entry.overridden = true;
        entry.overriddenBy = source;
        loadWarnings.push(`[${source}] Preset "${p.id}" overrides ${entry.source} "${entry.preset.name}"`);
        break; // only override the first active match
      }
    }
    all.push({ preset: p, source, overridden: false });
  }
}

/** Return only effective (non-overridden) presets. */
export function getEffectivePresets(): LoadedPreset[] {
  const presets = cachedPresets ?? loadPresets();
  return presets.filter(p => !p.overridden);
}

/** Return all presets, including overridden ones. */
export function getAllPresets(): LoadedPreset[] {
  return cachedPresets ?? loadPresets();
}

/** Find a loaded preset by id (only effective, non-overridden). */
export function findPreset(id: string): LoadedPreset | undefined {
  return getEffectivePresets().find(p => p.preset.id === id);
}

/** Save a TicketPreset to a versioned presets.json file. Creates directories lazily. */
export function savePreset(preset: TicketPreset, scope: 'global' | 'project'): boolean {
  const filePath = scope === 'global' ? GLOBAL_PATH : PROJECT_PATH;
  const dir = dirname(filePath);

  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let file: SavedPresetsFile = { version: 1, presets: [] };
    if (existsSync(filePath)) {
      try {
        file = JSON.parse(readFileSync(filePath, 'utf-8'));
      } catch { /* overwrite corrupted file */ }
    }

    // Remove existing preset with same id, then add
    file.presets = file.presets.filter(p => p.id !== preset.id);
    file.presets.push(preset);

    writeFileSync(filePath, JSON.stringify(file, null, 2), 'utf-8');
    invalidateCache();
    return true;
  } catch {
    return false;
  }
}

/** Delete a saved preset by id from a given scope. */
export function deletePreset(id: string, scope: 'global' | 'project'): { success: boolean; revealFrom?: string } {
  const filePath = scope === 'global' ? GLOBAL_PATH : PROJECT_PATH;
  if (!existsSync(filePath)) {
    return { success: false };
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const file: SavedPresetsFile = JSON.parse(raw);
    const before = file.presets.length;
    file.presets = file.presets.filter(p => p.id !== id);

    if (file.presets.length === before) {
      return { success: false };
    }

    writeFileSync(filePath, JSON.stringify(file, null, 2), 'utf-8');
    invalidateCache();

    // Check if deleting this reveals a lower-priority preset
    const all = loadPresets();
    const revealing = all.find(p => p.preset.id === id && !p.overridden);
    return {
      success: true,
      revealFrom: revealing && revealing.source !== scope ? revealing.source : undefined,
    };
  } catch {
    return { success: false };
  }
}

/** Get the source label for display. */
export function sourceLabel(source: string): string {
  switch (source) {
    case 'built-in': return 'built-in';
    case 'global': return 'global';
    case 'project': return 'project';
    default: return source;
  }
}

/** Invalidate the preset cache so next load reads fresh files. */
export function invalidateCache(): void {
  cachedPresets = null;
}

/** Generate a slug from a name string. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
