// Validation smoke tests for pi-operator-tickets package structure.
// Run: npm test -- --run  (or just: node src/validate.test.js)
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

// 1. Package manifest
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
assert(pkg.name === 'pi-operator-tickets', 'package name is pi-operator-tickets');
assert(pkg.pi && Array.isArray(pkg.pi.extensions), 'pi manifest has extensions array');
assert(pkg.pi.extensions.length > 0, 'pi manifest has at least one extension');
assert(pkg.pi.skills && pkg.pi.skills.length > 0, 'pi manifest has at least one skill');
assert(pkg.keywords.includes('pi-package'), 'keywords include pi-package');

// Verify extension and skill paths resolve
for (const ext of pkg.pi.extensions) {
  const exists = fs.existsSync(path.resolve(ext));
  assert(exists, `extension file exists: ${ext}`);
}
for (const skill of pkg.pi.skills) {
  const exists = fs.existsSync(path.resolve(skill));
  assert(exists, `skill file exists: ${skill}`);
}

// 2. Built-in presets
const presetsPath = path.resolve('src/builtin-presets.json');
const builtins = JSON.parse(fs.readFileSync(presetsPath, 'utf-8'));
assert(builtins.version === 1, 'builtin-presets.json version is 1');
assert(Array.isArray(builtins.presets), 'builtin-presets.json has presets array');
assert(builtins.presets.length === 4, 'exactly 4 built-in presets');

const expectedIds = ['migration', 'bug-hunt', 'coverage-climber', 'refactor'];
for (const id of expectedIds) {
  const preset = builtins.presets.find(p => p.id === id);
  assert(!!preset, `preset '${id}' exists`);
  assert(typeof preset.name === 'string', `preset '${id}' has name`);
  assert(typeof preset.description === 'string', `preset '${id}' has description`);
  assert(Array.isArray(preset.placeholders), `preset '${id}' has placeholders array`);
  const sections = preset.sections;
  assert(!!sections, `preset '${id}' has sections`);
  assert(typeof sections.goal === 'string', `preset '${id}' has goal`);
  assert(Array.isArray(sections.order), `preset '${id}' has order array`);
  assert(Array.isArray(sections.proof), `preset '${id}' has proof array`);
  assert(Array.isArray(sections.boundary), `preset '${id}' has boundary array`);
  assert(typeof sections.budget === 'string', `preset '${id}' has budget`);
  assert(Array.isArray(sections.fallback), `preset '${id}' has fallback array`);
}

// 3. Skill frontmatter
const skillPath = path.resolve(pkg.pi.skills[0]);
const skillContent = fs.readFileSync(skillPath, 'utf-8');
assert(skillContent.includes('---'), 'skill.md has frontmatter');
assert(skillContent.includes('name:'), 'skill.md has name in frontmatter');
assert(skillContent.includes('description:'), 'skill.md has description in frontmatter');
assert(skillContent.includes('Operator Ticket Standard'), 'skill.md documents the standard');
assert(skillContent.includes('/ticket'), 'skill.md nudges toward /ticket command');

// 4. Types file exports expected sections
const typesContent = fs.readFileSync('src/types.ts', 'utf-8');
assert(typesContent.includes('TicketSection'), 'types.ts exports TicketSection');
assert(typesContent.includes('HIGH_RISK_SECTIONS'), 'types.ts exports HIGH_RISK_SECTIONS');
assert(typesContent.includes('SECTION_PROMPTS'), 'types.ts exports SECTION_PROMPTS');

// 5. Rendering function
const renderingContent = fs.readFileSync('src/rendering.ts', 'utf-8');
assert(renderingContent.includes('export function renderTicket'), 'rendering.ts exports renderTicket');
assert(renderingContent.includes('export function hasUnresolvedPlaceholders'), 'rendering.ts exports hasUnresolvedPlaceholders');
assert(renderingContent.includes('1. THE ORDER'), 'rendering renders ORDER section');
assert(renderingContent.includes('2. THE PROOF'), 'rendering renders PROOF section');
assert(renderingContent.includes('3. THE BOUNDARY'), 'rendering renders BOUNDARY section');
assert(renderingContent.includes('4. THE BUDGET'), 'rendering renders BUDGET section');
assert(renderingContent.includes('5. THE FALLBACK'), 'rendering renders FALLBACK section');
// All five section headers are emitted unconditionally (no conditional if blocks)
assert(!renderingContent.includes("ticket.order.length > 0"), 'rendering ORDER header is unconditional');
assert(!renderingContent.includes("ticket.proof.length > 0"), 'rendering PROOF header is unconditional');
assert(!renderingContent.includes("ticket.boundary.length > 0"), 'rendering BOUNDARY header is unconditional');
assert(!renderingContent.includes("ticket.fallback.length > 0"), 'rendering FALLBACK header is unconditional');
// No metadata comments like (not specified)
assert(!renderingContent.includes('(not specified)'), 'rendering never emits (not specified)');
// Budget is rendered as a bullet when non-empty
assert(renderingContent.includes("ticket.budget.trim()"), 'rendering uses budget.trim() check');
assert(renderingContent.includes('`- ${ticket.budget}`'), 'rendering renders budget as bullet');

// 6. Presets module
const presetsContent = fs.readFileSync('src/presets.ts', 'utf-8');
assert(presetsContent.includes('export function loadPresets'), 'presets.ts exports loadPresets');
assert(presetsContent.includes('export function savePreset'), 'presets.ts exports savePreset');
assert(presetsContent.includes('export function deletePreset'), 'presets.ts exports deletePreset');
assert(presetsContent.includes('export function getEffectivePresets'), 'presets.ts exports getEffectivePresets');
assert(presetsContent.includes('export function getAllPresets'), 'presets.ts exports getAllPresets');
assert(presetsContent.includes('.pi/agent/operator-tickets'), 'presets.ts references global path');
assert(presetsContent.includes('.pi/operator-tickets/presets.json'), 'presets.ts references project path');

// 7. Extension commands
const extContent = fs.readFileSync('src/extension.ts', 'utf-8');
assert(extContent.includes("registerCommand('ticket'"), 'extension registers /ticket');
assert(extContent.includes("registerCommand('operator-ticket'"), 'extension registers /operator-ticket');
assert(extContent.includes("getEditorText"), 'extension uses editor insertion');
assert(extContent.includes("handlePresetManagement"), 'extension has preset management');
assert(extContent.includes("saveCustomAsPreset"), 'extension supports saving custom presets');
assert(extContent.includes('getLoadWarnings'), 'extension imports getLoadWarnings');
assert(extContent.includes('function selectMapped'), 'extension maps select display labels back to values');
const directSelectCalls = (extContent.match(/await ctx\.ui\.select/g) || []).length;
assert(directSelectCalls === 1, 'extension calls ctx.ui.select only through selectMapped');
assert(extContent.includes('ctx.ui.select(title, labels)'), 'selectMapped passes string labels to ctx.ui.select');
// Deletion pre-check before confirmation
assert(extContent.includes('will become active after deletion'), 'extension warns about revealed preset before deletion');

// 8. Preset management runtime behavior
try {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-operator-tickets-test-'));
  const home = path.join(tmp, 'home');
  const project = path.join(tmp, 'project');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(project, { recursive: true });

  execFileSync('npx', [
    'tsc',
    '--ignoreConfig',
    '--ignoreDeprecations', '6.0',
    '--outDir', tmp,
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--declaration', 'false',
    '--resolveJsonModule', 'true',
    '--esModuleInterop', 'true',
    '--skipLibCheck', 'true',
    '--target', 'ES2022',
    'src/extension.ts',
    'src/presets.ts',
    'src/rendering.ts',
    'src/types.ts',
  ], { stdio: 'pipe' });
  fs.copyFileSync('src/builtin-presets.json', path.join(tmp, 'builtin-presets.json'));

  const script = `
    const { handlePresetManagement } = require(${JSON.stringify(path.join(tmp, 'extension.js'))});
    const events = [];
    const ctx = { ui: {
      notify: (message, level) => events.push({ type: 'notify', message, level }),
      select: () => { throw new Error('select should not be called when only built-ins exist'); },
      confirm: () => { throw new Error('confirm should not be called when only built-ins exist'); },
    } };
    (async () => {
      await handlePresetManagement(ctx);
      process.stdout.write(JSON.stringify(events));
    })().catch(error => { console.error(error); process.exit(1); });
  `;
  const output = execFileSync(process.execPath, ['-e', script], {
    cwd: project,
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf-8',
  });
  const events = JSON.parse(output);
  assert(events.length === 1, '/ticket presets emits one notification when only built-ins exist');
  assert(events[0].level === 'info', '/ticket presets does not warn when only built-ins exist');
  assert(events[0].message.includes('No saved Ticket Presets to manage'), '/ticket presets explains there are no saved presets to manage');
  fs.rmSync(tmp, { recursive: true, force: true });
} catch (error) {
  assert(false, `/ticket presets avoids selecting built-ins (${error.message})`);
}

// 9. CONTEXT.md is implementation-free
const contextContent = fs.readFileSync('CONTEXT.md', 'utf-8');
assert(!contextContent.includes('registerCommand'), 'CONTEXT.md is free of implementation details (registerCommand)');
assert(!contextContent.includes('.ts'), 'CONTEXT.md is free of implementation details (.ts references)');
assert(!contextContent.includes('presets.json'), 'CONTEXT.md is free of implementation details (file paths)');

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
