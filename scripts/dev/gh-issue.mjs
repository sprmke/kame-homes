#!/usr/bin/env bun
/**
 * GitHub Issues CLI — sprmke/kame-homes is the backlog source of truth.
 *
 * Usage:
 *   bun scripts/dev/gh-issue.mjs view --github 32
 *   bun scripts/dev/gh-issue.mjs create --title "..." [--section 4] [--body B | --body-file PATH] [--parent N] [--priority p2]
 *   bun scripts/dev/gh-issue.mjs update --github 32 [--title T] [--body B | --body-file PATH]
 *   bun scripts/dev/gh-issue.mjs ship --github 32 [--notes "…"] [--reason completed|not_planned] [--no-close]
 *
 * ship: closes the issue (unless --no-close) and writes docs/archive/todos/shipped/{N}-{slug}.md
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { computeIssueMetadata } from './backlog-issue-sizing.mjs';

const DEFAULT_REPO = 'sprmke/kame-homes';
const SHIPPED_DIR = 'docs/archive/todos/shipped';

/** @param {string} title */
function itemSlug(title) {
  const bare = title.replace(/^\[[\d.]+\]\s*/, '').trim();
  return bare
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 56);
}

/** @param {number} issueNumber @param {string} title */
function shippedDocRelativePath(issueNumber, title) {
  return `${SHIPPED_DIR}/${issueNumber}-${itemSlug(title)}.md`;
}

/** @param {string} repo @param {number} issueNumber */
function githubIssueUrl(repo, issueNumber) {
  return `https://github.com/${repo}/issues/${issueNumber}`;
}

/** @param {string} repoRoot @param {string} relativePath */
function abs(repoRoot, relativePath) {
  return join(repoRoot, relativePath);
}

/** @param {string} body */
function cleanIssueBody(body) {
  let next = body;
  next = next.replace(/\n---\n(?:\*\*Spec:\*\*|_Spec file:|_Imported from)[\s\S]*$/i, '');
  next = next.replace(/\n\n(?:\*\*Spec:\*\*|_Spec file:|_Imported from)[\s\S]*$/i, '');
  next = next.replace(/\n(?:\*\*Spec:\*\*|_Spec file:|_Imported from)[\s\S]*$/i, '');
  next = next.replace(/---\r?\n(?:\*\*Spec:\*\*|_Spec file:|_Imported from)[\s\S]*$/i, '');
  next = next.replace(/---\s*$/i, '');
  next = next.replace(/\n\nSource: \[`docs\/todos\/epics\/[^`]+`\]\([^)]+\)\n?/g, '\n\n');
  next = next.replace(/\nSource: \[`docs\/todos\/epics\/[^`]+`\]\([^)]+\)\n?/g, '\n');
  next = next.replace(/\n?\s*See docs\/todos\/epics\/[^\s.]+\.?[^\n]*/gi, '');
  next = next.replace(/\n?\s*Source: docs\/todos\/epics\/[^\n]*/gi, '');
  return next.trimEnd();
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

const [command, ...rest] = process.argv.slice(2);
const dryRun = rest.includes('--dry-run');
const repo = getArg('-R') ?? getArg('--repo') ?? DEFAULT_REPO;

/** @param {string} flag */
function getArg(flag) {
  const i = rest.indexOf(flag);
  return i >= 0 ? rest[i + 1] : undefined;
}

/** @param {string[]} args */
function gh(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', cwd: repoRoot });
  if (r.error) throw r.error;
  return {
    ok: (r.status ?? 1) === 0,
    stdout: r.stdout.trim(),
    stderr: r.stderr.trim(),
  };
}

/** @returns {{ number: number, title: string, body: string, state: string, labels: { name: string }[], url: string, closedAt: string | null }} */
function fetchIssue(issueNumber) {
  const r = gh([
    'issue',
    'view',
    String(issueNumber),
    '-R',
    repo,
    '--json',
    'number,title,body,state,labels,url,closedAt',
  ]);
  if (!r.ok) {
    console.error(r.stderr);
    process.exit(1);
  }
  return JSON.parse(r.stdout);
}

/** @param {string} sectionId */
function nextBacklogId(sectionId) {
  const r = gh([
    'issue',
    'list',
    '-R',
    repo,
    '--state',
    'all',
    '--limit',
    '500',
    '--json',
    'title',
  ]);
  if (!r.ok) {
    console.error(r.stderr);
    process.exit(1);
  }
  const titles = JSON.parse(r.stdout).map((/** @type {{ title: string }} */ i) => i.title);
  const re = new RegExp(`^\\[${sectionId.replace('.', '\\.')}\\.(\\d+)\\]`);
  let max = 0;
  for (const t of titles) {
    const m = t.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${sectionId}.${max + 1}`;
}

/** @param {string} shippedRel repo-relative path */
function appendShippedReadmeRow(shippedRel, title, issueNumber) {
  const readmePath = abs(repoRoot, `${SHIPPED_DIR}/README.md`);
  const basename = shippedRel.split('/').pop() ?? shippedRel;
  let readme = readFileSync(readmePath, 'utf8');
  if (readme.includes(basename)) return;

  const shortTitle = title.replace(/^\[[\d.]+\]\s*/, '');
  const row = `| [\`${basename}\`](./${basename}) | [#${issueNumber}](${githubIssueUrl(repo, issueNumber)}) ${shortTitle} |`;
  const marker = '## Shipped from GitHub Issues';

  if (!readme.includes(marker)) {
    readme = `${readme.trimEnd()}\n\n${marker}\n\n| File | Issue |\n| ---- | ----- |\n${row}\n`;
  } else {
    readme = readme.replace(
      /(\| File \| Issue \|\n\| ---- \| ----- \|\n)/,
      `$1${row}\n`,
    );
  }
  writeFileSync(readmePath, readme);
}

function usage() {
  console.log(`GitHub backlog CLI (repo: ${DEFAULT_REPO})

Commands:
  view    --github N
  create  --title T [--section ID] [--body B | --body-file PATH] [--parent N] [--priority p0-p4] [--type feature|bug|…]
  update  --github N [--title T] [--body B | --body-file PATH]
  ship    --github N [--notes TEXT | --notes-file PATH] [--reason completed|not_planned] [--no-close]

Flags: -R owner/repo  --dry-run`);
  process.exit(command ? 1 : 0);
}

if (!command) usage();

if (command === 'view') {
  const github = getArg('--github') ?? getArg('--issue');
  if (!github) {
    console.error('view requires --github N');
    process.exit(1);
  }
  const issue = fetchIssue(github);
  console.log(JSON.stringify(issue, null, 2));
  process.exit(0);
}

if (command === 'create') {
  const rawTitle = getArg('--title');
  const sectionId = getArg('--section');
  const bodyFile = getArg('--body-file');
  const body = bodyFile ? readFileSync(bodyFile, 'utf8') : getArg('--body') ?? '';
  const parent = getArg('--parent');
  const priority = getArg('--priority') ?? 'p2';
  const type = getArg('--type') ?? 'feature';

  if (!rawTitle) {
    console.error('create requires --title');
    process.exit(1);
  }

  let ghTitle = rawTitle;
  if (sectionId && !/^\[\d+\.\d+\]/.test(rawTitle)) {
    const backlogId = nextBacklogId(sectionId);
    ghTitle = `[${backlogId}] ${rawTitle}`;
  }

  const meta = computeIssueMetadata({
    title: ghTitle,
    body,
    type,
    priority,
  });
  const labelArgs = [meta.priorityLabel, meta.typeLabel, ...meta.moduleLabels].flatMap(
    (l) => ['--label', l],
  );

  if (dryRun) {
    console.log(`Would create: ${ghTitle}`);
    console.log(`labels: ${labelArgs.filter((_, i) => i % 2 === 1).join(', ')}`);
    if (parent) console.log(`parent: #${parent}`);
    process.exit(0);
  }

  const args = ['issue', 'create', '-R', repo, '--title', ghTitle, '--body', body, ...labelArgs];
  if (parent) args.push('--parent', parent);

  const r = gh(args);
  if (!r.ok) {
    console.error(r.stderr);
    process.exit(1);
  }
  console.log(r.stdout);
  process.exit(0);
}

if (command === 'update') {
  const github = getArg('--github') ?? getArg('--issue');
  const title = getArg('--title');
  const bodyFile = getArg('--body-file');
  const body = bodyFile ? readFileSync(bodyFile, 'utf8') : getArg('--body');

  if (!github) {
    console.error('update requires --github N');
    process.exit(1);
  }
  if (!title && body === undefined) {
    console.error('update requires --title and/or --body');
    process.exit(1);
  }

  const args = ['issue', 'edit', String(github), '-R', repo];
  if (title) args.push('--title', title);
  if (body !== undefined) args.push('--body', body);

  if (dryRun) {
    console.log(`Would edit #${github}`);
    process.exit(0);
  }

  const r = gh(args);
  if (!r.ok) {
    console.error(r.stderr);
    process.exit(1);
  }
  console.log(`Updated #${github}`);
  process.exit(0);
}

if (command === 'ship') {
  const github = getArg('--github') ?? getArg('--issue');
  const notesFile = getArg('--notes-file');
  const notes = notesFile ? readFileSync(notesFile, 'utf8') : getArg('--notes') ?? '';
  const reason = getArg('--reason') ?? 'completed';
  const noClose = rest.includes('--no-close');

  if (!github) {
    console.error('ship requires --github N');
    process.exit(1);
  }

  const issue = fetchIssue(github);
  const cleanBody = cleanIssueBody(issue.body ?? '');
  const shippedRel = shippedDocRelativePath(issue.number, issue.title);
  const shippedAbs = abs(repoRoot, shippedRel);
  const shippedDate = new Date().toISOString().slice(0, 10);

  const labels = (issue.labels ?? []).map((/** @type {{ name: string }} */ l) => l.name).join(', ');
  const notesBlock = notes.trim()
    ? `\n## Shipped notes\n\n${notes.trim()}\n`
    : '';

  const content = `# ${issue.title}

| | |
|---|---|
| **GitHub** | [#${issue.number}](${issue.url}) |
| **Shipped** | ${shippedDate} |
| **Labels** | ${labels || '—'} |

## Description

${cleanBody || '_No description._'}
${notesBlock}`;

  if (dryRun) {
    console.log(`Would write ${shippedRel}`);
    if (!noClose && issue.state === 'OPEN') console.log(`Would close #${github} (${reason})`);
    process.exit(0);
  }

  if (existsSync(shippedAbs)) {
    console.error(`Shipped file already exists: ${shippedRel}`);
    process.exit(1);
  }

  writeFileSync(shippedAbs, content);
  appendShippedReadmeRow(shippedRel, issue.title, issue.number);
  console.log(`Wrote ${shippedRel}`);

  if (!noClose && issue.state === 'OPEN') {
    const r = gh(['issue', 'close', String(github), '-R', repo, '--reason', reason]);
    if (!r.ok) {
      console.error(r.stderr);
      process.exit(1);
    }
    console.log(`Closed #${github}`);
  }

  process.exit(0);
}

usage();
