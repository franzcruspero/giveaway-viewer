import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const SUBSCRIBER_LEVELS = new Set([250, 400, 500, 1000, 1500]);

function isSubscriberLevel(value) {
    const level = Number(value);
    return Number.isInteger(level) && SUBSCRIBER_LEVELS.has(level);
}

function chat(body) {
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body,
    };
}

function secretMatches(provided) {
    const expected = process.env.SLOT_SECRET ?? '';
    const left = Buffer.from(provided ?? '');
    const right = Buffer.from(expected);
    return expected.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

export const handler = async (event) => {
    const queryParams = event.queryStringParameters || {};

    if (!secretMatches(queryParams.secret)) {
        console.log('Auth failed: Secret did not match.');
        return chat('Unauthorized.');
    }

    const username = queryParams.user?.toLowerCase();
    const isSubscriber = isSubscriberLevel(queryParams.level);

    if (!username) {
        return chat('No username provided.');
    }

    try {
        const { data: raffle, error: raffleError } = await supabase
            .from('raffle_state')
            .select('status')
            .eq('id', 1)
            .maybeSingle();

        if (raffleError) {
            throw raffleError;
        }

        if (raffle?.status !== 'open') {
            return chat('The giveaway is not open right now.');
        }

        const { data: user, error: readError } = await supabase
            .from('pity_system')
            .select('pity_tickets, is_loser')
            .eq('username', username)
            .maybeSingle();

        if (readError) {
            throw readError;
        }

        if (!user) {
            const { error: insertError } = await supabase
                .from('pity_system')
                .insert([{ username, pity_tickets: 1, is_loser: false, is_subscriber: isSubscriber }]);

            if (insertError) {
                throw insertError;
            }

            return chat('');
        }

        if (!user.is_loser) {
            return chat(`@${username} has already entered this giveaway.`);
        }

        const nextTickets = Number(user.pity_tickets ?? 0) + 1;
        const { error: updateError } = await supabase
            .from('pity_system')
            .update({ pity_tickets: nextTickets, is_loser: false, is_subscriber: isSubscriber })
            .eq('username', username);

        if (updateError) {
            throw updateError;
        }

        return chat('');
    } catch (err) {
        console.error(err);
        return chat('Error updating the giveaway. Try again in a moment.');
    }
};