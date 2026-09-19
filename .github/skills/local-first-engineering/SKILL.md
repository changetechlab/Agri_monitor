---
name: local-first-engineering
description: 'Use when implementing, debugging, reviewing, or validating code changes in an existing repository. Apply a local-first workflow: identify the controlling code path, form a falsifiable hypothesis, make the smallest testable edit, run focused validation, and continue until the request is genuinely complete.'
argument-hint: '[task or failing behavior]'
user-invocable: true
disable-model-invocation: false
---

# Local-First Engineering

## Purpose

Turn an existing-repository request into a small, testable change with clear evidence. Prefer the nearest implementation surface, the narrowest useful edit, and executable validation over broad exploration or speculative refactoring.

## When to Use

- Implementing a feature or behavior change in an existing codebase
- Debugging a reported failure, regression, or unexpected behavior
- Reviewing a change for bugs, risks, and missing tests
- Fixing compile, lint, typecheck, or test failures
- Working in an unfamiliar repository where the request names only a symptom

Do not use this as a substitute for project scaffolding, broad architecture design, or a purely informational coding question.

## Procedure

### 1. Establish the local anchor

Start with the most concrete available anchor, in this order:

1. A named file, symbol, failing command, failing test, or reported behavior
2. A targeted search for the first likely implementation or call site
3. A nearby test, fixture, or neighboring implementation

Read only enough local context to identify where the behavior is actually decided. If the starting file only wires, forwards, registers, or renders the behavior, follow one nearby hop to the code that computes, mutates, or controls it.

### 2. State a falsifiable hypothesis

Before editing, be able to state:

- **Hypothesis:** the specific local reason the behavior works or fails
- **Discriminating check:** the cheapest nearby test, command, or observation that could prove the hypothesis wrong
- **Small edit:** the smallest reversible change that exercises the hypothesis

If multiple paths are plausible, choose the one with the strongest nearby evidence and the cheapest discriminating check. Take at most one additional local read when needed to distinguish them. Do not continue broad repository mapping once a testable hypothesis exists.

### 3. Make the smallest substantive edit

Preserve existing APIs, conventions, and unrelated user changes. Prefer the repository's current helpers, patterns, and dependencies. Avoid speculative abstractions, unrelated cleanup, and comments that merely narrate obvious code.

For a review, do not edit first: inspect the change and report findings ordered by severity, with file references, behavioral impact, and missing tests where relevant.

### 4. Validate immediately

After the first substantive edit, run one focused executable check before further reading or patching. Prefer this order:

1. The cheapest behavior-scoped check that could falsify the hypothesis
2. A narrow test for the touched slice
3. A narrow compile, lint, or typecheck command
4. `git diff` only when no executable check is available

Keep the first validation within the edited slice. If it fails and confirms the hypothesis while exposing a local defect, repair that same slice and rerun the same check. If it falsifies the hypothesis, take one nearby hop to the more direct controller and revise the hypothesis before editing again.

### 5. Iterate with bounded scope

When the focused check passes but the request is not complete, make the smallest adjacent change needed and rerun focused validation. Widen validation only when the change crosses a module boundary, changes a shared contract, or affects a user-facing workflow.

If validation is ambiguous, perform one nearby disambiguating read or inspect one neighboring test or call site. Then choose local repair or a one-hop investigation; do not reopen broad exploration without evidence that the local path is exhausted.

### 6. Complete the task

Before finishing, confirm:

- The requested behavior is implemented at its controlling code path
- The focused validation passes, or any blocker is explicitly reported
- No unrelated files or user changes were reverted
- Relevant docs or tests were updated when the change requires them
- The final response names the changed files, validation performed, and any remaining risk

Do not commit or create branches unless explicitly requested. Do not leave required terminals, watchers, or servers running unless the user needs them.

## Decision Rules

- **Existing pattern vs new abstraction:** use the existing pattern unless a new abstraction removes real complexity or is required by the request.
- **Broad search vs local read:** stay local once the controlling path and discriminating check are known.
- **Test failure after edit:** repair the same slice first; expand only after the focused check is stable or clearly irrelevant.
- **No runnable check:** use the narrowest available static validation and report the limitation honestly.
- **Ambiguous user intent:** ask one concise question when scope, output, or risk cannot be inferred safely; otherwise choose the smallest conservative interpretation and proceed.

## Review Output

For review requests, lead with findings rather than a change summary. Order findings by severity and include:

- The file and relevant location
- The concrete failure or regression risk
- Why it matters
- A focused fix or test suggestion

If there are no findings, say so clearly and list residual test gaps or assumptions.
