# Pi Operator Tickets

Pi Operator Tickets is a context for shaping complex AI-agent work into bounded, proof-driven jobs that an operator can review and run.

## Language

**Operator Ticket**:
A self-contained agent job for one complex task, structured as Order, Proof, Boundary, Budget, and Fallback. It is meant to be reviewed by the operator before the agent runs it.
_Avoid_: Issue, task, prompt, ticket

**Ticket Preset**:
A reusable starting shape for an Operator Ticket, usually based on a known job type such as migration, bug hunt, coverage climb, or refactor. A Ticket Preset can be built in or saved by the operator.
_Avoid_: Template, recipe, issue type

**Built-in Ticket Preset**:
A Ticket Preset shipped with the package. It can be overridden by a Saved Ticket Preset but should not be deleted by the operator.
_Avoid_: Default template, system preset

**Saved Ticket Preset**:
A Ticket Preset created by an operator for reuse beyond the current Operator Ticket. It may be available to one project or across all projects, and can be listed or deleted by the operator.
_Avoid_: Saved prompt, saved issue

**Custom Operator Ticket**:
An Operator Ticket composed from operator-provided fields instead of starting from a built-in Ticket Preset. It can remain one-off or become a Saved Ticket Preset.
_Avoid_: Freeform prompt, ad hoc task

**Ticket Section**:
One of the five expected parts of an Operator Ticket: Order, Proof, Boundary, Budget, or Fallback. Each Ticket Section should be reviewed by the operator, even when it starts from a Ticket Preset; missing Proof, Budget, or Fallback should be treated as especially risky.
_Avoid_: Form field, prompt part

**Operator Ticket Standard**:
The rule that an Operator Ticket is more important than the agent that runs it: one job per ticket, proof decides completion, and budget is part of the ticket itself.
_Avoid_: Prompting style, agent mode

## Example dialogue

Dev: "I need the agent to handle this migration."
Domain expert: "Start from the Migration Ticket Preset, then review the proof gate and fallback before running it."
Dev: "Should we create three jobs in one ticket?"
Domain expert: "No. One Operator Ticket equals one job; split multiple outcomes into separate Operator Tickets."
Dev: "What if no preset fits?"
Domain expert: "Create a Custom Operator Ticket with the same Order, Proof, Boundary, Budget, and Fallback structure."
