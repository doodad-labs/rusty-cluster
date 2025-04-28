<script lang="ts">
    import { io } from "socket.io-client";
    import type { Socket } from "socket.io-client";
    import { onMount } from "svelte";
    import { clampNumber, getColour } from "$lib/utils";

    const HISTORY_LENGTH = 75;

    const hostAddress = [
        
    ];

    let hosts: {
        [key: string]: {
            socket: Socket;
            coreLoad: number[][];
            cpuLoad: number[];
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
                coreLoad: [],
                cpuLoad: [],
            };

            hosts[host].socket.on("currentLoad", (data) => {
                hosts[host].coreLoad.push(
                    data.cpus.map((cpu: {load: number}) => cpu.load || 0),
                );

                if (hosts[host].coreLoad.length > HISTORY_LENGTH) {
                    hosts[host].coreLoad.shift();
                }

                hosts[host].cpuLoad.push(data.currentLoad);

                if (hosts[host].cpuLoad.length > HISTORY_LENGTH) {
                    hosts[host].cpuLoad.shift();
                }
            });
        }
    });

    import { Chart } from "svelte-echarts";
    import { init, use } from "echarts/core";
    import { LineChart, GaugeChart } from "echarts/charts";
    import { GridComponent, TooltipComponent } from "echarts/components";
    import { CanvasRenderer } from "echarts/renderers";

    use([
        GaugeChart,
        LineChart,
        GridComponent,
        CanvasRenderer,
        TooltipComponent,
    ]);
</script>

<div class="flex flex-col gap-4">
    <div class="flex gap-3 flex-wrap">
        {#each Object.values(hosts) as host}
            <div class="flex justify-center place-items-center relative w-50 h-22 border bg-white border-gray-200 rounded-md">
                <Chart
                    class="absolute top-0 left-0 w-full h-full opacity-20"
                    {init}
                    options={{
                        xAxis: {
                            show: false, // Hide x-axis
                            boundaryGap: false,
                            data: Array.from({ length: HISTORY_LENGTH }, () => ""), // Match last 50 data points
                            axisTick: { show: false },
                        },
                        yAxis: {
                            type: "value",
                            axisLabel: {
                                formatter: "{value} %",
                            },
                            axisTick: { show: false }, // Hide y-axis ticks
                            show: false, // Hide y-axis
                            min: 0, // Fix baseline at 0 for consistency
                            max: clampNumber(
                                Math.max(...host.coreLoad.map((cpu) => cpu[0])),
                                5,
                                100,
                            ),
                        },
                        grid: {
                            top: 5, // Minimal padding
                            right: 0,
                            bottom: 2,
                            left: 0,
                        },
                        series: [
                            {
                                // Assuming 4 cores
                                data: host.cpuLoad.map(load => clampNumber(load, 0, 100)),
                                color: getColour(0), // Use a function to get the color
                                type: "line",
                                symbol: "none", // No data points
                                lineStyle: {
                                    width: 1.2, // Slightly thicker line
                                },
                                areaStyle: {
                                    opacity: 0.15, // Subtle fill
                                },
                                smooth: 0, // Mild smoothing (0 to 1)
                            }
                        ],
                        tooltip: { show: false }, // Disable tooltips
                        animation: false, // Avoid distracting animation
                    }}
                />

                <span class="text-2xl font-bold text-gray-900">
                    {(host.cpuLoad.length > 1 ? host.cpuLoad[host.cpuLoad.length - 1] : 0).toFixed(2)}%
                </span>
            
            </div>
        {/each}
    </div>
    
    <div class="flex gap-3 flex-wrap">
        {#each Object.values(hosts) as host}
            <div class="flex place-items-start gap-4">
                <!-- <div class="w-75 h-42 border bg-white border-gray-200 rounded-md">
                    <Chart
                        {init}
                        options={{
                            series: [
                                {
                                    type: "gauge",
                                    startAngle: 180,
                                    endAngle: 0,
                                    radius: "130%",
                                    center: ["50%", "80%"],
                                    min: 0,
                                    max: 100,
                                    splitNumber: -1,
                                    itemStyle: {
                                        color: "rgba(0,0,0,0.5)",
                                    },
                                    progress: {
                                        show: true,
                                        width: 14,
                                    },
                                    pointer: {
                                        show: false,
                                    },
                                    axisLine: {
                                        lineStyle: {
                                            width: 14,
                                            color: [
                                                [0.6, "#7CFFB2"],
                                                [0.85, "#FFFF00"],
                                                [1, "#FF6E76"],
                                            ],
                                        },
                                    },
                                    axisTick: {
                                        show: false,
                                    },
                                    axisLabel: {
                                        show: false,
                                        distance: -15,
                                        color: "#999",
                                        fontSize: 10,
                                    },
                                    anchor: {
                                        show: false,
                                    },
                                    title: {
                                        show: false,
                                    },
                                    detail: {
                                        valueAnimation: true,
                                        width: "10%",
                                        lineHeight: 40,
                                        borderRadius: 8,
                                        offsetCenter: [0, "-15%"],
                                        fontSize: 18,
                                        fontWeight: "bolder",
                                        formatter: "{value}%",
                                        color: "inherit",
                                    },
                                    data: [
                                        {
                                            value: clampNumber(
                                                host.load,
                                                0,
                                                100,
                                            ).toFixed(2),
                                        },
                                    ],
                                    grid: {
                                        top: 0,
                                        right: 0,
                                        bottom: 0,
                                        left: 0,
                                    },
                                },
                            ],
                        }}
                    />
                </div> -->
    
                <div class="flex flex-col gap-3 w-120 border bg-white border-gray-200 rounded-md p-4">
                    <Chart
                        class="bg-box h-45"
                        {init}
                        options={{
                            xAxis: {
                                show: true, // Hide x-axis
                                boundaryGap: false,
                                data: Array.from({ length: HISTORY_LENGTH }, () => ""), // Match last 50 data points
                                axisTick: { show: false },
                            },
                            yAxis: {
                                type: "value",
                                axisLabel: {
                                    formatter: "{value} %",
                                },
                                axisTick: { show: false }, // Hide y-axis ticks
                                show: false, // Hide y-axis
                                min: 0, // Fix baseline at 0 for consistency
                                max: clampNumber(
                                    Math.max(...host.coreLoad.map((cpu) => cpu[0]+10)),
                                    30,
                                    110,
                                ),
                            },
                            grid: {
                                top: 5, // Minimal padding
                                right: 0,
                                bottom: 2,
                                left: 0,
                            },
                            series: Array.from({ length: 4 }, (_, i) => ({
                                // Assuming 4 cores
                                data: host.coreLoad.map((cpu) =>
                                    clampNumber(cpu[i], 0, 100),
                                ),
                                color: getColour(i), // Use a function to get the color
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
                            {#each { length: host.coreLoad.length ? host.coreLoad[0].length : 0 }, i}
                                <tr class="*:text-gray-900 *:first:font-medium">
                                    <td class="px-3 py-1 whitespace-nowrap">
    
                                        <div class="flex place-items-center gap-2">
                                            <div class="w-6 h-3 border-2 rounded-xs overflow-hidden" style="border-color: {getColour(i)};">
                                                <div class="w-full h-full opacity-25" style="background: {getColour(i)};"></div>
                                            </div>
                                            {i + 1}
                                        </div>
    
                                    </td>
                                    <td class="px-3 py-1 whitespace-nowrap">
                                        {host.coreLoad[host.coreLoad.length - 1][i].toFixed(2)}%
                                    </td>
                                    <td class="px-3 py-1 whitespace-nowrap"
                                        >{(
                                            host.coreLoad.reduce(
                                                (acc, cpu) => acc + cpu[i],
                                                0,
                                            ) / host.coreLoad.length
                                        ).toFixed(2)}%</td
                                    >
                                    <td class="px-3 py-1 whitespace-nowrap"
                                        >{Math.min(
                                            ...host.coreLoad.map((cpu) => cpu[i]),
                                        ).toFixed(2)}%</td
                                    >
                                    <td class="px-3 py-1 whitespace-nowrap"
                                        >{Math.max(
                                            ...host.coreLoad.map((cpu) => cpu[i]),
                                        ).toFixed(2)}%</td
                                    >
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        {/each}
    </div>
</div>