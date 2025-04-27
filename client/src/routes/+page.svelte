<script lang="ts">

    import { io } from 'socket.io-client';
    import { onMount } from 'svelte';

    onMount(() => {
        const socket = io('192.168.1.102:3000', {
            transports: ['websocket'],
            autoConnect: true,
        });
        
        socket.on('connect', () => {
            console.log('Connected to server');
        });
        socket.on('message', (data) => {
            console.log('Message from server:', data);
        });
    });

</script>