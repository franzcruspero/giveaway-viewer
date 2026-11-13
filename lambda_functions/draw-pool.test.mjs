import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_KEY ??= 'test-key';

const { weightedPool } = await import('./draw.mjs');

// Field at draw time: 12 entrants still in the raffle, plus the 3 drawn winners.
// Sub luck ×2 applies only to the starred subscribers.
const SUB_LUCK = 2;
const WINNER_COUNT = 3;
const ENTRANTS = [
    { username: 'vdara_', pity_tickets: 9, is_subscriber: true },
    { username: 'yvessaintfall', pity_tickets: 7, is_subscriber: false },
    { username: 'xh2ohh', pity_tickets: 6, is_subscriber: true },
    { username: 'silverfoxjoey', pity_tickets: 4, is_subscriber: true },
    { username: 'brandongodzilla3', pity_tickets: 3, is_subscriber: false },
    { username: 'eeazcy', pity_tickets: 3, is_subscriber: true },
    { username: 'gamefighter1306', pity_tickets: 2, is_subscriber: true },
    { username: 'andrei_', pity_tickets: 2, is_subscriber: true },
    { username: 'siglus_', pity_tickets: 2, is_subscriber: true },
    { username: 'keygenie', pity_tickets: 1, is_subscriber: false },
    { username: 'ucieo', pity_tickets: 1, is_subscriber: true },
    { username: 'saltygoose24', pity_tickets: 1, is_subscriber: true },
    { username: 'wolf780', pity_tickets: 6, is_subscriber: true },
    { username: 'kyle1man2', pity_tickets: 4, is_subscriber: true },
    { username: 'emppun8or', pity_tickets: 3, is_subscriber: false },
];

function singleDrawChances(rows, subLuck) {
    const pool = weightedPool(rows, subLuck);
    const totalWeight = pool.reduce((sum, row) => sum + row.weight, 0);
    return {
        totalWeight,
        rows: pool.map((row) => ({
            ...row,
            probability: row.weight / totalWeight,
        })),
    };
}

// Chance each person is among `places` winners, drawn without replacement.
function inclusionChances(rows, places, subLuck) {
    const pool = weightedPool(rows, subLuck);
    const chances = new Map(pool.map((row) => [row.username, 0]));

    function walk(remaining, placesLeft, probability) {
        if (placesLeft === 0 || probability === 0) {
            return;
        }
        const total = remaining.reduce((sum, row) => sum + row.weight, 0);
        for (let index = 0; index < remaining.length; index += 1) {
            const row = remaining[index];
            const nextProbability = probability * (row.weight / total);
            chances.set(row.username, chances.get(row.username) + nextProbability);
            walk(
                remaining.filter((_, item) => item !== index),
                placesLeft - 1,
                nextProbability,
            );
        }
    }

    walk(pool, places, 1);
    return chances;
}

function percent(probability) {
    return `${(probability * 100).toFixed(2)}%`;
}

describe('3-winner draw, actual subscribers, sub luck x2', () => {
    it('weights only subscribers by sub luck and prints both chances', () => {
        const draw = singleDrawChances(ENTRANTS, SUB_LUCK);
        const included = inclusionChances(ENTRANTS, WINNER_COUNT, SUB_LUCK);
        const totalTickets = ENTRANTS.reduce((sum, row) => sum + row.pity_tickets, 0);
        const subscriberTickets = ENTRANTS.reduce(
            (sum, row) => sum + (row.is_subscriber ? row.pity_tickets : 0),
            0,
        );
        const includedSum = [...included.values()].reduce((sum, chance) => sum + chance, 0);

        assert.equal(ENTRANTS.length, 15);
        assert.equal(totalTickets, 54);
        assert.equal(draw.totalWeight, subscriberTickets * SUB_LUCK + (totalTickets - subscriberTickets));
        assert.equal(draw.totalWeight, 94);
        assert.ok(Math.abs(includedSum - WINNER_COUNT) < 1e-9);

        const lines = [
            'username            sub  tickets  weight   1st place   any of 3',
        ];
        const ranked = [...draw.rows].sort(
            (left, right) =>
                right.weight - left.weight || left.username.localeCompare(right.username),
        );
        for (const row of ranked) {
            const source = ENTRANTS.find((entrant) => entrant.username === row.username);
            const expectedWeight = source.is_subscriber
                ? source.pity_tickets * SUB_LUCK
                : source.pity_tickets;
            assert.equal(row.weight, expectedWeight);
            assert.equal(row.probability, expectedWeight / 94);
            lines.push(
                `${row.username.padEnd(18)} ${source.is_subscriber ? 'yes' : ' no'}  ${String(row.pity_tickets).padStart(7)}  ${String(row.weight).padStart(6)}   ${percent(row.probability).padStart(9)}   ${percent(included.get(row.username)).padStart(8)}`,
            );
        }

        const favorite = draw.rows.find((row) => row.username === 'vdara_');
        const favoriteIncluded = included.get('vdara_');
        assert.equal(favorite.weight, 18);
        assert.equal(favorite.probability, 18 / 94);
        assert.ok(favoriteIncluded > favorite.probability);
        assert.ok(favoriteIncluded < 1);

        lines.push('');
        lines.push(
            `vdara_ is first ${percent(favorite.probability)} of the time (18/94) and is one of the 3 winners ${percent(favoriteIncluded)} of the time.`,
        );
        lines.push(
            'Sub luck x2 doubles subscribers only. yvessaintfall, brandongodzilla3, keygenie, and emppun8or keep their raw ticket weight.',
        );
        console.log(lines.join('\n'));
    });
});
