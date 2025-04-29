<script lang="ts">
    import { io } from "socket.io-client";
    import type { Socket } from "socket.io-client";
    import { onMount } from "svelte";
    import { formatUptime, clampNumber, getColour, bytesToGB, calculateClusterCpuUsage, getLatestCoreLoad, formatBytes } from "$lib/utils";
    import inViewAction from '$lib/inViewAction';

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

    const HISTORY_LENGTH = 75;

    const hostAddress: string[] = [
        
    ];

    let hosts: {
        [key: string]: {

            socket: Socket;
            connected: boolean;
            uptime: number;

            info: {
                address: string;
                hostname: string;
                platform: string;
                distro: string;
                release: string;
                kernel: string;
            }

            coreLoad: number[][];
            cpuLoad: number[];
            cpuTemp: number[];

            memory: {
                total: number;
                used: number[];
                free: number[];
            }

            network: {
                rx: number[],
                tx: {
                    timestamp: number;
                    value: number;
                }[],
                ms: number[],
            },

            storage: {
                size: number;
                used: number;
                free: number;
            }[],

            storageStats: {
                read: number[];
                write: number[];
            },

            showCharts: boolean[]
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

                connected: false,
                uptime: 0,

                info: {
                    address: host,
                    hostname: "",
                    platform: "",
                    distro: "",
                    release: "",
                    kernel: "",
                },

                coreLoad: [],
                cpuLoad: [],
                cpuTemp: [],

                memory: {
                    total: 0,
                    used: [],
                    free: [],
                },

                network: {
                    rx: [],
                    tx: [],
                    ms: [],
                },

                storage: [],

                storageStats: {
                    read: [],
                    write: [],
                },

                showCharts: [
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                    false,
                ]
            };

            hosts[host].socket.on("connect", () => {
                hosts[host].connected = true;
            });

            hosts[host].socket.on("disconnect", () => {
                hosts[host].connected = false;
            });

            hosts[host].socket.on("osInfo", (data) => {
                hosts[host].info.hostname = data.hostname
                hosts[host].info.platform = data.platform;
                hosts[host].info.distro = data.distro;
                hosts[host].info.release = data.release;
                hosts[host].info.kernel = data.kernel;
            })

            hosts[host].socket.on("clusterInfo", (data) => {

                hosts[host].uptime = data.uptime || 0;

                hosts[host].coreLoad.push(data.cpus);
                if (hosts[host].coreLoad.length > HISTORY_LENGTH) {
                    hosts[host].coreLoad.shift();
                }

                hosts[host].cpuLoad.push(parseFloat(data.currentLoad) || 0);
                if (hosts[host].cpuLoad.length > HISTORY_LENGTH) {
                    hosts[host].cpuLoad.shift();
                }

                hosts[host].cpuTemp.push(parseFloat(data.temp) || 0);
                if (hosts[host].cpuTemp.length > HISTORY_LENGTH) {
                    hosts[host].cpuTemp.shift();
                }

                hosts[host].memory.total = parseFloat(data.memory.total) || 0;

                hosts[host].memory.used.push(parseFloat(data.memory.used) || 0);
                if (hosts[host].memory.used.length > HISTORY_LENGTH) {
                    hosts[host].memory.used.shift();
                }

                hosts[host].memory.free.push(parseFloat(data.memory.free) || 0);
                if (hosts[host].memory.free.length > HISTORY_LENGTH) {
                    hosts[host].memory.free.shift();
                }

                hosts[host].network.rx.push(data.network.map((i: { rx_sec: number }) => i.rx_sec || 0).reduce((a: number, b: number) => a + b, 0));
                if (hosts[host].network.rx.length > HISTORY_LENGTH) {
                    hosts[host].network.rx.shift();
                }

                hosts[host].network.tx.push({
                    timestamp: Date.now(),
                    value: data.network.map((i: { tx_sec: number }) => i.tx_sec || 0).reduce((a: number, b: number) => a + b, 0)
                });
                if (hosts[host].network.tx.length > HISTORY_LENGTH) {
                    hosts[host].network.tx.shift();
                }

                hosts[host].network.ms.push(data.network[0].speed || 0);
                if (hosts[host].network.ms.length > HISTORY_LENGTH) {
                    hosts[host].network.ms.shift();
                }

                hosts[host].storage = data.storage.map((i: { size: number; used: number; free: number }) => {
                    return {
                        size: i.size,
                        used: i.used,
                        free: i.free,
                    };
                });

                hosts[host].storageStats.read.push(data.fsStats.read || 0);
                if (hosts[host].storageStats.read.length > HISTORY_LENGTH) {
                    hosts[host].storageStats.read.shift();
                }

                hosts[host].storageStats.write.push(data.fsStats.write || 0);
                if (hosts[host].storageStats.write.length > HISTORY_LENGTH) {
                    hosts[host].storageStats.write.shift();
                }

            });
        }

        // Cleanup on component destroy
        return () => {
            for (const host in hosts) {
                hosts[host].socket.disconnect();
            }
        };
    });

    const combinedCpuLoad = () => {
        return (calculateClusterCpuUsage(
            Object.values(hosts).map((host) => {
                return {
                    cpuUsagePercent: (host.cpuLoad.length > 1 ? host.cpuLoad[host.cpuLoad.length - 1] : 0),
                    cores: host.coreLoad.length,
                }
            })
        ) || 0).toFixed(2);
    };

    const combinedNetworkOut = () => {
        return Object.values(hosts).reduce((acc, host) => acc + host.network.tx[host.network.tx.length - 1]?.value, 0) || 0;
    };

    const combinedNetworkIn = () => {
        return Object.values(hosts).reduce((acc, host) => acc + host.network.rx[host.network.rx.length - 1], 0) || 0;
    };
    
</script>

<div class="flex flex-col gap-6 place-items-center w-full max-w-[1128px] mx-auto pt-4">

    <div class="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 place-items-center gap-4 w-full">
        
        <!-- CPU Usage -->
        <div class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">

            <span class="text-xl font-bold text-gray-900">
                {combinedCpuLoad()} %
            </span>
        
        </div>

        <!-- Memory -->
        <div class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">

            <span class="text-xl font-bold text-gray-900">
                {bytesToGB(
                    Object.values(hosts).reduce((acc, host) => acc + host.memory.used[host.memory.used.length - 1], 0) || 0
                )} 
                / 
                {bytesToGB(
                    Object.values(hosts).reduce((acc, host) => acc + host.memory.total, 0) || 0
                )} 
                GB
            </span>
        
        </div>

        <!-- Network out -->
        <div class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">

            <span class="text-xl font-bold text-gray-900">
                {formatBytes(combinedNetworkOut())} OUT
            </span>
        
        </div> 

        <!-- Network in -->
        <div class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">

            <span class="text-xl font-bold text-gray-900">
                {formatBytes(combinedNetworkIn())} IN
            </span>
        
        </div>

        <!-- Storage -->
        <div class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">

            <span class="text-xl font-bold text-gray-900">
                {formatBytes(
                    Object.values(hosts).reduce((acc, host) => acc + host.storage.reduce((acc, storage) => acc + storage.used, 0), 0) || 0
                )}
                /
                {formatBytes(
                    Object.values(hosts).reduce((acc, host) => acc + host.storage.reduce((acc, storage) => acc + storage.size, 0), 0) || 0
                )}
            </span>
        
        </div>
        
    </div>
    
    <hr class="border-gray-200 w-full" />

    <div class="flex flex-col gap-6 w-full place-items-center">

        {#each Object.values(hosts) as host, i}

            <div class="flex flex-col gap-4 w-full">
                <div class="flex place-items-center justify-between">
                    <h1 class="text-lg font-semibold text-gray-600">
                        <span class="capitalize">
                            {host.info.hostname}
                        </span>
    
                        @
    
                        {host.info.address}
    
                        |
    
                        {host.info.platform}
    
                        ({host.info.distro} {host.info.release})

                        |

                        {formatUptime(host.uptime)}

                        uptime

                    </h1>

                    <div>

                        {#if host.connected}
                            <span class="bg-green-400/20 border border-green-400 text-green-600 px-1 py-0.5 text-sm rounded-md">
                                Connected
                            </span>
                        {:else}
                            <span class="bg-red-400/20 border border-red-400 text-red-600 px-1 py-0.5 text-sm rounded-md">
                                Disconnected
                            </span>
                        {/if}


                    </div>

                </div>

                <div class="grid grid-cols-1 xl:grid-cols-[450px_auto] gap-4">
                    
                    <div 
                        use:inViewAction={{ threshold: 0.2, trackExit: true }}
                        onenterView={()=>{
                            host.showCharts[8] = true
                        }}
                        onexitView={()=>{
                            host.showCharts[8] = false
                        }}
                        class="flex flex-col gap-4 w-full border bg-white border-gray-200 rounded-md p-4">
                        
                        <div class="h-25">
                            {#if host.showCharts[8]}
                                <Chart
                                    {init}
                                    options={{
                                        xAxis: {
                                            show: true,
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
                                            show: true, // Hide y-axis
                                            min: 0, // Fix baseline at 0 for consistency
                                            max: clampNumber(
                                                Math.max(...host.coreLoad.map((cpu) => cpu[0])) + 20,
                                                30,
                                                100,
                                            ),
                                        },
                                        grid: {
                                            top: 5, // Minimal padding
                                            right: 0,
                                            bottom: 2,
                                            left: 0,
                                        },
                                        series: Array.from({ length: host.coreLoad.length }, (_, i) => ({
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
                            {/if}
                        </div>
    
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
                                            {getLatestCoreLoad(host.coreLoad, i)} %
                                        </td>
                                        <td class="px-3 py-1 whitespace-nowrap"
                                            >{(
                                                host.coreLoad.reduce(
                                                    (acc, cpu) => acc + cpu[i],
                                                    0,
                                                ) / host.coreLoad.length
                                            ).toFixed(2)} %</td
                                        >
                                        <td class="px-3 py-1 whitespace-nowrap"
                                            >{Math.min(
                                                ...host.coreLoad.map((cpu) => cpu[i]),
                                            ).toFixed(2)} %</td
                                        >
                                        <td class="px-3 py-1 whitespace-nowrap"
                                            >{Math.max(
                                                ...host.coreLoad.map((cpu) => cpu[i]),
                                            ).toFixed(2)} %</td
                                        >
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
    
                    <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-4 w-full sm:place-content-baseline">
                        
                        <div 
                            use:inViewAction={{ threshold: 0.2, trackExit: true }}
                            onenterView={(e)=>{
                                host.showCharts[0] = true
                            }}
                            onexitView={(e)=>{
                                host.showCharts[0] = false
                            }}
                            class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
                        
                            {#if host.showCharts[0]}
                                <Chart
                                    class="absolute top-0 left-0 w-full h-full opacity-30"
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
                                                Math.max(...host.cpuLoad) + 5,
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
                                                data: host.cpuLoad.map(load => clampNumber(load, 0, 100)),
                                                color: "#158c62", // Use a function to get the color
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
                            {/if}
            
                            <span class="text-xl font-bold text-gray-900">
                                {(host.cpuLoad.length > 1 ? host.cpuLoad[host.cpuLoad.length - 1] : 0).toFixed(2)} %
                            </span>
                        
                        </div>
            
                        <div 
                            use:inViewAction={{ threshold: 0.2, trackExit: true }}
                            onenterView={(e)=>{
                                host.showCharts[1] = true
                            }}
                            onexitView={(e)=>{
                                host.showCharts[1] = false
                            }}
                            class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
                            
                            {#if host.showCharts[1]}
                                <Chart
                                    class="absolute top-0 left-0 w-full h-full opacity-30"
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
                                            max: Math.max(...host.cpuTemp, 100),
                                        },
                                        grid: {
                                            top: 5, // Minimal padding
                                            right: 0,
                                            bottom: 2,
                                            left: 0,
                                        },
                                        series: [
                                            {
                                                data: host.cpuTemp,
                                                color: "#2a158c", // Use a function to get the color
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
                            {/if}
            
                            <span class="text-xl font-bold text-gray-900">
                                {(host.cpuTemp.length > 1 ? host.cpuTemp[host.cpuLoad.length - 1] : 0).toFixed(2)} °C
                            </span>
                        
                        </div>
    
                        <div 
                            use:inViewAction={{ threshold: 0.2, trackExit: true }}
                            onenterView={(e)=>{
                                host.showCharts[2] = true
                            }}
                            onexitView={(e)=>{
                                host.showCharts[2] = false
                            }}
                            class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
                            
                            {#if host.showCharts[2]}
                                <Chart
                                    class="absolute top-0 left-0 w-full h-full opacity-30"
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
                                            max: host.memory.total,
                                        },
                                        grid: {
                                            top: 5, // Minimal padding
                                            right: 0,
                                            bottom: 2,
                                            left: 0,
                                        },
                                        series: [
                                            {
                                                data: host.memory.used,
                                                color: "#a00c0c", // Use a function to get the color
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
                            {/if}
            
                            <span class="text-xl font-bold text-gray-900">
                                {bytesToGB(host.memory.used.length > 1 ? host.memory.used[host.memory.used.length - 1] : 0)}
                                /
                                {bytesToGB(host.memory.total)}
                                GB
                            </span>
                        
                        </div>
                    

                        <div 
                            use:inViewAction={{ threshold: 0.2, trackExit: true }}
                            onenterView={(e)=>{
                                host.showCharts[3] = true
                            }}
                            onexitView={(e)=>{
                                host.showCharts[3] = false
                            }}
                            class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
                        
                            {#if host.showCharts[3]}
                                <Chart
                                    class="absolute top-0 left-0 w-full h-full opacity-30"
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
                                            max: Math.max(...host.network.ms) + (Math.max(...host.network.ms) / 5),
                                        },
                                        grid: {
                                            top: 5, // Minimal padding
                                            right: 0,
                                            bottom: 2,
                                            left: 0,
                                        },
                                        series: [
                                            {
                                                data: host.network.ms,
                                                color: "#0d3f89", // Use a function to get the color
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
                            {/if}
            
                            <span class="text-xl font-bold text-gray-900">
                                {(host.network.ms.length > 1 ? host.network.ms[host.network.ms.length - 1] : 0).toFixed(0) } ms
                            </span>
                        
                        </div>

                        <div 
                            use:inViewAction={{ threshold: 0.2, trackExit: true }}
                            onenterView={(e)=>{
                                host.showCharts[4] = true
                            }}
                            onexitView={(e)=>{
                                host.showCharts[4] = false
                            }}
                            class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
                        
                            {#if host.showCharts[4]}
                                <Chart
                                    class="absolute top-0 left-0 w-full h-full opacity-30"
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
                                            max: Math.max(...host.network.rx) + (Math.max(...host.network.rx) / 5),
                                        },
                                        grid: {
                                            top: 5, // Minimal padding
                                            right: 0,
                                            bottom: 2,
                                            left: 0,
                                        },
                                        series: [
                                            {
                                                data: host.network.rx,
                                                color: "#dd30cc", // Use a function to get the color
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
                            {/if}
            
                            <span class="text-xl font-bold text-gray-900">
                                {formatBytes(host.network.rx.length > 1 ? host.network.rx[host.network.rx.length - 1] : 0)} In
                            </span>
                        
                        </div>

                        <div 
                            use:inViewAction={{ threshold: 0.2, trackExit: true }}
                            onenterView={(e)=>{
                                host.showCharts[5] = true
                            }}
                            onexitView={(e)=>{
                                host.showCharts[5] = false
                            }}
                            class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
                        
                            {#if host.showCharts[5]}
                                <Chart
                                    class="absolute top-0 left-0 w-full h-full opacity-30"
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
                                            max: Math.max(...host.network.tx.map((tx) => tx.value)) + (Math.max(...host.network.tx.map((tx) => tx.value)) / 5),
                                        },
                                        grid: {
                                            top: 5, // Minimal padding
                                            right: 0,
                                            bottom: 2,
                                            left: 0,
                                        },
                                        series: [
                                            {
                                                data: host.network.tx,
                                                color: "#04aaf7", // Use a function to get the color
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
                            {/if}
            
                            <span class="text-xl font-bold text-gray-900">
                                {formatBytes(host.network.tx.length > 1 ? host.network.tx[host.network.tx.length - 1]?.value : 0)} Out
                            </span>
                        
                        </div>
                    

                        
                        <div class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
                        
                            <span class="text-xl font-bold text-gray-900">
                                {formatBytes(host.storage.reduce((acc, storage) => acc + storage.used, 0))} 
                                /
                                {formatBytes(host.storage.reduce((acc, storage) => acc + storage.size, 0))} 
                            </span>
                        
                        </div>

                        <div 
                            use:inViewAction={{ threshold: 0.2, trackExit: true }}
                            onenterView={(e)=>{
                                host.showCharts[6] = true
                            }}
                            onexitView={(e)=>{
                                host.showCharts[6] = false
                            }}
                            class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
                        
                            {#if host.showCharts[6]}
                                <Chart
                                    class="absolute top-0 left-0 w-full h-full opacity-30"
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
                                            max: Math.max(...host.storageStats.read) + (Math.max(...host.storageStats.read) / 5),
                                        },
                                        grid: {
                                            top: 5, // Minimal padding
                                            right: 0,
                                            bottom: 2,
                                            left: 0,
                                        },
                                        series: [
                                            {
                                                data: host.storageStats.read,
                                                color: "#b639f9", // Use a function to get the color
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
                            {/if}
            
                            <span class="text-xl font-bold text-gray-900">
                                {formatBytes(host.storageStats.read.length > 1 ? host.storageStats.read[host.storageStats.read.length - 1] : 0)}
                                Read
                            </span>
                        
                        </div>

                        <div 
                            use:inViewAction={{ threshold: 0.2, trackExit: true }}
                            onenterView={(e)=>{
                                host.showCharts[7] = true
                            }}
                            onexitView={(e)=>{
                                host.showCharts[7] = false
                            }}
                            class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
                        
                            {#if host.showCharts[7]}
                                <Chart
                                    class="absolute top-0 left-0 w-full h-full opacity-30"
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
                                            max: Math.max(...host.storageStats.write) + (Math.max(...host.storageStats.write) / 5),
                                        },
                                        grid: {
                                            top: 5, // Minimal padding
                                            right: 0,
                                            bottom: 2,
                                            left: 0,
                                        },
                                        series: [
                                            {
                                                data: host.storageStats.write,
                                                color: "#00729b", // Use a function to get the color
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
                            {/if}
            
                            <span class="text-xl font-bold text-gray-900">
                                {formatBytes(host.storageStats.write.length > 1 ? host.storageStats.write[host.storageStats.write.length - 1] : 0)}
                                Write
                            </span>
                        
                        </div>

                    </div>
    
                </div>
            </div>

        {/each}

    </div>
</div>