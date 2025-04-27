<script lang="ts">
    import { io } from "socket.io-client";
    import { onMount } from "svelte";

    const HISTORY_LENGTH = 50;

    let currentLoad: number[][] = $state([]);

    onMount(() => {
        const socket = io("192.168.1.102:3000", {
            transports: ["websocket"],
            autoConnect: true,
        });

        socket.on("connect", () => {
            console.log("Connected to server");
        });
        socket.on("message", (data) => {
            console.log("Message from server:", data);
        });

        socket.on("currentLoad", (data) => {
            console.log("CPU data:", data);
            currentLoad.push(data.cpus.map((cpu) => cpu.load));
        });
    });

    import { Chart } from "svelte-echarts";

    import { init, use } from "echarts/core";
    import { LineChart } from "echarts/charts";
    import { GridComponent, TitleComponent } from "echarts/components";
    import { CanvasRenderer } from "echarts/renderers";

    // now with tree-shaking
    use([LineChart, GridComponent, CanvasRenderer, TitleComponent]);
</script>

<div class="flex flex-col">
    <div class="h-100 w-200">
        <Chart
            {init}
            options={{
                xAxis: {
                    type: "category",
                    boundaryGap: false,
                    data: Array.from({ length: HISTORY_LENGTH }, (_, i) => ""),
                },
                yAxis: {
                    type: "value",
                },
                series: Array.from({ length: currentLoad.length ? currentLoad[0].length : 0 }, (_, i) => ({
                    data: currentLoad.map((cpu) => cpu[i]).slice(-50),
                    type: "line",
                    areaStyle: {},
                    symbol: "none", // Removes the dots/markers from the line
                })),
            }}
        />
    </div>

    <div class="flex flex-col">
        <div class="flex flex-col">
            {#each {length: currentLoad.length ? currentLoad[0].length : 0}, i}
                <div class="flex gap-4">
                    <h2>CPU {i}</h2>
                    <span>|</span>
                    <span>cur {currentLoad[currentLoad.length-1][i].toFixed(2)}%</span>
                    <span>avg {(currentLoad.reduce((acc, cpu) => acc + cpu[i], 0) / currentLoad.length).toFixed(2)}%</span>
                    <span>min {Math.min(...currentLoad.map(cpu => cpu[i])).toFixed(2)}%</span>
                    <span>max {Math.max(...currentLoad.map(cpu => cpu[i])).toFixed(2)}%</span>
                </div>
            {/each}
        </div>

    </div>
</div>
