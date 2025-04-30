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

	return {
		clusters: clusters.map(async (cluster) => {
            return {
                id: cluster.id,
                address: cluster.address,
                key: await argon2.hash(cluster.key)
            }
        })
	};
};