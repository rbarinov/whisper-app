---
name: orchestrator
description: Create, read, update, and clarify tasks stored in the .orchestrator directory
---

## What I do

Manage the `.orchestrator/` directory as the single source of truth for tasks in this project.

Operations I support:

- **List** all tasks currently tracked.
- **Read** the full description of a specific task.
- **Create** a new task from a user-provided description (even rough or verbal).
- **Update** an existing task with new details, refined acceptance criteria, or status changes.
- **Clarify** an ambiguous request by asking the user targeted questions, then capturing the answers in the file.

## Directory structure

```
.orchestrator/
  README.md                       # index of all tasks
  tasks/
    NNN-short-slug.md             # one file per task
```

## Numbering convention

- Tasks use zero-padded three-digit sequential IDs: `001`, `002`, `003`, ...
- To find the next ID, read the existing files in `.orchestrator/tasks/` and increment the highest number.

## Task file template

When creating a new task, use this structure:

```markdown
# Task NNN: <Title>

## Goal

<One or two sentences: what outcome the user wants.>

## Problem

<Why the current state is insufficient.>

## Expected behavior

- <Bullet list of concrete user-visible behaviors.>

## Acceptance criteria

- <Bullet list of testable conditions that define "done".>

## Data model implications

<If the task changes stored data, describe model changes here. Omit section if not applicable.>

## UI implications

<If the task changes the interface, describe UI changes here. Omit section if not applicable.>

## Notes for implementation

- <Hints about which code areas are affected, edge cases, or design constraints.>

## Status

<One of: pending | in_progress | completed | cancelled>
```

## Workflow: creating a task from user input

1. Read the user's description carefully. It may be informal, verbal, or in a non-English language.
2. If the description is too vague to write acceptance criteria, ask the user specific clarifying questions before writing the file. Do not guess at ambiguous requirements.
3. Determine the next available task ID by inspecting `.orchestrator/tasks/`.
4. Write the task file following the template above.
5. Update `.orchestrator/README.md` to include the new task in the list.

## Workflow: clarifying an existing task

1. Read the task file the user refers to.
2. Identify sections that are incomplete, ambiguous, or missing.
3. Ask the user targeted questions covering only the gaps.
4. Update the task file with the new information.
5. Update `.orchestrator/README.md` if the title or summary changed.

## Workflow: listing and reading

- To list tasks: read `.orchestrator/README.md` or list files in `.orchestrator/tasks/`.
- To read a specific item: open the corresponding markdown file and present a concise summary to the user.

## Important rules

- Never invent requirements the user did not state or imply. Ask instead.
- Preserve existing content when updating a file; do not silently remove sections.
- Keep language consistent with the rest of the `.orchestrator/` files (currently English for file content).
- When the user speaks in another language, respond in that language, but write the task files in English to keep the repository consistent.
- Always update `README.md` when adding, renaming, or removing a task file.
