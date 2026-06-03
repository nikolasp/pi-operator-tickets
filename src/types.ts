/** Metadata for a single placeholder in a Ticket Preset, e.g. "[TARGET MODULE]". */
export interface PlaceholderMeta {
  key: string;
  label: string;
  description: string;
  defaultValue?: string;
  required?: boolean;
}

/** The five Ticket Sections that make up a Ticket Preset blueprint. */
export interface TicketPresetSections {
  goal: string;
  order: string[];
  proof: string[];
  boundary: string[];
  budget: string;
  fallback: string[];
}

/** A reusable starting shape for an Operator Ticket. */
export interface TicketPreset {
  id: string;
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  placeholders: PlaceholderMeta[];
  sections: TicketPresetSections;
}

/** Persisted presets file shape. */
export interface SavedPresetsFile {
  version: 1;
  presets: TicketPreset[];
}

/** A preset that has been loaded with its source location. */
export interface LoadedPreset {
  preset: TicketPreset;
  source: 'built-in' | 'global' | 'project';
  overridden: boolean;
  overriddenBy?: string;
}

/** A filled-in Operator Ticket ready for rendering and insertion. */
export interface OperatorTicket {
  goal: string;
  order: string[];
  proof: string[];
  boundary: string[];
  budget: string;
  fallback: string[];
}

/** The five section keys. */
export type TicketSection = 'goal' | 'order' | 'proof' | 'boundary' | 'budget' | 'fallback';

/** Helpers to check which Ticket Sections are considered high-risk when missing. */
export const HIGH_RISK_SECTIONS: TicketSection[] = ['proof', 'budget', 'fallback'];

/** Default editor prompts shown when a section starts empty (custom ticket). */
export const SECTION_PROMPTS: Record<TicketSection, string> = {
  goal: '(Describe what this ticket should accomplish)',
  order: '(List the steps the agent must follow)',
  proof: '(Define verifiable proof that the job is done)',
  boundary: '(List what the agent must NOT do)',
  budget: '(e.g. Stop after 20 turns OR 30 minutes)',
  fallback: '(What to do when the proof fails or budget runs out)',
};
