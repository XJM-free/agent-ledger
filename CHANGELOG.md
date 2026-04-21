# Changelog

All notable changes to `agent-ledger` will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- JSONL parser with recursive walk of `~/.claude/projects/**`, including nested
  `subagents/` directories
- Per-subagent attribution via sidecar `agent-<hash>.meta.json` files
- Pricing with cache TTL split: `ephemeral_5m_input_tokens` (1.25×) vs
  `ephemeral_1h_input_tokens` (2×)
- Terminal table output (default) and Markdown export (`--md`)
- JSON output (`--json`) for piping into other tools
- `--plan pro|max` to suppress dollar columns on fixed-price subscriptions
- Support for current and prior-generation model IDs (Opus 4.6/4.7,
  Sonnet 4.5/4.6, Haiku 4.0/4.5)
- Family-prefix fallback for unknown future models (e.g. `claude-opus-5-*`
  resolves to Opus pricing)
- `<synthetic>` turns (Claude Code context compaction) correctly priced at $0

### Not yet
- `--by model` breakdown
- Cost forecasting (trailing 7-day burn rate)
- `server_tool_use` pricing (web_search_requests, web_fetch_requests)
- Homebrew tap

## [0.0.1] — 2026-04-21

Initial skeleton, not yet published.
