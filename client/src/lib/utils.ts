export function clampNumber(value: number, min: number, max: number): number {
    if (min > max) {
        throw new Error("Min cannot be greater than max");
    }
    
    return Math.min(Math.max(value, min), max);
}

export function getColour(pos: number): string {
    const colours = [
        "#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#A133FF",
        "#FF8C33", "#33FFF5", "#F5FF33", "#FF3333", "#33FF8C",
        "#8C33FF", "#F5A133", "#33F5FF", "#A1FF33", "#FF33F5",
    ];
    
    return colours[pos];
}