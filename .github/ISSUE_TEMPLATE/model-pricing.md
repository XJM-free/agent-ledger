---
name: Model pricing gap
about: A model ID shows $0 in your ledger — we're missing it from the price table
title: 'pricing: add <model-id>'
labels: pricing
---

## Model ID

<!-- e.g. claude-opus-4-8-20260301 -->

## Anthropic's published rates

- Input: $<X> / 1M tokens
- Output: $<Y> / 1M tokens
- Link to Anthropic pricing page (with date):

## Where you saw it

Sample from your log (redact the content, keep the model field):

```json
{"message":{"model":"<model-id>", "usage":{"input_tokens":..., "output_tokens":...}}}
```

## Optional: PR

If you want to open the PR, the pricing table lives in `src/pricing.ts`. Add a
matching test in `test/pricing.test.ts`.
