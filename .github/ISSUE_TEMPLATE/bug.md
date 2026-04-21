---
name: Bug report
about: Report incorrect output, crashes, or wrong attribution
title: ''
labels: bug
---

## What happened

<!-- What did agent-ledger do? What did you expect it to do instead? -->

## How to reproduce

```bash
agent-ledger <your-exact-command>
```

## Output (redact sensitive paths / subagent names)

```
<paste the output here>
```

## Your setup

- OS: <!-- macOS 15.3 / Ubuntu 22.04 / ... -->
- Bun version: <!-- `bun --version` -->
- agent-ledger version: <!-- `agent-ledger --version` (pre-alpha: use commit SHA) -->
- Claude Code version: <!-- `claude --version` -->

## If you're on pay-as-you-go, the calibration ask

If you compare `agent-ledger month` against a real Anthropic invoice and
they differ by > 10%, I want to hear about it. Even one line: "agent-ledger
says $X, invoice says $Y" is incredibly useful. Thanks.
