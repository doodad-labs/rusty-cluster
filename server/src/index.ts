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
    const network = await sysinfo.networkStats();
    const storage = await sysinfo.fsSize(); // Get storage data
    const storageStats = await sysinfo.fsStats(); // Get storage stats

    io.to('clusterInfo').emit('clusterInfo', {
        cpus: currentLoad.cpus.map((cpu) => cpu.load),
        currentLoad: currentLoad.currentLoad,
        temp: cpuTemperature.main,
        memory: {
            total: memory.total,
            used: memory.used,
            free: memory.free,
        },
        network: network.map((net) => ({
            speed: net.ms,
            rx_sec: net.rx_sec,
            tx_sec: net.tx_sec,
        })),
        storage: storage.map((disk) => ({
            size: disk.size,
            used: disk.used,
            available: disk.available,
        })),
        storageStats: {
            read: storageStats.rx_sec,
            write: storageStats.wx_sec,
        }

    }); // Emit CPU usage data to the 'cpu' room
}, 250); // Emit every second

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});