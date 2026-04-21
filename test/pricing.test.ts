import { describe, expect, test } from 'bun:test';
import { costFor, isKnownModel } from '../src/pricing.ts';

describe('costFor()', () => {
	test('Opus output is $75/M', () => {
		const cost = costFor(
			{ input_tokens: 0, output_tokens: 1_000_000 },
			'claude-opus-4-7',
		);
		expect(cost.outputCost).toBeCloseTo(75, 6);
	});

	test('Opus input is $15/M', () => {
		const cost = costFor(
			{ input_tokens: 1_000_000, output_tokens: 0 },
			'claude-opus-4-7',
		);
		expect(cost.inputCost).toBeCloseTo(15, 6);
	});

	test('5-minute cache creation is 1.25× base input', () => {
		const cost = costFor(
			{
				input_tokens: 0,
				output_tokens: 0,
				cache_creation: { ephemeral_5m_input_tokens: 1_000_000 },
			},
			'claude-opus-4-7',
		);
		// Opus input $15 × 1.25 = $18.75 per 1M
		expect(cost.cacheCreation5mCost).toBeCloseTo(18.75, 4);
		expect(cost.cacheCreation1hCost).toBeCloseTo(0, 6);
	});

	test('1-hour cache creation is 2× base input (the TTL trap)', () => {
		const cost = costFor(
			{
				input_tokens: 0,
				output_tokens: 0,
				cache_creation: { ephemeral_1h_input_tokens: 1_000_000 },
			},
			'claude-opus-4-7',
		);
		// Opus input $15 × 2 = $30 per 1M
		expect(cost.cacheCreation1hCost).toBeCloseTo(30, 4);
		expect(cost.cacheCreation5mCost).toBeCloseTo(0, 6);
	});

	test('cache read is 10% of base input', () => {
		const cost = costFor(
			{
				input_tokens: 0,
				output_tokens: 0,
				cache_read_input_tokens: 1_000_000,
			},
			'claude-opus-4-7',
		);
		// Opus input $15 × 0.1 = $1.50 per 1M
		expect(cost.cacheReadCost).toBeCloseTo(1.5, 4);
	});

	test('legacy flat cache_creation_input_tokens falls back to 5m TTL pricing', () => {
		const cost = costFor(
			{
				input_tokens: 0,
				output_tokens: 0,
				cache_creation_input_tokens: 1_000_000,
			},
			'claude-opus-4-7',
		);
		expect(cost.cacheCreation5mCost).toBeCloseTo(18.75, 4);
	});

	test('prior-generation model IDs (opus-4-6) resolve to current pricing', () => {
		const cost = costFor(
			{ input_tokens: 1_000_000, output_tokens: 0 },
			'claude-opus-4-6',
		);
		expect(cost.inputCost).toBeCloseTo(15, 6);
	});

	test('unknown future opus variant falls back to opus family pricing', () => {
		const cost = costFor(
			{ input_tokens: 1_000_000, output_tokens: 0 },
			'claude-opus-9-9',
		);
		expect(cost.inputCost).toBeCloseTo(15, 6);
	});

	test('<synthetic> model is free', () => {
		const cost = costFor(
			{
				input_tokens: 1_000_000,
				output_tokens: 1_000_000,
				cache_read_input_tokens: 1_000_000,
			},
			'<synthetic>',
		);
		expect(cost.totalCost).toBe(0);
	});

	test('isKnownModel recognizes current, prior, and family matches', () => {
		expect(isKnownModel('claude-opus-4-7')).toBe(true);
		expect(isKnownModel('claude-opus-4-6')).toBe(true);
		expect(isKnownModel('claude-sonnet-4-6')).toBe(true);
		expect(isKnownModel('<synthetic>')).toBe(true);
		expect(isKnownModel('something-entirely-unknown')).toBe(false);
		expect(isKnownModel(undefined)).toBe(false);
	});
});
