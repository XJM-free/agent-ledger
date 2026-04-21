import type { AggregatedRow, LedgerReport } from './types.ts';

const PAD_SUBAGENT = 22;

function fmtTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
	return String(n);
}

function fmtUsd(n: number): string {
	return `$${n.toFixed(2)}`;
}

function formatRow(row: AggregatedRow): string {
	const subagent = row.subagent.padEnd(PAD_SUBAGENT);
	const sessions = String(row.sessionCount).padStart(4);
	const io = `${fmtTokens(row.inputTokens)} / ${fmtTokens(row.outputTokens)}`.padStart(18);
	const cached1h = fmtTokens(row.cacheCreation1hTokens).padStart(7);
	const cached5m = fmtTokens(row.cacheCreation5mTokens).padStart(7);
	const cacheRead = fmtTokens(row.cacheReadTokens).padStart(8);
	const cost = fmtUsd(row.cost.totalCost).padStart(9);
	return `  ${subagent}${sessions}  ${io}  1h:${cached1h} 5m:${cached5m} r:${cacheRead}  ${cost}`;
}

export function formatTable(report: LedgerReport, label: string): string {
	const header = `agent-ledger ${label} · ${report.period.from.toISOString().slice(0, 10)}` +
		` → ${report.period.to.toISOString().slice(0, 10)}`;

	const cols = '  ' +
		'subagent'.padEnd(PAD_SUBAGENT) +
		'sess'.padStart(4) + '  ' +
		'tokens(in/out)'.padStart(18) + '  ' +
		'cache tokens (1h/5m/read)'.padStart(32) + '  ' +
		'cost'.padStart(9);

	const sep = '  ' + '─'.repeat(PAD_SUBAGENT + 4 + 2 + 18 + 2 + 32 + 2 + 9);

	return [
		header,
		'',
		cols,
		sep,
		...report.rows.map(formatRow),
		sep,
		formatRow({ ...report.total, subagent: 'total' }),
	].join('\n');
}

export function formatMarkdown(report: LedgerReport, label: string): string {
	const header = '| subagent | sessions | input | output | cache 1h | cache 5m | cache read | cost |';
	const sep = '|---|---:|---:|---:|---:|---:|---:|---:|';
	const rows = report.rows.map(
		(r) =>
			`| ${r.subagent} | ${r.sessionCount} | ${fmtTokens(r.inputTokens)} | ${fmtTokens(
				r.outputTokens,
			)} | ${fmtTokens(r.cacheCreation1hTokens)} | ${fmtTokens(r.cacheCreation5mTokens)} | ${fmtTokens(
				r.cacheReadTokens,
			)} | ${fmtUsd(r.cost.totalCost)} |`,
	);
	const totalRow = `| **total** | ${report.total.sessionCount} | ${fmtTokens(
		report.total.inputTokens,
	)} | ${fmtTokens(report.total.outputTokens)} | ${fmtTokens(
		report.total.cacheCreation1hTokens,
	)} | ${fmtTokens(report.total.cacheCreation5mTokens)} | ${fmtTokens(
		report.total.cacheReadTokens,
	)} | **${fmtUsd(report.total.cost.totalCost)}** |`;

	return [
		`# agent-ledger · ${label}`,
		`_${report.period.from.toISOString().slice(0, 10)} → ${report.period.to.toISOString().slice(0, 10)}_`,
		'',
		header,
		sep,
		...rows,
		totalRow,
	].join('\n');
}
