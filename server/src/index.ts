import sysinfo from 'systeminformation';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const server = createServer();
const io = new Server(server);

io.on('connection', (socket) => {
    socket.join('currentLoad');
});

const currentLoadInterval = setInterval(async () => {
    const currentLoad = await sysinfo.currentLoad(); // Get CPU usage data
    io.to('currentLoad').emit('currentLoad', currentLoad); // Emit CPU usage data to the 'cpu' room
}, 250); // Emit every second

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});