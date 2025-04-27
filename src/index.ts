import sysinfo from 'systeminformation';
import Fastify from 'fastify'

const fastify = Fastify({
    logger: true
})

fastify.get('/', async (request, reply) => {
    reply.type('application/json').code(200)
    return await sysinfo.currentLoad()
})

fastify.listen({ port: 3000 }, (err, address) => {
    if (err) throw err
    // Server is now listening on ${address}
})