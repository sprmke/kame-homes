#!/usr/bin/env node
/**
 * Patch workflow doc frontmatter (stage + status + updated).
 * Usage: node scripts/docs/patch-workflow-status.mjs <file> <stage> <status>
 */
import fs from 'node:fs';

const [file, stage, status] = process.argv.slice(2);
if (!file || !stage || !status) {
  console.error('Usage: patch-workflow-status.mjs <file> <stage> <status>');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
let content = fs.readFileSync(file, 'utf8');

function upsertFrontmatter(fm, key, val) {
  const re = new RegExp(`^${key}: .*$`, 'm');
  if (re.test(fm)) return fm.replace(re, `${key}: ${val}`);
  const insert = fm.endsWith('\n') ? fm : `${fm}\n`;
  return insert.replace(/^---\n/, `---\n${key}: ${val}\n`);
}

if (!content.startsWith('---')) {
  content = `---\ntitle: '${file.split('/').pop()?.replace('.md', '')}'\nstage: ${stage}\nstatus: ${status}\nupdated: ${today}\n---\n\n${content}`;
} else {
  const end = content.indexOf('\n---', 4);
  if (end === -1) {
    console.error(`No closing --- in frontmatter: ${file}`);
    process.exit(1);
  }
  let fm = content.slice(0, end + 4);
  const body = content.slice(end + 4).replace(/^\n+/, '');
  fm = upsertFrontmatter(fm, 'stage', stage);
  fm = upsertFrontmatter(fm, 'status', status);
  fm = upsertFrontmatter(fm, 'updated', today);
  content = `${fm}\n\n${body}`;
}

fs.writeFileSync(file, content);
console.log(`patched ${file} → stage=${stage} status=${status}`);
