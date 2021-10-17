import assert from 'assert';
import { NGrammar, Rule } from './grammarNormalized';
import { extractScope } from './grammarNormalizer';
import { applyCaptureToBeginOrMatch, applyCaptureToEnd } from './processors/procMatchingRule';
import type { Line, LineOffsetAnchored, TokenizedLine, TokenizedLineResult, TokenizedText } from './types';

export function tokenizeLine(line: Line, rule: Rule): TokenizedLineResult {
    const text = line.text;
    const lineLen = line.text.length;
    const parsedText: TokenizedText[] = [];

    let ctx = buildContext({ ...line, offset: 0, anchor: -1 }, rule);

    // Note: the begin rule has already been matched and applied.
    // Does it need to end or go deeper?

    while (ctx.line.offset < lineLen) {
        // We are at an end
        let endMatch = ctx.rule.end?.(ctx.line);
        while (endMatch?.index === ctx.line.offset) {
            parsedText.push(...applyCaptureToEnd(ctx.rule, endMatch));
            ctx = findParentWithEnd(ctx);
            ctx.line.offset = endMatch.index + endMatch.match.length;
            endMatch = ctx.rule.end?.(ctx.line);
        }

        if (ctx.line.offset >= lineLen) break;

        const { line, rule } = ctx;
        const offset = line.offset;
        const match = rule.findNext?.(line);
        const limit = endMatch?.index ?? lineLen;
        const emitTil = match ? Math.min(match.match.index, limit) : limit;
        if (offset < emitTil) {
            const scope = extractScope(rule);
            parsedText.push({
                scope,
                text: text.slice(offset, emitTil),
                offset,
            });
            ctx.line.offset = emitTil;
        }
        if (!match || (endMatch && endMatch.index <= match.match.index)) {
            continue; // We are at an end, process it at the beginning of the loop.
        }
        // Process the beginning of the match
        parsedText.push(...applyCaptureToBeginOrMatch(match));
        line.anchor = match.match.index + match.match.match.length;
        line.offset = line.anchor;
        ctx = findNearestWithEnd(buildContext(line, match.rule));
    }

    return toParseLineResult(line, ctx.rule, parsedText);
}

export function tokenizeText(text: string, grammar: NGrammar): TokenizedLine[] {
    const lines = text.split(/(?<=\n)/);
    const rule = grammar.bind();
    const r: TokenizedLine[] = [];
    let tr = tokenizeLine({ text: lines[0], lineNumber: 0 }, rule);
    r.push(toParsedLine(tr));
    for (let i = 1; i < lines.length; ++i) {
        const line = { text: lines[i], lineNumber: i };
        tr = tr.parse(line);
        r.push(toParsedLine(tr));
    }
    return r;
}

function toParsedLine(pr: TokenizedLineResult): TokenizedLine {
    const { tokens: parsedText, line } = pr;
    return { tokens: parsedText, line };
}

function toParseLineResult(line: Line, rule: Rule, parsedText: TokenizedText[]): TokenizedLineResult {
    return {
        tokens: parsedText,
        line,
        parse: (line: Line) => tokenizeLine(line, rule),
    };
}

interface Context {
    line: LineOffsetAnchored;
    rule: Rule;
    parent?: Context;
}

function buildContext(line: LineOffsetAnchored, rule: Rule): Context {
    const rules = calcRuleStack(rule);
    const numRules = rules.length;
    const rootNum = numRules - 1;
    const rootRule = rules[rootNum];

    const rootContext: Context = {
        line,
        rule: rootRule,
    };

    let ctx = rootContext;
    for (let i = rootNum - 1; i >= 0; --i) {
        const rule = rules[i];
        const line = ctx.line;
        ctx = {
            line,
            rule,
            parent: ctx,
        };
        // Check while here.
    }

    return ctx;
}

function calcRuleStack(rule: Rule) {
    const rules: Rule[] = [];
    let r: Rule | undefined = rule;
    while (r) {
        rules.push(r);
        r = r.parent;
    }
    return rules;
}

function must<T>(t: T | undefined, msg = 'Must be defined'): T {
    assert(t !== undefined && t !== null, msg);
    return t;
}

function findParentWithEnd(ctx: Context): Context {
    return findNearestWithEnd(must(ctx.parent));
}

function findNearestWithEnd(ctx: Context): Context {
    while (!ctx.rule.end) {
        ctx = must(ctx.parent);
    }
    return ctx;
}
