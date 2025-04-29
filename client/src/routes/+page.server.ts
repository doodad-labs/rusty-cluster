import db from '$lib/server/database';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {

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
		clusters
	};
};