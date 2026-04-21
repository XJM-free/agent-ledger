#!/usr/bin/env bun
import { aggregate } from '../src/aggregator.ts';
import { formatMarkdown, formatTable } from '../src/format.ts';
import { parseAll } from '../src/parser.ts';
import type { LedgerReport } from '../src/types.ts';

type Period = 'today' | 'week' | 'month';
type Plan = 'payg' | 'pro' | 'max';

interface Args {
	period: Period;
	markdown: boolean;
	json: boolean;
	plan: Plan;
}

function periodRange(period: Period): { from: Date; to: Date } {
	const now = new Date();
	const to = new Date(now);
	const from = new Date(now);

	if (period === 'today') {
		from.setHours(0, 0, 0, 0);
	} else if (period === 'week') {
		from.setDate(from.getDate() - 7);
	} else {
		from.setDate(from.getDate() - 30);
	}
	return { from, to };
}

function usage(): never {
	console.error(`Usage: agent-ledger <today|week|month> [flags]

Flags:
  --md              Emit a Markdown table (good for sharing / commits)
  --json            Emit raw JSON (for piping into other tools)
  --plan pro|max    Suppress dollar columns. Report token utilization only.
                    (Default is pay-as-you-go, which shows shadow cost in $.)

Examples:
  agent-ledger today
  agent-ledger week --md > week.md
  agent-ledger month --json | jq '.total.cost.totalCost'
  agent-ledger week --plan max
`);
	process.exit(1);
}

function parseArgs(argv: string[]): Args {
	const [period, ...rest] = argv;
	if (!period || !['today', 'week', 'month'].includes(period)) usage();

	let plan: Plan = 'payg';
	for (let i = 0; i < rest.length; i++) {
		const flag = rest[i];
		if (flag === '--plan') {
			const next = rest[i + 1];
			if (next === 'pro' || next === 'max') {
				plan = next;
				i++;
			} else {
				usage();
			}
		}
	}
	return {
		period: period as Period,
		markdown: rest.includes('--md'),
		json: rest.includes('--json'),
		plan,
	};
}

function planMask(report: LedgerReport, plan: Plan): LedgerReport {
	if (plan === 'payg') return report;
	// On Pro/Max the per-call dollar number isn't what you pay, so hide it.
	// Keep tokens visible — those are the real utilization signal.
	const zero = () => ({
		inputCost: 0,
		outputCost: 0,
		cacheCreation5mCost: 0,
		cacheCreation1hCost: 0,
		cacheReadCost: 0,
		totalCost: 0,
	});
	return {
		period: report.period,
		rows: report.rows.map((r) => ({ ...r, cost: zero() })),
		total: { ...report.total, cost: zero() },
	};
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const { from, to } = periodRange(args.period);
	let report = await aggregate(parseAll({ from, to }), from, to);
	report = planMask(report, args.plan);

	let output: string;
	if (args.json) {
		output = JSON.stringify(report, null, 2);
	} else if (args.markdown) {
		output = formatMarkdown(report, args.period);
	} else {
		output = formatTable(report, args.period);
	}
	console.log(output);
}

main().catch((err) => {
	console.error('agent-ledger: fatal error');
	console.error(err);
	process.exit(1);
});
