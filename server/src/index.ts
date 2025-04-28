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
    const mem = await sysinfo.mem(); // Get memory data
    const networkStats = await sysinfo.networkStats();
    const fsSize = await sysinfo.fsSize(); // Get storage data
    const fsStats = await sysinfo.fsStats(); // Get storage stats
    const osInfo = await sysinfo.osInfo(); // Get OS information

    io.to('clusterInfo').emit('clusterInfo', {
        cpus: currentLoad.cpus.map((cpu) => cpu.load),
        currentLoad: currentLoad.currentLoad,
        temp: cpuTemperature.main,
        memory: {
            total: mem.total,
            used: mem.used,
            free: mem.free,
        },
        network: networkStats.map((net) => ({
            speed: net.ms,
            rx_sec: net.rx_sec,
            tx_sec: net.tx_sec,
        })),
        storage: fsSize.map((disk) => ({
            size: disk.size,
            used: disk.used,
            available: disk.available,
        })),
        fsStats: {
            read: fsStats.rx_sec,
            write: fsStats.wx_sec,
        },
        osInfo
    }); // Emit CPU usage data to the 'cpu' room
}, 250); // Emit every second

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});