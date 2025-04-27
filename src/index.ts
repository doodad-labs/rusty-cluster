import sysinfo from 'systeminformation';
import Fastify from 'fastify'

const fastify = Fastify({
    logger: true
})

fastify.get('/', async (request, reply) => {
    reply.type('application/json').code(200)
    return await sysinfo.currentLoad()
})

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
    fastify.log.info(`server listening on ${address}`)
})