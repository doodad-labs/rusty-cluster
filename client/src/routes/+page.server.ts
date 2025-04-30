import db from '$lib/server/database';
import type { PageServerLoad } from './$types';
import argon2 from 'argon2';

export const load: PageServerLoad = async () => {

    const clusters = await db.cluster.findMany({
        select: {
            id: true,
            address: true,
            key: true,
        }
    }).catch((err: string) => {
        console.error('Error fetching hosts:', err);
        return [];
    })

    for (let i = 0; i < clusters.length; i++) {
        clusters[i].key = await argon2.hash(clusters[i].key);
    }

	return {
		clusters
	};
};