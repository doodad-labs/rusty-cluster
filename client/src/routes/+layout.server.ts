import db from '$lib/server/database';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const clusters = await db.cluster.findMany({
            select: {
                id: true,
                name: true,
            }
        }).catch((err: string) => {
            console.error('Error fetching hosts:', err);
            return [];
        })
    
        return {
            layout: {
                clusters
            }
        };
};