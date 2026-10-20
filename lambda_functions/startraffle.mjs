import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const MAX_WINNERS = 50;
const MAX_TITLE = 100;

function chat(body) {
    return {
        statusCode: 200,
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
        return 1;
    }
    const trimmed = String(value).trim();
    if (!/^[1-9]\d*$/.test(trimmed)) {
        return null;
    }
    return Math.min(Number(trimmed), MAX_WINNERS);
}

function cleanTitle(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function parseQuery(query) {
    const text = cleanTitle(query);
    if (!text) {
        return { count: 1, title: '' };
    }

    const match = text.match(/^([1-9]\d*)(?:\s+(.*))?$/);
    if (!match) {
        return { count: 1, title: text };
    }

    return {
        count: Math.min(Number(match[1]), MAX_WINNERS),
        title: cleanTitle(match[2]),
    };
}

function startArgs(params) {
    if (params.query != null) {
        return parseQuery(params.query);
    }

    const count = winnerCount(params.winners);
    if (count == null) {
        return { error: 'Winners must be a positive whole number.' };
    }

    return { count, title: cleanTitle(params.title) };
}

export const handler = async (event) => {
    const queryParams = event.queryStringParameters || {};

    if (!secretMatches(queryParams.secret)) {
        console.log('Auth failed: Secret did not match.');
        return chat('Unauthorized.');
    }

    const args = startArgs(queryParams);
    if (args.error) {
        return chat(args.error);
    }
    if (args.title.length > MAX_TITLE) {
        return chat(`Title must be ${MAX_TITLE} characters or less.`);
    }

    try {
        const { data, error } = await supabase
            .from('raffle_state')
            .update({
                status: 'open',
                winner_count: args.count,
                title: args.title || null,
                last_winners: [],
                drawn_usernames: [],
            })
            .eq('id', 1)
            .select('winner_count, title');

        if (error) {
            throw error;
        }
        if (!data?.length) {
            return chat('Could not start the raffle.');
        }

        const label = args.count === 1 ? '1 winner' : `${args.count} winners`;
        if (data[0].title) {
            return chat(`Raffle is open: ${data[0].title}. Drawing ${label}.`);
        }
        return chat(`Raffle is open. Drawing ${label}.`);
    } catch (err) {
        console.error(err);
        return chat('Error starting the raffle. Try again in a moment.');
    }
};
