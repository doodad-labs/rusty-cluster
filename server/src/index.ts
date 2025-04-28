import sysinfo from 'systeminformation';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const server = createServer();
const io = new Server(server);

io.on('connection', (socket) => {
    socket.join('clusterInfo');
});

const clusterInfoInterval = setInterval(async () => {
    const currentLoad = await sysinfo.currentLoad(); // Get CPU usage data
    const cpuTemperature = await sysinfo.cpuTemperature(); // Get CPU temperature data
    const memory = await sysinfo.mem(); // Get memory data

    io.to('clusterInfo').emit('clusterInfo', {
        cpus: currentLoad.cpus.map((cpu) => cpu.load),
        currentLoad: currentLoad.currentLoad,
        temp: cpuTemperature.main,
        memory: {
            total: memory.total,
            used: memory.used,
            free: memory.free,
        }
    }); // Emit CPU usage data to the 'cpu' room
}, 250); // Emit every second

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});