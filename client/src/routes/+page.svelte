<script lang="ts">
    import { io } from "socket.io-client";
    import type { Socket } from "socket.io-client";
    import { onMount } from "svelte";

    const HISTORY_LENGTH = 50;

    const hostAddress = [
        "192.168.1.102:3000",
        "192.168.1.109:3000",
        "192.168.1.212:3000",
        "192.168.1.124:3000",
    ];

    let hosts: {
        [key: string]: {
            socket: Socket;
            currentLoad: number[][];
        };
    } = $state({});

    onMount(() => {
        for (let i = 0; i < hostAddress.length; i++) {
            const host = hostAddress[i];

            hosts[host] = {
                socket: io(host, {
                    transports: ["websocket"],
                    autoConnect: true,
                }),
                currentLoad: [],
            };

            hosts[host].socket.on("currentLoad", (data) => {
                hosts[host].currentLoad.push(
                    data.cpus.map((cpu) => cpu.load || 0),
                );
                if (hosts[host].currentLoad.length > HISTORY_LENGTH) {
                    hosts[host].currentLoad.shift();
                }
            });
        }
    });

    import { Chart } from "svelte-echarts";

    import { init, use } from "echarts/core";
    import { LineChart } from "echarts/charts";
    import { GridComponent, TooltipComponent } from "echarts/components";
    import { CanvasRenderer } from "echarts/renderers";

    // now with tree-shaking
    use([LineChart, GridComponent, CanvasRenderer, TooltipComponent]);
</script>

{#each Object.values(hosts) as host}
    <div class="flex place-items-start gap-4 p-4">
        <div
            class="w-100 border"
            style="height: {Math.max(
                (host.currentLoad.length ? host.currentLoad[0].length : 0) * 42,
                100,
            )}px;"
        >
            <Chart
                {init}
                options={{
                    xAxis: {
                        show: false, // Hide x-axis
                        boundaryGap: false,
                        data: Array.from({ length: HISTORY_LENGTH }, () => ""), // Match last 50 data points
                    },
                    yAxis: {
                        show: false, // Hide y-axis
                        min: 0, // Fix baseline at 0 for consistency
                        max: Math.min(
                            Math.max(...host.currentLoad.map((cpu) => cpu[0])) +
                                8,
                            105,
                        ), // Match your max value (or use dynamic max)
                    },
                    grid: {
                        top: 2, // Minimal padding
                        right: 0,
                        bottom: 2,
                        left: 0,
                    },
                    series: Array.from({ length: 4 }, (_, i) => ({
                        // Assuming 4 cores
                        data: host.currentLoad.map((cpu) => cpu[i]), // Last 50 points
                        type: "line",
                        symbol: "none", // No data points
                        lineStyle: {
                            width: 1.2, // Slightly thicker line
                        },
                        areaStyle: {
                            opacity: 0.15, // Subtle fill
                        },
                        smooth: 0, // Mild smoothing (0 to 1)
                    })),
                    tooltip: { show: false }, // Disable tooltips
                    animation: false, // Avoid distracting animation
                }}
            />
        </div>

        <div class="overflow-x-auto">
            <table class="min-w-full divide-y-2 divide-gray-200">

                <thead class="ltr:text-left rtl:text-right">
                    <tr class="*:font-medium *:text-gray-900">
                        <th class="px-3 pb-1 whitespace-nowrap">Core</th>
                        <th class="px-3 pb-1 whitespace-nowrap">Current</th>
                        <th class="px-3 pb-1 whitespace-nowrap">Avg</th>
                        <th class="px-3 pb-1 whitespace-nowrap">Min</th>
                        <th class="px-3 pb-1 whitespace-nowrap">Max</th>
                    </tr>
                </thead>

                <tbody class="divide-y divide-gray-200">
                    {#each {length: host.currentLoad.length ? host.currentLoad[0].length : 0}, i}
                        <tr class="*:text-gray-900 *:first:font-medium">
                            <td class="px-3 py-1 whitespace-nowrap">{i}</td>
                            <td class="px-3 py-1 whitespace-nowrap">{host.currentLoad[host.currentLoad.length-1][i].toFixed(2)} %</td>
                            <td class="px-3 py-1 whitespace-nowrap">{(host.currentLoad.reduce((acc, cpu) => acc + cpu[i], 0) / host.currentLoad.length).toFixed(2)} %</td>
                            <td class="px-3 py-1 whitespace-nowrap">{Math.min(...host.currentLoad.map(cpu => cpu[i])).toFixed(2)} %</td>
                            <td class="px-3 py-1 whitespace-nowrap">{Math.max(...host.currentLoad.map(cpu => cpu[i])).toFixed(2)} %</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
{/each}
