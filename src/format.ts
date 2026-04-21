import type { AggregatedRow, LedgerReport } from './types.ts';

const PAD_LABEL = 22;

// Color helpers — TTY-aware, NO_COLOR-respecting (https://no-color.org/).
const USE_COLOR = (() => {
	if (process.env.NO_COLOR) return false;
	if (process.env.FORCE_COLOR) return true;
	return Boolean(process.stdout.isTTY);
})();

const c = {
	dim: USE_COLOR ? '\x1b[2m' : '',
	bold: USE_COLOR ? '\x1b[1m' : '',
	green: USE_COLOR ? '\x1b[32m' : '',
	cyan: USE_COLOR ? '\x1b[36m' : '',
	yellow: USE_COLOR ? '\x1b[33m' : '',
	red: USE_COLOR ? '\x1b[31m' : '',
	magenta: USE_COLOR ? '\x1b[35m' : '',
	gray: USE_COLOR ? '\x1b[90m' : '',
	reset: USE_COLOR ? '\x1b[0m' : '',
};

function fmtTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
	return String(n);
}

function fmtUsd(n: number): string {
	return `$${n.toFixed(2)}`;
}

function colorCost(n: number, padded: string): string {
	if (!USE_COLOR) return padded;
	if (n >= 1000) return `${c.bold}${c.red}${padded}${c.reset}`;
	if (n >= 100) return `${c.yellow}${padded}${c.reset}`;
	if (n >= 1) return `${c.green}${padded}${c.reset}`;
	return `${c.dim}${padded}${c.reset}`;
}

function formatRow(row: AggregatedRow, isTotal = false): string {
	const labelText = row.subagent.padEnd(PAD_LABEL);
	const label = isTotal
		? `${c.bold}${labelText}${c.reset}`
		: `${c.cyan}${labelText}${c.reset}`;
	const sessions = `${c.gray}${String(row.sessionCount).padStart(4)}${c.reset}`;
	const io = `${fmtTokens(row.inputTokens)} / ${fmtTokens(row.outputTokens)}`.padStart(18);
	const cached1h = fmtTokens(row.cacheCreation1hTokens).padStart(7);
	const cached5m = fmtTokens(row.cacheCreation5mTokens).padStart(7);
	const cacheRead = fmtTokens(row.cacheReadTokens).padStart(8);
	const costStr = fmtUsd(row.cost.totalCost).padStart(9);
	const cost = colorCost(row.cost.totalCost, costStr);
	return `  ${label}${sessions}  ${io}  ${c.dim}1h:${c.reset}${cached1h} ${c.dim}5m:${c.reset}${cached5m} ${c.dim}r:${c.reset}${cacheRead}  ${cost}`;
}

export function formatTable(report: LedgerReport, label: string): string {
	const header =
		`${c.bold}agent-ledger ${label}${c.reset} ${c.dim}·${c.reset} ` +
		`${c.gray}${report.period.from.toISOString().slice(0, 10)} → ${report.period.to.toISOString().slice(0, 10)}${c.reset}`;

	const colsRaw =
		'  ' +
		'subagent'.padEnd(PAD_LABEL) +
		'sess'.padStart(4) +
		'  ' +
		'tokens(in/out)'.padStart(18) +
		'  ' +
		'cache tokens (1h/5m/read)'.padStart(32) +
		'  ' +
		'cost'.padStart(9);
	const cols = `${c.gray}${colsRaw}${c.reset}`;

	const sepRaw = '  ' + '─'.repeat(PAD_LABEL + 4 + 2 + 18 + 2 + 32 + 2 + 9);
	const sep = `${c.gray}${sepRaw}${c.reset}`;

	const lines = [
		header,
		'',
		cols,
		sep,
		...report.rows.map((r) => formatRow(r)),
		sep,
		formatRow({ ...report.total, subagent: 'total' }, true),
	];

	// Server tool footer (only when present, since most rows have 0)
	if (report.total.webSearchRequests + report.total.webFetchRequests > 0) {
		lines.push('');
		lines.push(
			`  ${c.gray}server tools:${c.reset} ` +
				`web_search ×${report.total.webSearchRequests}, ` +
				`web_fetch ×${report.total.webFetchRequests}  ` +
				`(${fmtUsd(report.total.cost.serverToolUseCost)})`,
		);
	}

	return lines.join('\n');
}

// Daily trend chart: vertical-ish ASCII bars per day.
export function formatTrend(report: LedgerReport, label: string): string {
	const max = report.rows.reduce((m, r) => Math.max(m, r.cost.totalCost), 0);
	const barWidth = 36;

	const header =
		`${c.bold}agent-ledger ${label} (daily)${c.reset} ${c.dim}·${c.reset} ` +
		`${c.gray}${report.period.from.toISOString().slice(0, 10)} → ${report.period.to.toISOString().slice(0, 10)}${c.reset}`;

	const lines = [header, ''];
	for (const row of report.rows) {
		const bars = Math.round((row.cost.totalCost / Math.max(max, 0.01)) * barWidth);
		const bar =
			(USE_COLOR ? c.cyan : '') + '█'.repeat(bars) + (USE_COLOR ? c.reset : '');
		const dateLabel = `${c.gray}${row.subagent}${c.reset}`;
		const cost = colorCost(row.cost.totalCost, fmtUsd(row.cost.totalCost).padStart(9));
		const sessions = `${c.gray}(${row.sessionCount} sess)${c.reset}`;
		lines.push(`  ${dateLabel}  ${cost}  ${bar} ${sessions}`);
	}
	lines.push('');
	lines.push(
		`  ${c.bold}total${c.reset.padEnd(PAD_LABEL - 5)}${' '.repeat(2)}${colorCost(
			report.total.cost.totalCost,
			fmtUsd(report.total.cost.totalCost).padStart(9),
		)}`,
	);
	return lines.join('\n');
}

export function formatMarkdown(report: LedgerReport, label: string): string {
	const header = '| group | sessions | input | output | cache 1h | cache 5m | cache read | cost |';
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

	const lines = [
		`# agent-ledger · ${label}`,
		`_${report.period.from.toISOString().slice(0, 10)} → ${report.period.to.toISOString().slice(0, 10)}_`,
		'',
		header,
		sep,
		...rows,
		totalRow,
	];

	if (report.total.webSearchRequests + report.total.webFetchRequests > 0) {
		lines.push('');
		lines.push(
			`_Server tools: web_search ×${report.total.webSearchRequests}, web_fetch ×${report.total.webFetchRequests} (${fmtUsd(report.total.cost.serverToolUseCost)})_`,
		);
	}

	return lines.join('\n');
}
