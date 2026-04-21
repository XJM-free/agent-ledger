import type { CostBreakdown, ModelId, TokenUsage } from './types.ts';

// Prices are per 1M tokens, USD. Keep in sync with
// https://www.anthropic.com/pricing as of 2026-04-21.
//
// Prompt caching (Anthropic):
//   cache_creation 5-min TTL: 1.25× base input rate
//   cache_creation 1-hour TTL: 2×    base input rate
//   cache_read (any TTL):      0.10× base input rate (90% discount)
//
// We include both current and prior-generation model IDs because real logs span
// version bumps (Claude Code does not auto-rewrite historical logs when you upgrade).
const PRICING: Record<string, { input: number; output: number }> = {
	// Current generation (2026-04)
	'claude-opus-4-7': { input: 15, output: 75 },
	'claude-sonnet-4-6': { input: 3, output: 15 },
	'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
	// Prior generation (still appears in logs written before model upgrades)
	'claude-opus-4-6': { input: 15, output: 75 },
	'claude-opus-4-5': { input: 15, output: 75 },
	'claude-sonnet-4-5': { input: 3, output: 15 },
	'claude-haiku-4-0': { input: 0.8, output: 4 },
};

// Internal Claude Code markers that we should treat as free.
// `<synthetic>` turns are context summaries / compaction events with no real API call.
const FREE_MODELS = new Set<string>(['<synthetic>']);

const CACHE_5M_MULTIPLIER = 1.25;
const CACHE_1H_MULTIPLIER = 2.0;
const CACHE_READ_MULTIPLIER = 0.1;

// Anthropic server-tool pricing (https://www.anthropic.com/pricing as of 2026-04):
//   Web search: $10 per 1,000 requests = $0.01 / request
//   Web fetch:  treated identically here pending Anthropic split (file an issue if wrong)
const WEB_SEARCH_PRICE_PER_REQUEST = 0.01;
const WEB_FETCH_PRICE_PER_REQUEST = 0.01;

function resolveModel(model: ModelId | undefined): { input: number; output: number } {
	if (!model) return { input: 0, output: 0 };
	if (FREE_MODELS.has(model)) return { input: 0, output: 0 };
	const exact = PRICING[model];
	if (exact) return exact;
	// Fuzzy family prefix match as a safety net for unknown subversions.
	// e.g. "claude-opus-4-8-20260301" falls back to Opus pricing until we add it.
	for (const key of Object.keys(PRICING)) {
		if (model.startsWith(key)) return PRICING[key] as { input: number; output: number };
	}
	if (model.startsWith('claude-opus-')) return { input: 15, output: 75 };
	if (model.startsWith('claude-sonnet-')) return { input: 3, output: 15 };
	if (model.startsWith('claude-haiku-')) return { input: 0.8, output: 4 };
	return { input: 0, output: 0 };
}

interface CacheBreakdown {
	fiveMin: number;
	oneHour: number;
}

function splitCacheCreation(usage: TokenUsage): CacheBreakdown {
	if (usage.cache_creation) {
		return {
			fiveMin: usage.cache_creation.ephemeral_5m_input_tokens ?? 0,
			oneHour: usage.cache_creation.ephemeral_1h_input_tokens ?? 0,
		};
	}
	return {
		fiveMin: usage.cache_creation_input_tokens ?? 0,
		oneHour: 0,
	};
}

export function costFor(usage: TokenUsage, model: ModelId | undefined): CostBreakdown {
	const rate = resolveModel(model);
	const cacheRead = usage.cache_read_input_tokens ?? 0;
	const { fiveMin, oneHour } = splitCacheCreation(usage);

	const perMillion = (tokens: number, price: number) => (tokens / 1_000_000) * price;

	const inputCost = perMillion(usage.input_tokens, rate.input);
	const outputCost = perMillion(usage.output_tokens, rate.output);
	const cacheCreation5mCost = perMillion(fiveMin, rate.input * CACHE_5M_MULTIPLIER);
	const cacheCreation1hCost = perMillion(oneHour, rate.input * CACHE_1H_MULTIPLIER);
	const cacheReadCost = perMillion(cacheRead, rate.input * CACHE_READ_MULTIPLIER);

	const webSearchReqs = usage.server_tool_use?.web_search_requests ?? 0;
	const webFetchReqs = usage.server_tool_use?.web_fetch_requests ?? 0;
	const serverToolUseCost =
		webSearchReqs * WEB_SEARCH_PRICE_PER_REQUEST +
		webFetchReqs * WEB_FETCH_PRICE_PER_REQUEST;

	return {
		inputCost,
		outputCost,
		cacheCreation5mCost,
		cacheCreation1hCost,
		cacheReadCost,
		serverToolUseCost,
		totalCost:
			inputCost +
			outputCost +
			cacheCreation5mCost +
			cacheCreation1hCost +
			cacheReadCost +
			serverToolUseCost,
	};
}

export function isKnownModel(model: ModelId | undefined): boolean {
	if (!model) return false;
	if (FREE_MODELS.has(model)) return true;
	if (PRICING[model]) return true;
	return Object.keys(PRICING).some((key) => model.startsWith(key));
}
