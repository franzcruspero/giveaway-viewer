import { createClient } from '@supabase/supabase-js';
import { randomInt, timingSafeEqual } from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const MAX_WINNERS = 50;

function chat(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'text/plain' },
        body,
    };
}

function secretMatches(provided) {
    const expected = process.env.DRAW_SECRET ?? '';
    const left = Buffer.from(provided ?? '');
    const right = Buffer.from(expected);
    return expected.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

function winnerCount(value) {
    if (value == null || String(value).trim() === '') {
        return undefined;
    }
    const trimmed = String(value).trim();
    if (trimmed.toLowerCase() === 'all') {
        return undefined;
    }
    if (!/^[1-9]\d*$/.test(trimmed)) {
        return null;
    }
    return Math.min(Number(trimmed), MAX_WINNERS);
}

function usernameList(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((name) => String(name ?? '').trim().toLowerCase())
        .filter(Boolean);
}

async function loadRaffle() {
    const { data, error } = await supabase
        .from('raffle_state')
        .select('status, winner_count, drawn_usernames, sub_luck')
        .eq('id', 1)
        .maybeSingle();

    if (error) {
        throw error;
    }
    if (!data) {
        throw new Error('raffle_state row is missing.');
    }

    const count = Number(data.winner_count);
    if (!Number.isInteger(count) || count < 1) {
        throw new Error('winner_count is missing.');
    }

    const luck = Number(data.sub_luck);
    const subLuck = Number.isInteger(luck) ? Math.min(Math.max(luck, 1), 10) : 1;

    return {
        status: data.status,
        winnerCount: Math.min(count, MAX_WINNERS),
        drawnUsernames: usernameList(data.drawn_usernames),
        subLuck,
    };
}

async function saveRaffle(update) {
    const { data, error } = await supabase
        .from('raffle_state')
        .update(update)
        .eq('id', 1)
        .select('id');

    if (error) {
        throw error;
    }
    if (!data?.length) {
        throw new Error('raffle_state row was not updated.');
    }
}

async function loadEntries() {
    const pageSize = 1000;
    const rows = [];

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from('pity_system')
            .select('username, pity_tickets, is_subscriber')
            .eq('is_loser', false)
            .gt('pity_tickets', 0)
            .range(from, from + pageSize - 1);

        if (error) {
            throw error;
        }

        rows.push(...(data ?? []));
        if (!data || data.length < pageSize) {
            return rows;
        }
    }
}

function drawWinners(rows, count, subLuck) {
    const pool = rows.map((row) => {
        const tickets = Number(row.pity_tickets);
        return {
            username: row.username,
            pity_tickets: tickets,
            weight: row.is_subscriber ? tickets * subLuck : tickets,
        };
    });
    const winners = [];
    const draws = Math.min(count, pool.length);

    for (let place = 0; place < draws; place += 1) {
        const total = pool.reduce((sum, row) => sum + row.weight, 0);
        let roll = randomInt(total);
        let index = pool.length - 1;

        for (let i = 0; i < pool.length; i += 1) {
            roll -= pool[i].weight;
            if (roll < 0) {
                index = i;
                break;
            }
        }

        const [winner] = pool.splice(index, 1);
        winners.push({ ...winner, total });
    }

    return winners;
}

export const handler = async (event) => {
    // Safely extract query parameters whether using Function URLs or API Gateway
    const queryParams = event.queryStringParameters || {};
    
    if (!secretMatches(queryParams.secret)) {
        console.log("Auth failed: Secret did not match.");
        return chat(401, 'Unauthorized.');
    }

    const requested = winnerCount(queryParams.winners);
    if (requested === null) {
        console.log("Validation failed: Invalid winner count.");
        return chat(200, 'Winners must be a positive whole number.');
    }

    try {
        const raffle = await loadRaffle();
        if (raffle.status !== 'open' && raffle.status !== 'closed') {
            return chat(200, 'The giveaway has ended.');
        }

        const count = requested ?? raffle.winnerCount;
        const rows = await loadEntries();
        if (!rows || rows.length === 0) {
            await saveRaffle({
                status: 'ended',
                last_winners: [],
                drawn_usernames: [],
            });
            return chat(200, 'No one entered. The giveaway is ended.');
        }

        const excluded = new Set(raffle.drawnUsernames);
        const pool = rows.filter((row) => row.username && !excluded.has(String(row.username).toLowerCase()));
        if (!pool.length) {
            return chat(200, 'No one left to draw.');
        }

        const winners = drawWinners(pool, count, raffle.subLuck);
        if (!Array.isArray(winners) || winners.length === 0) {
            return chat(200, 'No winners could be drawn.');
        }

        console.log("Drawn winners:", JSON.stringify(winners));

        const winnerNames = winners
            .map((winner) => String(winner.username ?? '').trim().toLowerCase())
            .filter(Boolean);
        await saveRaffle({
            status: 'closed',
            last_winners: winnerNames,
            drawn_usernames: [...new Set([...excluded, ...winnerNames])],
        });

        const names = winners
            .map((winner, index) => `${index + 1}. @${winner?.username || 'Unknown'}`)
            .join(', ');
        const joinCode = process.env.JOIN_CODE ?? ''
        const discordLink = process.env.DISCORD_LINK ?? ''
        const responseMessage = `Winners: ${names}. Polar's join code is ${joinCode}. Link to discord: ${discordLink}`;

        return chat(200, responseMessage);

    } catch (err) {
        console.error("CRITICAL LAMBDA ERROR:", err);
        return chat(200, 'Error drawing winners.');
    }
};