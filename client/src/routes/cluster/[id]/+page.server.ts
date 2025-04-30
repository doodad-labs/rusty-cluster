import db from '$lib/server/database';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import argon2 from 'argon2';

export const load: PageServerLoad = async ({ params }) => {

    const { id } = params;

    const cluster = await db.cluster.findUnique({
        select: {
            id: true,
            address: true,
            key: true,
        },
        where: {
            id: id,
        }
    }).catch((err: string) => {
        console.error('Error fetching hosts:', err);
        return redirect(302, '/');
    })

    if (!cluster) {
        return redirect(302, '/');
    }

	return {
		cluster: {
            id: cluster.id,
            address: cluster.address,
            key: await argon2.hash(cluster.key)
        }
	};
};