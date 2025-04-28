export function clampNumber(value: number, min: number, max: number): number {
    if (min > max) {
        throw new Error("Min cannot be greater than max");
    }

    return Math.min(Math.max(value, min), max);
}

export function getColour(seed: number): string {
    // Use the golden ratio to distribute hues evenly
    const GOLDEN_RATIO = 0.618033988749895;
    const hue = (seed * GOLDEN_RATIO * 360) % 360; // Spread hues in [0, 360]

    // Fixed saturation & lightness for vibrant but readable colors
    const saturation = 80 + (seed % 15);  // Slight variation (80-95%)
    const lightness = 50 + (seed % 10);   // Slight variation (50-60%)

    // Convert HSL to HEX
    return hslToHex(hue, saturation, lightness);
}

// Helper: Convert HSL to HEX
function hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

export function bytesToGB(
    bytes: number,
    decimalPlaces: number = 2,
    useBinary: boolean = true
): number {
    const divisor = useBinary ? 1024 ** 3 : 1000 ** 3;
    const gbValue = bytes / divisor;
    return Number(gbValue.toFixed(decimalPlaces));
}

export function calculateClusterCpuUsage(servers: {
    cpuUsagePercent: number;
    cores: number;
}[]): number {
    if (!servers.length) return 0;

    let totalUsage = 0;
    let totalCores = 0;

    for (const server of servers) {
        totalUsage += server.cpuUsagePercent * server.cores;
        totalCores += server.cores;
    }

    return totalUsage / totalCores;
}

export function getLatestCoreLoad(coreLoad: number[][] | unknown, index: number): string {
    if (!Array.isArray(coreLoad)) return '0.00';
    const lastEntry = coreLoad[coreLoad.length - 1];
    if (!Array.isArray(lastEntry)) return '0.00';
    const value = lastEntry[index];
    return (typeof value === 'number' ? value : 0).toFixed(2);
}

export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // If the value is exactly a whole number in a higher unit, adjust it down (e.g., 1024 → 1 KB, not 0.001 MB)
    const formattedValue = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));

    return `${formattedValue} ${sizes[i]}`;
}