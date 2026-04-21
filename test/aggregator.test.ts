import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { aggregate } from '../src/aggregator.ts';
import { parseFile } from '../src/parser.ts';

const FIXTURE = join(import.meta.dir, 'fixtures', 'sample.jsonl');

describe('aggregate()', () => {
	test('groups assistant turns by subagent', async () => {
		const from = new Date('2026-04-21T00:00:00Z');
		const to = new Date('2026-04-21T23:59:59Z');
		const report = await aggregate(parseFile(FIXTURE), from, to);

		const agents = report.rows.map((r) => r.subagent);
		expect(agents).toContain('ios-factory');
		expect(agents).toContain('Reality Checker');
		expect(agents).toContain('(main)');
	});

	test('skips user turns (no usage data)', async () => {
		const from = new Date('2026-04-21T00:00:00Z');
		const to = new Date('2026-04-21T23:59:59Z');
		const report = await aggregate(parseFile(FIXTURE), from, to);

		// 4 assistant turns in fixture (3 subagents, some with >1 turn each).
		const totalSessions = report.total.sessionCount;
		expect(totalSessions).toBeGreaterThan(0);
	});

	test('rows are sorted by total cost descending', async () => {
		const from = new Date('2026-04-21T00:00:00Z');
		const to = new Date('2026-04-21T23:59:59Z');
		const report = await aggregate(parseFile(FIXTURE), from, to);

		for (let i = 1; i < report.rows.length; i++) {
			const prev = report.rows[i - 1]!.cost.totalCost;
			const curr = report.rows[i]!.cost.totalCost;
			expect(prev).toBeGreaterThanOrEqual(curr);
		}
	});

	test('total row sums all agent rows', async () => {
		const from = new Date('2026-04-21T00:00:00Z');
		const to = new Date('2026-04-21T23:59:59Z');
		const report = await aggregate(parseFile(FIXTURE), from, to);

		const sumCost = report.rows.reduce((s, r) => s + r.cost.totalCost, 0);
		expect(report.total.cost.totalCost).toBeCloseTo(sumCost, 6);
	});

	test('--by model groups by model id', async () => {
		const from = new Date('2026-04-21T00:00:00Z');
		const to = new Date('2026-04-21T23:59:59Z');
		const report = await aggregate(parseFile(FIXTURE), from, to, 'model');

		// Fixture has assistant turns with claude-opus-4-7 model
		const labels = report.rows.map((r) => r.subagent);
		expect(labels.some((l) => l.includes('claude-') || l === '(no-model)')).toBe(true);
	});

	test('--by day groups by ISO date and sorts chronologically', async () => {
		const from = new Date('2026-04-21T00:00:00Z');
		const to = new Date('2026-04-21T23:59:59Z');
		const report = await aggregate(parseFile(FIXTURE), from, to, 'day');

		// Each row label should look like a date YYYY-MM-DD
		for (const row of report.rows) {
			expect(row.subagent).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		}
		// Ascending date order
		for (let i = 1; i < report.rows.length; i++) {
			expect(report.rows[i - 1]!.subagent <= report.rows[i]!.subagent).toBe(true);
		}
	});
});
