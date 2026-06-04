# pi-operator-tickets

Create bounded, proof-driven **Operator Tickets** for complex AI-agent tasks.

An Operator Ticket is a self-contained agent job structured as:

**Order → Proof → Boundary → Budget → Fallback**

The proof gate decides when the job is done — not the agent.

## Installation

```bash
pi install ./path/to/pi-operator-tickets
```

Or install globally via npm/git:

```bash
pi install npm:pi-operator-tickets
```

## Commands

### `/ticket` or `/operator-ticket`

Interactive wizard for creating an Operator Ticket.

| Usage | Behavior |
|-------|----------|
| `/ticket` | Open picker with all presets + custom option |
| `/ticket migration` | Open picker filtered to "migration" |
| `/ticket custom` | Compose a one-off Custom Operator Ticket |
| `/ticket presets` | List and manage saved Ticket Presets |

### Wizard Flow

1. **Choose preset** or **Custom Operator Ticket**
2. **Fill placeholders** (for presets with `[PLACEHOLDERS]`)
3. **Edit sections** — each of the five sections is reviewed in a multi-line editor:
   - GOAL
   - THE ORDER
   - THE PROOF
   - THE BOUNDARY
   - THE BUDGET
   - THE FALLBACK
4. **Review warnings** — missing Proof, Budget, or Fallback trigger strong warnings
5. **Insert** — ticket is inserted into the editor; replace/append/cancel if editor is non-empty
6. **Save** — custom tickets can be saved as reusable Ticket Presets

### Presets

Four built-in coding presets ship with the package:

- **Migration Ticket** — move from one library/framework to another
- **Bug Hunt Ticket** — find and fix failing tests
- **Coverage Climber** — raise test coverage to a target percentage
- **Refactor Ticket** — reduce duplication by merging similar functions

## Saved Presets

Saved Ticket Presets are stored as versioned JSON:

- **Project-local**: `.pi/operator-tickets/presets.json`
- **Global**: `~/.pi/agent/operator-tickets/presets.json`

Load precedence: **project > global > built-in**. Later sources override earlier ones by preset ID.

Manage saved presets with `/ticket presets`.

## Operator Ticket Standard

1. Your ticket is more important than which AI you pick.
2. The proof gate decides whether you ship work or garbage.
3. One ticket = one job.
4. Bake the budget into the ticket itself.

## Credits

This package builds on the Operator Ticket approach and examples provided by Daniel Jindoo.

- Website: [DOO MADE](https://www.doomade.com/)
- YouTube: [@Jinni_Doo](https://www.youtube.com/@Jinni_Doo)

## License

MIT
