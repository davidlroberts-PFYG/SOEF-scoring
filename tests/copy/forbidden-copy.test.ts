import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Compliance grep (spec Section 11):
 *   - "fee-only" must never appear in UI copy, seed data, or PDF templates.
 *     Plan For Your Goals, LLC may be described as a fiduciary, never fee-only.
 *   - The Securian / FINRA / SIPC disclosure from the paper worksheets does
 *     not apply and must not be reproduced anywhere.
 */
const ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['src', 'content', 'public'];
const EXTS = new Set(['.ts', '.tsx', '.json', '.css', '.md', '.txt', '.html', '.svg']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if ([...EXTS].some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => {
  try {
    return walk(join(ROOT, d));
  } catch {
    return [];
  }
});

/** Lines that merely state the rule ("never fee-only") are allowed; anything else is not. */
const RULE_CONTEXT = /never (be described as |described as |as )?["'“”]?fee[\s-]*only|not fee[\s-]*only|may not describe .* fee[\s-]*only|Disclosure may not describe/i;

describe('forbidden copy', () => {
  it('scans a meaningful set of files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('never says "fee-only" outside of the rule itself', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/fee[\s-]*only/i.test(line) && !RULE_CONTEXT.test(line)) {
          offenders.push(`${relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('never reproduces the Securian / FINRA / SIPC disclosure', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      if (/Securian|FINRA|SIPC|Registered Representative/i.test(text)) offenders.push(relative(ROOT, f));
    }
    expect(offenders).toEqual([]);
  });

  it('the seeded disclosure is the approved text', () => {
    const seed = JSON.parse(readFileSync(join(ROOT, 'content/seed/settings.json'), 'utf8')) as { disclosure: { text: string } };
    expect(seed.disclosure.text).toContain('not a business appraisal');
    expect(seed.disclosure.text).toContain('Plan For Your Goals, LLC is a State of Florida Registered Investment Adviser');
    expect(seed.disclosure.text).toContain('Secure On Every Front is a brand of Plan For Your Goals, LLC');
  });
});
