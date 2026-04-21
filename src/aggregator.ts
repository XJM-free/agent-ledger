import { costFor } from './pricing.ts';
import type { AggregatedRow, LedgerReport, SessionTurn } from './types.ts';

const MAIN_AGENT_LABEL = '(main)';

function emptyRow(subagent: string): AggregatedRow {
	return {
		subagent,
		sessionCount: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheCreation5mTokens: 0,
		cacheCreation1hTokens: 0,
		cacheReadTokens: 0,
		cost: {
			inputCost: 0,
			outputCost: 0,
			cacheCreation5mCost: 0,
			cacheCreation1hCost: 0,
			cacheReadCost: 0,
			totalCost: 0,
		},
	};
}

function splitCache(turn: SessionTurn): { fiveMin: number; oneHour: number } {
	const usage = turn.usage;
	if (!usage) return { fiveMin: 0, oneHour: 0 };
	if (usage.cache_creation) {
		return {
			fiveMin: usage.cache_creation.ephemeral_5m_input_tokens ?? 0,
			oneHour: usage.cache_creation.ephemeral_1h_input_tokens ?? 0,
		};
	}
	return { fiveMin: usage.cache_creation_input_tokens ?? 0, oneHour: 0 };
}

export async function aggregate(
	turns: AsyncIterable<SessionTurn>,
	from: Date,
	to: Date,
): Promise<LedgerReport> {
	const rowsByAgent = new Map<string, AggregatedRow>();
	const sessionsByAgent = new Map<string, Set<string>>();

	for await (const turn of turns) {
		if (turn.type !== 'assistant' || !turn.usage) continue;

		const agent = turn.subagentType ?? MAIN_AGENT_LABEL;
		const row = rowsByAgent.get(agent) ?? emptyRow(agent);

		const cost = costFor(turn.usage, turn.model);
		const { fiveMin, oneHour } = splitCache(turn);

		row.inputTokens += turn.usage.input_tokens;
		row.outputTokens += turn.usage.output_tokens;
		row.cacheCreation5mTokens += fiveMin;
		row.cacheCreation1hTokens += oneHour;
		row.cacheReadTokens += turn.usage.cache_read_input_tokens ?? 0;
		row.cost.inputCost += cost.inputCost;
		row.cost.outputCost += cost.outputCost;
		row.cost.cacheCreation5mCost += cost.cacheCreation5mCost;
		row.cost.cacheCreation1hCost += cost.cacheCreation1hCost;
		row.cost.cacheReadCost += cost.cacheReadCost;
		row.cost.totalCost += cost.totalCost;

		const sessions = sessionsByAgent.get(agent) ?? new Set<string>();
		sessions.add(turn.sessionId);
		sessionsByAgent.set(agent, sessions);

		rowsByAgent.set(agent, row);
	}

	for (const [agent, row] of rowsByAgent) {
		row.sessionCount = sessionsByAgent.get(agent)?.size ?? 0;
	}

	const rows = [...rowsByAgent.values()].sort((a, b) => b.cost.totalCost - a.cost.totalCost);
	const total = rows.reduce<AggregatedRow>((acc, row) => {
		acc.sessionCount += row.sessionCount;
		acc.inputTokens += row.inputTokens;
		acc.outputTokens += row.outputTokens;
		acc.cacheCreation5mTokens += row.cacheCreation5mTokens;
		acc.cacheCreation1hTokens += row.cacheCreation1hTokens;
		acc.cacheReadTokens += row.cacheReadTokens;
		acc.cost.inputCost += row.cost.inputCost;
		acc.cost.outputCost += row.cost.outputCost;
		acc.cost.cacheCreation5mCost += row.cost.cacheCreation5mCost;
		acc.cost.cacheCreation1hCost += row.cost.cacheCreation1hCost;
		acc.cost.cacheReadCost += row.cost.cacheReadCost;
		acc.cost.totalCost += row.cost.totalCost;
		return acc;
	}, emptyRow('total'));

	return { period: { from, to }, rows, total };
}
