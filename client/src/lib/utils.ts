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