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

    const { data } = $props();

    const HISTORY_LENGTH = 75;

    let hosts: {
        [key: string]: {

            id: string;
            invalidKey: boolean;

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
                tx: number[],
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
        for (let i = 0; i < data.clusters.length; i++) {
            const host = data.clusters[i];

            hosts[host.id] = {

                id: host.id,
                invalidKey: false,

                socket: io(host.address, {
                    transports: ["websocket"],
                    autoConnect: true,
                    auth: (cb) => {
                        cb({ token: host.key });
                    }
                }),

                connected: false,
                uptime: 0,

                info: {
                    address: host.address,
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
                    false
                ]
            };

            hosts[host.id].socket.on("connect_error", (err) => {
                if (err.message === "Authentication error") {
                    hosts[host.id].invalidKey = true;
                }
            });

            hosts[host.id].socket.on("connect", () => {
                hosts[host.id].connected = true;
            });

            hosts[host.id].socket.on("disconnect", () => {
                hosts[host.id].connected = false;
            });

            hosts[host.id].socket.on("osInfo", (data) => {
                hosts[host.id].info.hostname = data.hostname
                hosts[host.id].info.platform = data.platform;
                hosts[host.id].info.distro = data.distro;
                hosts[host.id].info.release = data.release;
                hosts[host.id].info.kernel = data.kernel;
            })

            hosts[host.id].socket.on("clusterInfo", (data) => {

                hosts[host.id].uptime = data.uptime || 0;

                hosts[host.id].coreLoad.push(data.cpus);
                if (hosts[host.id].coreLoad.length > HISTORY_LENGTH) {
                    hosts[host.id].coreLoad.shift();
                }

                hosts[host.id].cpuLoad.push(parseFloat(data.currentLoad) || 0);
                if (hosts[host.id].cpuLoad.length > HISTORY_LENGTH) {
                    hosts[host.id].cpuLoad.shift();
                }

                hosts[host.id].cpuTemp.push(parseFloat(data.temp) || 0);
                if (hosts[host.id].cpuTemp.length > HISTORY_LENGTH) {
                    hosts[host.id].cpuTemp.shift();
                }

                hosts[host.id].memory.total = parseFloat(data.memory.total) || 0;

                hosts[host.id].memory.used.push(parseFloat(data.memory.used) || 0);
                if (hosts[host.id].memory.used.length > HISTORY_LENGTH) {
                    hosts[host.id].memory.used.shift();
                }

                hosts[host.id].memory.free.push(parseFloat(data.memory.free) || 0);
                if (hosts[host.id].memory.free.length > HISTORY_LENGTH) {
                    hosts[host.id].memory.free.shift();
                }

                hosts[host.id].network.rx.push(data.network.map((i: { rx_sec: number }) => i.rx_sec || 0).reduce((a: number, b: number) => a + b, 0));
                if (hosts[host.id].network.rx.length > HISTORY_LENGTH) {
                    hosts[host.id].network.rx.shift();
                }

                hosts[host.id].network.tx.push(data.network.map((i: { tx_sec: number }) => i.tx_sec || 0).reduce((a: number, b: number) => a + b, 0));
                if (hosts[host.id].network.tx.length > HISTORY_LENGTH) {
                    hosts[host.id].network.tx.shift();
                }

                hosts[host.id].network.ms.push(data.network[0].speed || 0);
                if (hosts[host.id].network.ms.length > HISTORY_LENGTH) {
                    hosts[host.id].network.ms.shift();
                }

                hosts[host.id].storage = data.storage.map((i: { size: number; used: number; free: number }) => {
                    return {
                        size: i.size,
                        used: i.used,
                        free: i.free,
                    };
                });

                hosts[host.id].storageStats.read.push(data.fsStats.read || 0);
                if (hosts[host.id].storageStats.read.length > HISTORY_LENGTH) {
                    hosts[host.id].storageStats.read.shift();
                }

                hosts[host.id].storageStats.write.push(data.fsStats.write || 0);
                if (hosts[host.id].storageStats.write.length > HISTORY_LENGTH) {
                    hosts[host.id].storageStats.write.shift();
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
        return Object.values(hosts).reduce((acc, host) => acc + host.network.tx[host.network.tx.length - 1], 0) || 0;
    };

    const combinedNetworkIn = () => {
        return Object.values(hosts).reduce((acc, host) => acc + host.network.rx[host.network.rx.length - 1], 0) || 0;
    };
    
</script>

<div class="flex flex-col gap-6 place-items-center w-full max-w-[1128px] mx-auto pt-4">

    <!-- Combined Metrics -->

    <div class="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 place-items-center gap-4 w-full">
        
        <!-- CPU Usage -->
        <div class="flex flex-col gap-1.5 w-full">
            <span class="text-sm text-black/50">
                Clustered CPU Load
            </span>
            <div class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">

                <span class="text-xl font-bold text-gray-900">
                    {combinedCpuLoad()} %
                </span>
            
            </div>
        </div>  

        <!-- Memory -->
        <div class="flex flex-col gap-1.5 w-full">
            <span class="text-sm text-black/50">
                Clustered Memory Load
            </span>
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
        </div>

        <!-- Network out -->
        <div class="flex flex-col gap-1.5 w-full">
            <span class="text-sm text-black/50">
                Clustered Network Out
            </span>
            <div class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">

                <span class="text-xl font-bold text-gray-900">
                    {formatBytes(combinedNetworkOut())} OUT
                </span>
            
            </div> 
        </div>

        <!-- Network in -->
        <div class="flex flex-col gap-1.5 w-full">
            <span class="text-sm text-black/50">
                Clustered Network In
            </span>
            <div class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">

                <span class="text-xl font-bold text-gray-900">
                    {formatBytes(combinedNetworkIn())} IN
                </span>
            
            </div>
        </div>

        <!-- Storage -->
        <div class="flex flex-col gap-1.5 w-full">
            <span class="text-sm text-black/50">
                Clustered Storage
            </span>
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
        
    </div>
    
    <hr class="border-gray-200 w-full" />

    <div class="flex flex-col gap-6 w-full place-items-center">

        {#each Object.values(hosts) as host, i}

            {#if host.invalidKey}
                <p>
                    Authentication error: Invalid key for host {host.info.hostname} ({host.info.address}). Please check your configuration.
                </p>
            {:else}
                <div class="flex flex-col gap-4 w-full">
                    <div class="flex place-items-center justify-between">
                        <a href="/cluster/{host.id}" class="text-lg font-semibold text-gray-600 hover:underline after:content-['_↗']">
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

                        </a>

                        <div>

                            {#if host.connected}
                                <span class="bg-green-400/20 border border-green-400 text-green-600 px-1.5 py-0.5 text-sm rounded-md">
                                    Connected
                                </span>
                            {:else}
                                <span class="bg-red-400/20 border border-red-400 text-red-600 px-1.5 py-0.5 text-sm rounded-md">
                                    Disconnected
                                </span>
                            {/if}


                        </div>

                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-[450px_auto] gap-4">
                        
                        <div class="flex flex-col gap-1.5 w-full">
                            <span class="text-sm text-black/50">
                                CPU Cores Load
                            </span>
                            <div 
                                use:inViewAction={{ threshold: 0.2, trackExit: true }}
                                onenterView={()=>{
                                    host.showCharts[8] = true
                                }}
                                onexitView={()=>{
                                    host.showCharts[8] = false
                                }}
                                class="flex flex-col gap-4 w-full border bg-white border-gray-200 rounded-md p-4">
                                
                                <div class="h-38">
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
                        </div>
        
                        <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-4 w-full sm:place-content-baseline">
                            
                            <div class="flex flex-col gap-1.5 w-full">
                                <span class="text-sm text-black/50">
                                    CPU Load
                                </span>
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
                                                    data: Array.from({ length: host.cpuLoad.length }, () => ""), // Match last 50 data points
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
                            </div>  
                
                            <div class="flex flex-col gap-1.5 w-full">
                                <span class="text-sm text-black/50">
                                    CPU Temperature
                                </span>
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
                                                    data: Array.from({ length: host.cpuTemp.length }, () => ""), // Match last 50 data points
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
                            </div>
        
                            <div class="flex flex-col gap-1.5 w-full">
                                <span class="text-sm text-black/50">
                                    Memory Usage
                                </span>
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
                                                    data: Array.from({ length: host.memory.used.length }, () => ""), // Match last 50 data points
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
                            </div>

                            <div class="flex flex-col gap-1.5 w-full">
                                <span class="text-sm text-black/50">
                                    Network Speed
                                </span>
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
                                                    data: Array.from({ length: host.network.ms.length }, () => ""), // Match last 50 data points
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
                            </div>  

                            <div class="flex flex-col gap-1.5 w-full">
                                <span class="text-sm text-black/50">
                                    Network In
                                </span>
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
                                                    data: Array.from({ length: host.network.rx.length }, () => ""), // Match last 50 data points
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
                            </div>

                            <div class="flex flex-col gap-1.5 w-full">
                                <span class="text-sm text-black/50">
                                    Network Out
                                </span>
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
                                                    data: Array.from({ length: host.network.tx.length }, () => ""), // Match last 50 data points
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
                                                    max: Math.max(...host.network.tx.map((tx) => tx)) + (Math.max(...host.network.tx.map((tx) => tx)) / 5),
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
                                        {formatBytes(host.network.tx.length > 1 ? host.network.tx[host.network.tx.length - 1] : 0)} Out
                                    </span>
                                
                                </div>
                            </div>

                            <div class="flex flex-col gap-1.5 w-full">
                                <span class="text-sm text-black/50">
                                    Storage
                                </span>
                                <div 
                                    use:inViewAction={{ threshold: 0.2, trackExit: true }}
                                    onenterView={(e)=>{
                                        host.showCharts[9] = true
                                    }}
                                    onexitView={(e)=>{
                                        host.showCharts[9] = false
                                    }}
                                    class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
                                
                                    {#if host.showCharts[9]}
                                        <div class="absolute w-full h-full">
                                            <div 
                                                class="bg-red-400/10 border-t border-red-400/60 absolute bottom-0 left-0 w-full"
                                                style="height: {
                                                    ((host.storage.reduce((acc, storage) => acc + storage.used, 0) || 0) / (host.storage.reduce((acc, storage) => acc + storage.size, 0) || 0)) * 100
                                                }%;"
                                            ></div>
                                        </div>
                                    {/if}

                                    <span class="text-xl font-bold text-gray-900">
                                        {formatBytes(host.storage.reduce((acc, storage) => acc + storage.used, 0))} 
                                        /
                                        {formatBytes(host.storage.reduce((acc, storage) => acc + storage.size, 0))} 
                                    </span>
                                
                                </div>
                            </div>

                            <div class="flex flex-col gap-1.5 w-full">
                                <span class="text-sm text-black/50">
                                    Storage Read
                                </span>
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
                                                    data: Array.from({ length: host.storageStats.read.length }, () => ""), // Match last 50 data points
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
                            </div>  

                            <div class="flex flex-col gap-1.5 w-full">
                                <span class="text-sm text-black/50">
                                    Storage Write
                                </span>
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
                                                    data: Array.from({ length: host.storageStats.write.length }, () => ""), // Match last 50 data points
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
                </div>
            {/if}

        {/each}

    </div>
</div>