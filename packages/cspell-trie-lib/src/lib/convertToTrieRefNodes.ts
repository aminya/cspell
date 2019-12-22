import { TrieNode, FLAG_WORD } from './TrieNode';
import { TrieRefNode } from './trieRef';

/**
 * An iterator that will emit TrieRefNodes mostly in descending frequency
 * @param root Root of the Trie -- a DAWG is preferred to keep the number of duplicates down.
 */
export function convertToTrieRefNodes(root: TrieNode): IterableIterator<TrieRefNode> {
    const eow = { f: FLAG_WORD, c: undefined };
    const tallies = new Map<TrieNode, number>([[eow, 0]]);
    let count = 0;
    const cached = new Map<TrieNode, number>();
    const rollupTally = new Map<TrieNode, number>();

    function tally(n: TrieNode) {
        if (n.f && !n.c) {
            tallies.set(eow, (tallies.get(eow) || 0) + 1);
            return;
        }
        const t = tallies.get(n);
        if (t) {
            tallies.set(n, t + 1);
            return;
        }
        tallies.set(n, 1);
        for (const c of n.c?.values() || []) {
            tally(c);
        }
    }

    function rollup(n: TrieNode): number {
        const c = rollupTally.get(n);
        if (c) {
            return c;
        }
        if (!n.c) {
            const sum = tallies.get(eow)!;
            rollupTally.set(n, sum);
            return sum;
        }
        const sum = [...(n.c.values())]
            .reduce((acc, v) => acc + rollup(v), tallies.get(n)!);
        rollupTally.set(n, sum);
        return sum;
    }

    function *walkByRollup(n: TrieNode): IterableIterator<TrieRefNode> {
        if (cached.has(n)) return;
        if (n.f && !n.c) {
            cached.set(n, cached.get(eow)!);
            return;
        }

        const children = [...(n.c?.values() || [])].sort((a, b) => rollupTally.get(b)! - rollupTally.get(a)!);

        for (const c of children) {
            yield *walkByRollup(c);
        }

        cached.set(n, count++);
        yield convert(n);
    }

    function convert(n: TrieNode): TrieRefNode {
        const { f, c } = n;
        const r = c ? [...c].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([s, n]) => [s, cached.get(n)] as [string, number]) : undefined;
        const rn: TrieRefNode = r ? f ? { f, r } : { r } : { f };
        return rn;
    }

    function *walk(n: TrieNode): IterableIterator<TrieRefNode> {
        cached.set(eow, count++);
        yield convert(eow);
        yield *walkByRollup(n);
    }

    tally(root);
    rollup(root);

    return walk(root);
}
