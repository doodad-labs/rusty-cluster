import sysinfo from 'systeminformation';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import fs from 'fs/promises';
import crypto from 'crypto';

const filePath = 'key.rusty';

(async () => {
    const key = await checkAndProcessFile(filePath).catch(err => console.error('Error:', err));

    const server = createServer();
    const io = new Server(server);

    io.use((socket, next) => {
        const token = socket.handshake.auth.token; // Get the token from the handshake
        console.log(socket.handshake.auth, token)

        if (token === key) { // Compare with the key
            next(); // Token is valid, proceed to the connection
        } else {
            next(new Error('Authentication error')); // Optionally, you can send an error message
            socket.disconnect(true); // Token is invalid, disconnect the socket
        }
    })

    io.on('connection', async (socket) => {
        socket.join('clusterInfo');
        const osInfo = await sysinfo.osInfo(); // Get OS information
        socket.emit('osInfo', osInfo)
    });

    const clusterInfoInterval = setInterval(async () => {
        const currentLoad = await sysinfo.currentLoad(); // Get CPU usage data
        const cpuTemperature = await sysinfo.cpuTemperature(); // Get CPU temperature data
        const mem = await sysinfo.mem(); // Get memory data
        const networkStats = await sysinfo.networkStats();
        const fsSize = await sysinfo.fsSize(); // Get storage data
        const fsStats = await sysinfo.fsStats(); // Get storage stats
        const time = await sysinfo.time(); // Get system time

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
                name: net.iface,
                speed: net.ms,
                rx_sec: net.rx_sec,
                tx_sec: net.tx_sec,
            })),
            storage: fsSize.map((disk) => ({
                name: disk.fs,
                type: disk.type,
                mount: disk.mount,
                size: disk.size,
                used: disk.used,
                available: disk.available,
            })),
            fsStats: {
                read: fsStats?.rx_sec,
                write: fsStats?.wx_sec,
            },
            uptime: time.uptime,
        }); // Emit CPU usage data to the 'cpu' room
    }, 250); // Emit every second

    server.listen(3000, () => {
        console.log('server running at http://localhost:3000');
    });

    async function checkAndProcessFile(filePath: string): Promise<string> {
        try {
            // Check if file exists
            await fs.access(filePath);

            // File exists - read and print it
            const content = await fs.readFile(filePath, 'utf-8');
            return content;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // File doesn't exist - create it with random string
                const randomString = crypto.randomBytes(32).toString('hex'); // 256 bits = 32 bytes
                await fs.writeFile(filePath, randomString, 'utf-8');

                console.log(`Your cluster key is: "${randomString}", saved to "${filePath}"`);

                return randomString;
            } else {
                // Other error occurred
                throw error;
            }
        }
    }

    function GracefulShutdown() {
        console.log('Gracefully shutting down...');
        clearInterval(clusterInfoInterval); // Clear the interval to stop sending data
        io.close(() => {
            console.log('Socket.io server closed.');
            server.close(() => {
                console.log('HTTP server closed.');
                process.exit(0); // Exit the process
            });
        });
    }

    process.on('SIGTERM', GracefulShutdown);
    process.on('SIGINT', GracefulShutdown);
})()



