

export function hrTimeToSeconds([seconds, nanoseconds]: number[]) {
    return seconds + nanoseconds / 1000000000;
}

export function uniqueFilter<T>(historySize: number): (i: T) => boolean {
    const f0 = new Set<T>();
    const f1 = new Set<T>();
    const found = [f0, f1, f0];
    let g = 0;
    return (w: T) => {
        const p = found[g];
        if (p.has(w)) return false;
        const s = found[g + 1];
        const r = !s.has(w);
        p.add(w);
        if (p.size >= historySize) {
            s.clear();
            g = (g + 1) % 2;
        }
        return r;
    };
}

export function *batch<T>(i: Iterable<T>, size: number): Iterable<T[]> {
    let data: T[] = [];
    for (const t of i) {
        data.push(t);
        if (data.length === size) {
            yield data;
            data = [];
        }
    }

    if (data.length) {
        yield data;
    }
}
