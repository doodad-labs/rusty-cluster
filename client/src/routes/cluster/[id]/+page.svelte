<script lang="ts">
    import { io } from "socket.io-client";
    import type { Socket } from "socket.io-client";
    import { onDestroy, onMount } from "svelte";
    import { formatUptime, clampNumber, getColour, bytesToGB, getLatestCoreLoad, formatBytes } from "$lib/utils";
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

    let invalidKey: boolean = $state(false);

    let host: {
        id: string;

        socket: Socket | null;
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
                name: number[]
                rx: number[],
                tx: number[],
                ms: number[],
        }[],

        storage: {
            name: string;
            type: string;
            mount: string;
            size: number;
            used: number;
            free: number;
        }[],

        storageStats: {
            read: number[];
            write: number[];
        }
    } = $state({
        id: data.cluster.id,

        socket: null,

        connected: false,
        uptime: 0,

        info: {
            address: data.cluster.address,
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

        network: [],
        storage: [],

        storageStats: {
            read: [],
            write: [],
        }
    });

    let showCharts = $state([
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
    ])

    onMount(() => {
        host.socket = io(data.cluster.address, {
            transports: ["websocket"],
            autoConnect: true,
            auth: (cb) => {
                cb({ token: data.cluster.key });
            }
        });

        host.socket.on("connect_error", (err) => {
            if (err.message === "Authentication error") {
                invalidKey = true;
            }
        });

        host.socket.on("connect", () => {
            invalidKey = false;
            host.connected = true;
        });

        host.socket.on("disconnect", () => {
            host.connected = false;
        });

        host.socket.on("osInfo", (data) => {
            
            host.info.hostname = data.hostname
            host.info.platform = data.platform;
            host.info.distro = data.distro;
            host.info.release = data.release;
            host.info.kernel = data.kernel;
        })

        host.socket.on("clusterInfo", (data) => {

            host.uptime = data.uptime || 0;

            host.coreLoad.push(data.cpus);
            if (host.coreLoad.length > 150) {
                host.coreLoad.shift();
            }

            host.cpuLoad.push(parseFloat(data.currentLoad) || 0);
            if (host.cpuLoad.length > HISTORY_LENGTH) {
                host.cpuLoad.shift();
            }

            host.cpuTemp.push(parseFloat(data.temp) || 0);
            if (host.cpuTemp.length > HISTORY_LENGTH) {
                host.cpuTemp.shift();
            }

            host.memory.total = parseFloat(data.memory.total) || 0;

            host.memory.used.push(parseFloat(data.memory.used) || 0);
            if (host.memory.used.length > HISTORY_LENGTH) {
                host.memory.used.shift();
            }

            host.memory.free.push(parseFloat(data.memory.free) || 0);
            if (host.memory.free.length > HISTORY_LENGTH) {
                host.memory.free.shift();
            }

            for (let i = 0; i < data.network.length; i++) {
                const network = data.network[i];

                console.log(network)

                if (host.network[network.name] === undefined) {
                    host.network[network.name] = {
                        name: network.name,
                        rx: [],
                        tx: [],
                        ms: [],
                    };
                }

                host.network[network.name].rx.push(data.network.map((i: { rx_sec: number }) => i.rx_sec || 0).reduce((a: number, b: number) => a + b, 0));
                if (host.network[network.name].rx.length > HISTORY_LENGTH) {
                    host.network[network.name].rx.shift();
                }

                host.network[network.name].tx.push(data.network.map((i: { tx_sec: number }) => i.tx_sec || 0).reduce((a: number, b: number) => a + b, 0));
                if (host.network[network.name].tx.length > HISTORY_LENGTH) {
                    host.network[network.name].tx.shift();
                }

                host.network[network.name].ms.push(data.network[0].speed || 0);
                if (host.network[network.name].ms.length > HISTORY_LENGTH) {
                    host.network[network.name].ms.shift();
                }
            }

            /* 
                Remove network that is not in the data anymore, this is to prevent the UI from showing old data. 
            */

            for (let i = 0; i < host.network.length; i++) {
                const network = host.network[i];
                let found = false;

                for (let j = 0; j < data.network.length; j++) {
                    
                    const networkData = data.network[j];

                    if (network.name === networkData.name) {
                        found = true;
                    }
                    
                }

                if (!found) {
                    host.network.splice(i, 1);
                    i--;
                }

            }


            for (let i = 0; i < data.storage.length; i++) {
                const storage = data.storage[i];

                if (host.storage[storage.name] === undefined) {
                    host.storage[storage.name] = {
                        name: storage.name,
                        type: storage.type,
                        mount: storage.mount,
                        size: 0,
                        used: 0,
                        free: 0,
                    };
                }

                host.storage[storage.name].size = parseFloat(storage.size) || 0;
                host.storage[storage.name].used = parseFloat(storage.used) || 0;
                host.storage[storage.name].free = parseFloat(storage.free) || 0;
            }

            /* 
            Remove storage that is not in the data anymore, this is to prevent the UI from showing old data. 
            */
            for (let i = 0; i < host.storage.length; i++) {
                const storage = host.storage[i];
                let found = false;

                for (let j = 0; j < data.storage.length; j++) {
                    
                    const storageData = data.storage[j];

                    if (storage.name === storageData.name) {
                        found = true;
                    }
                    
                }

                if (!found) {
                    host.storage.splice(i, 1);
                    i--;
                }

            }


            host.storageStats.read.push(data.fsStats.read || 0);
            if (host.storageStats.read.length > HISTORY_LENGTH) {
                host.storageStats.read.shift();
            }

            host.storageStats.write.push(data.fsStats.write || 0);
            if (host.storageStats.write.length > HISTORY_LENGTH) {
                host.storageStats.write.shift();
            }

        })
    });

    onDestroy(() => {

        if (host.socket) {
            host.socket.disconnect();
        };

        invalidKey = true;

    });
    
</script>

{#if invalidKey}

    <p>
        The key you provided to authenticate with this cluster is invalid, please check it and try again.
    </p>

{:else}

    <div class="flex flex-col gap-6 place-items-center w-full max-w-[1128px] mx-auto pt-4">

        <div class="flex place-items-center justify-between w-full">
            <span class="text-lg font-semibold text-gray-600">
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

            </span>

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

        <div class="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 place-items-center gap-4 w-full">
    
            <!-- CPU Usage -->
            <div class="flex flex-col gap-1.5 w-full">
                <span class="text-sm text-black/50">
                    CPU Load
                </span>
                <div 
                    use:inViewAction={{ threshold: 0.2, trackExit: true }}
                    onenterView={()=>{
                        showCharts[1] = true
                    }}
                    onexitView={()=>{
                        showCharts[1] = false
                    }}
                    class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
        
                    {#if showCharts[1]}
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
                        {
                            (host.cpuLoad.length > 1 ? host.cpuLoad[host.cpuLoad.length - 1] || 0 : 0).toFixed(2)
                        } %
                    </span>
                
                </div>
            </div> 
    
            <!-- Memory -->
            <div class="flex flex-col gap-1.5 w-full">
                <span class="text-sm text-black/50">
                    Memory Usage
                </span>
                <div 
                    use:inViewAction={{ threshold: 0.2, trackExit: true }}
                    onenterView={()=>{
                        showCharts[2] = true
                    }}
                    onexitView={()=>{
                        showCharts[2] = false
                    }}
                    class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">

                    {#if showCharts[2]}
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
                        {bytesToGB(
                            host.memory.used.length > 1 ? host.memory.used[host.memory.used.length - 1] || 0 : 0
                        )} 
                        / 
                        {bytesToGB(
                            host.memory.free.length > 1 ? host.memory.free[host.memory.free.length - 1] || 0 : 0
                        )} 
                        GB
                    </span>
                
                </div>
            </div>
    
            <!-- Network out -->
            <div class="flex flex-col gap-1.5 w-full">
                <span class="text-sm text-black/50">
                    Total Network Out
                </span>
                <div 
                    use:inViewAction={{ threshold: 0.2, trackExit: true }}
                    onenterView={()=>{
                        showCharts[3] = true
                    }}
                    onexitView={()=>{
                        showCharts[3] = false
                    }}
                    class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
    

                    {#if showCharts[3]}

                        <Chart
                            class="absolute top-0 left-0 w-full h-full opacity-30"
                            {init}
                            options={{
                                xAxis: {
                                    show: false, // Hide x-axis
                                    boundaryGap: false,
                                    data: Array.from({ length: Object.values(host.network).length > 0 ? Object.values(host.network)[0].tx.length : 0 }, () => ""),
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
                                    max: Math.max(...Object.values(host.network).map((i: { tx: number[] }) => Math.max(...i.tx))) + (Math.max(...Object.values(host.network).map((i: { tx: number[] }) => Math.max(...i.tx))) / 5),
                                },
                                grid: {
                                    top: 5, // Minimal padding
                                    right: 0,
                                    bottom: 2,
                                    left: 0,
                                },
                                series: [
                                    {
                                        data: Object.values(host.network).map((i: { tx: number[] }) => i.tx).reduce((a: number[], b: number[]) => a.concat(b), []),
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
                        {formatBytes(
                            Object.values(host.network)
                            .map(network => network.tx)
                            .reduce((a: number[], b: number[]) => a.concat(b), [])
                            .at(-1) || 0
                            
                        )} OUT
                    </span>
                
                </div> 
            </div> 
    
            <!-- Network in -->
            <div class="flex flex-col gap-1.5 w-full">
                <span class="text-sm text-black/50">
                    Total Network In
                </span>
                <div 
                    use:inViewAction={{ threshold: 0.2, trackExit: true }}
                    onenterView={()=>{
                        showCharts[4] = true
                    }}
                    onexitView={()=>{
                        showCharts[4] = false
                    }}
                    class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
        
                    {#if showCharts[4]}
                        <Chart
                            class="absolute top-0 left-0 w-full h-full opacity-30"
                            {init}
                            options={{
                                xAxis: {
                                    show: false, // Hide x-axis
                                    boundaryGap: false,
                                    data: Array.from({ length: Object.values(host.network).length > 0 ? Object.values(host.network)[0].rx.length : 0 }, () => ""), // Match last 50 data points
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
                                    max: Math.max(...Object.values(host.network).map((i: { rx: number[] }) => Math.max(...i.rx))) + (Math.max(...Object.values(host.network).map((i: { rx: number[] }) => Math.max(...i.rx))) / 5),
                                },
                                grid: {
                                    top: 5, // Minimal padding
                                    right: 0,
                                    bottom: 2,
                                    left: 0,
                                },
                                series: [
                                    {
                                        data: Object.values(host.network).map((i: { rx: number[] }) => i.rx).reduce((a: number[], b: number[]) => a.concat(b), []),
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
                        {formatBytes(
                            Object.values(host.network)
                            .map(network => network.rx)
                            .reduce((a: number[], b: number[]) => a.concat(b), [])
                            .at(-1) || 0
                            
                        )} IN
                    </span>
                
                </div>
            </div>
    
            <!-- Storage -->
            <div class="flex flex-col gap-1.5 w-full">
                <span class="text-sm text-black/50">
                    Total Storage Usage
                </span>
                <div 
                    use:inViewAction={{ threshold: 0.2, trackExit: true }}
                    onenterView={()=>{
                        showCharts[5] = true
                    }}
                    onexitView={()=>{
                        showCharts[5] = false
                    }}
                    class="flex justify-center place-items-center relative w-full h-23 border bg-white border-gray-200 rounded-md">
    
                    {#if showCharts[5]}
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
                        {formatBytes(
                            host.storage.reduce((acc, storage) => acc + storage.used, 0) || 0
                        )}
                        /
                        {formatBytes(
                            host.storage.reduce((acc, storage) => acc + storage.size, 0) || 0
                        )}
                    </span>
                
                </div>
            </div>
            
        </div>
        
        <hr class="border-gray-200 w-full" />

        <div 
            use:inViewAction={{ threshold: 0.2, trackExit: true }}
            onenterView={()=>{
                showCharts[0] = true
            }}
            onexitView={()=>{
                showCharts[0] = false
            }}
            class="flex flex-col gap-4 w-full border bg-white border-gray-200 rounded-md p-4">
            
            <div class="h-40">
                {#if showCharts[0]}
                    <Chart
                        {init}
                        options={{
                            xAxis: {
                                show: true,
                                boundaryGap: false,
                                data: Array.from({ length: 150 }, () => ""), // Match last 50 data points
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
                            series: Array.from({ length: host.coreLoad.length }, (_, i) => {

                                if (!host) return {};

                                return {
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
                                }
                            }),
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

        {#if Object.keys(host.network).length > 0}
            <hr class="border-gray-200 w-full" />

            {#each Object.values(host.network) as network}
                <div>
                    {network.name}
                </div>
            {/each}

        {/if}

        {#if Object.keys(host.storage).length > 0}
            <hr class="border-gray-200 w-full" />

            {#each Object.values(host.storage) as storage}
                <div>
                    {storage.name}
                </div>
            {/each}
        {/if}
    </div>

{/if}