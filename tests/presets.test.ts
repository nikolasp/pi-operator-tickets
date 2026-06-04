import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as presets from '../src/presets';

const projectDir = '.pi/operator-tickets';
const projectFile = `${projectDir}/presets.json`;

const makePreset = (id: string, name = id) => ({
  id,
  name,
  description: `Preset ${name}`,
  placeholders: [],
  sections: {
    goal: 'Goal',
    order: ['Order'],
    proof: ['Proof'],
    boundary: ['Boundary'],
    budget: 'Budget',
    fallback: ['Fallback'],
  },
});

function resetProjectPresets() {
  rmSync('.pi', { recursive: true, force: true });
  presets.invalidateCache();
}

describe('presets.ts', () => {
  beforeEach(resetProjectPresets);
  afterEach(resetProjectPresets);

  it('saves, finds, and deletes a project preset', () => {
    const preset = makePreset('test-delete', 'Test Delete');

    expect(presets.savePreset(preset, 'project')).toBe(true);
    expect(presets.findPreset('test-delete')).toEqual(
      expect.objectContaining({ source: 'project', preset: expect.objectContaining({ id: 'test-delete' }) }),
    );

    const result = presets.deletePreset('test-delete', 'project');

    expect(result.success).toBe(true);
    expect(presets.findPreset('test-delete')?.source).not.toBe('project');
  });

  it('marks lower-priority presets as overridden and reveals them after deletion', () => {
    const projectMigration = makePreset('migration', 'Project Migration');

    expect(presets.savePreset(projectMigration, 'project')).toBe(true);
    const all = presets.loadPresets();

    expect(all).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'built-in', overridden: true, overriddenBy: 'project' }),
      expect.objectContaining({ source: 'project', overridden: false, preset: expect.objectContaining({ id: 'migration' }) }),
    ]));
    expect(presets.getLoadWarnings()).toEqual(expect.arrayContaining([
      expect.stringContaining('overrides built-in'),
    ]));

    const result = presets.deletePreset('migration', 'project');

    expect(result).toEqual({ success: true, revealFrom: 'built-in' });
  });

  it('reports malformed project preset files as load warnings', () => {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(projectFile, '{bad json', 'utf-8');

    presets.loadPresets();

    expect(presets.getLoadWarnings()).toEqual(expect.arrayContaining([
      expect.stringContaining('Failed to parse presets file'),
    ]));
  });

  it('skips invalid preset entries with warnings', () => {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(projectFile, JSON.stringify({
      version: 1,
      presets: [
        null,
        { id: '', sections: {} },
        { id: 'missing-sections', name: 'Missing Sections' },
        { id: 'bad-placeholder', sections: {}, placeholders: [{}] },
      ],
    }), 'utf-8');

    const loaded = presets.loadPresets();

    expect(loaded.find(p => p.preset.id === 'bad-placeholder')?.source).toBe('project');
    expect(presets.getLoadWarnings().join('\n')).toContain('Skipped — not a valid object');
    expect(presets.getLoadWarnings().join('\n')).toContain("missing or invalid 'id'");
    expect(presets.getLoadWarnings().join('\n')).toContain("Skipped — missing 'sections'");
    expect(presets.getLoadWarnings().join('\n')).toContain('placeholder #1 missing key/label/description metadata');
  });

  it('overwrites corrupted saved preset files when saving', () => {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(projectFile, '{bad json', 'utf-8');

    expect(presets.savePreset(makePreset('after-corruption'), 'project')).toBe(true);
    expect(presets.findPreset('after-corruption')).toEqual(
      expect.objectContaining({ source: 'project' }),
    );
  });

  it('returns failure for missing deletes and exposes labels/slugs', () => {
    expect(existsSync(projectFile)).toBe(false);
    expect(presets.deletePreset('missing', 'project')).toEqual({ success: false });

    expect(presets.sourceLabel('built-in')).toBe('built-in');
    expect(presets.sourceLabel('global')).toBe('global');
    expect(presets.sourceLabel('project')).toBe('project');
    expect(presets.sourceLabel('mystery')).toBe('mystery');
    expect(presets.slugify('  Hello, Complex Ticket!!  ')).toBe('hello-complex-ticket');
  });
});
