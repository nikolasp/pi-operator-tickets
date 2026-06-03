---
name: pi-operator-tickets
description: Operator Ticket Standard for proof-driven AI-agent jobs
---

# Operator Ticket Standard

Every Operator Ticket is a self-contained agent job with five sections: Order, Proof, Boundary, Budget, and Fallback. The proof gate decides when the job is done, not the agent.

## The Standard

1. **Your ticket is more important than which AI you pick.**
2. **The proof gate decides whether you ship work or garbage.** When the proof passes, the job is done. When it doesn't, the fallback directs what to fix next.
3. **One ticket = one job.** Do not chain multiple jobs. Two outcomes means two tickets.
4. **Bake the budget into the ticket itself.** Every ticket includes a stop condition (turns or time).

## The Five Sections

- **Order** — What the agent must do, step by step.
- **Proof** — Verifiable checks that decide "done." Commands that exit 0, grep results, build success.
- **Boundary** — What the agent must NOT do. Protected files, forbidden edits, scope limits.
- **Budget** — Hard stop: e.g., "Stop after 20 turns OR 30 minutes."
- **Fallback** — What happens when the proof fails or budget runs out. Output partial results, gap analysis, or error reports.

## When to use this skill

- The user mentions a complex, multi-step agent task.
- The user asks about structuring work for an AI agent.
- The user wants a task with a clear done/not-done gate.

## Guidance

- **Always** enforce one job per Operator Ticket. If the user describes multiple outcomes, recommend splitting into separate tickets.
- **Always** check that every ticket has a proof gate. Weak or missing proof gates are the most common failure mode.
- **Warn** when Proof, Budget, or Fallback sections are missing — these are high-risk gaps.
- **Prefer** the `/ticket` command for interactive ticket creation. The wizard guides section-by-section composition.
- **Prefer** starting from a Ticket Preset (Migration, Bug Hunt, Coverage Climber, Refactor) when one fits.
- **Do not** write hashtags or em-dashes in Operator Tickets.
- **Do not** invent statistics or quotes not present in source material.
- **Do not** write in lecturer voice. Write to one operator.

## Example Ticket Structure

```
GOAL: Migrate React Router v5 to v6 across the entire codebase.

1. THE ORDER
- Replace every <Route component={X}> with <Route element={<X />}>
- Replace useHistory() with useNavigate()
- Replace <Switch> with <Routes>
- All existing functionality continues to work

2. THE PROOF
- npm test exits 0
- grep -r "useHistory" src/ returns zero matches
- grep -r "<Switch" src/ returns zero matches

3. THE BOUNDARY
- Do not modify any test files
- Do not change URL structure or routing behavior
- Do not touch src/legacy/

4. THE BUDGET
Stop after 30 turns OR 60 minutes, whichever hits first.

5. THE FALLBACK
- If blocked on the same error 3 times, write to ERROR.md and exit
- If a v5 feature has no v6 equivalent, log to MIGRATION_GAPS.md
```
