<script lang="ts">
    import { io } from "socket.io-client";
    import { onMount } from "svelte";

    const HISTORY_LENGTH = 50;

    let cpus: number[][] = $state([]);

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

        socket.on("cpu", (data) => {
            console.log("CPU data:", data);
            /* cpus.push(data.cpus.map((cpu) => cpu.load));
            cpus = cpus.slice(-HISTORY_LENGTH); */
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

<!-- <div class="h-100 w-200">
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
            series: Array.from({ length: cpus.length ? cpus[0].length : 0 }, (_, i) => ({
                data: cpus.map((cpu) => cpu[i]),
                type: "line",
                areaStyle: {},
            })),
        }}
    />
</div>
 -->