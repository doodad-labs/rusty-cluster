import sysinfo from 'systeminformation';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const server = createServer();
const io = new Server(server);

io.on('connection', (socket) => {
    
    console.log('user connected'); // Log when a user connects

    // Join the 'cpu' room to receive CPU usage data
    socket.join('cpu');

    socket.on('disconnect', () => {
        // Log when a user disconnects
        console.log('user disconnected');
    });
});

const cpuInterval = setInterval(async () => {
    const load = await sysinfo.currentLoad(); // Get CPU usage data
    io.to('cpu').emit('cpu', load); // Emit CPU usage data to the 'cpu' room
}, 1000); // Emit every second

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});