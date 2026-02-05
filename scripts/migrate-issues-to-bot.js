/**
 * Migrate GitHub Issues to a GitHub App bot author (manta-warden).
 *
 * What it does:
 * - Fetches issues via `gh issue list`
 * - Filters to issues authored by `finalFlick`
 * - Skips issue #19 (already a bot-authored thread)
 * - Recreates them using a GitHub App installation token (via scripts/gh-app-auth.js)
 * - Preserves: title, body, labels, milestone, open/closed state
 *
 * What it does NOT do:
 * - It does not modify / comment on / close the original issues.
 *
 * Usage:
 *   node scripts/migrate-issues-to-bot.js --repo owner/name --config .secrets/github-app.json
 *
 * Optional:
 *   --dry-run              Print what would happen without creating anything
 *   --author finalFlick    Which author login to migrate (default: finalFlick)
 *   --comments-only        Only migrate comments using the existing mapping file
 *   --verify               Verify old↔new parity (fields + comment counts)
 *   --clean-attribution    Remove "Originally posted by" headers from migrated comments
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Octokit } from '@octokit/rest';

function parseArgs(argv) {
  const args = {
    repo: null,
    config: '.secrets/github-app.json',
    dryRun: false,
    author: 'finalFlick',
    commentsOnly: false,
    verify: false,
    cleanAttribution: false
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') args.repo = argv[++i];
    else if (a === '--config') args.config = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--author') args.author = argv[++i];
    else if (a === '--comments-only') args.commentsOnly = true;
    else if (a === '--verify') args.verify = true;
    else if (a === '--clean-attribution') args.cleanAttribution = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }

  return args;
}

function execFileAsync(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { ...opts, windowsHide: true, maxBuffer: 50 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = [
            `Command failed: ${cmd} ${args.join(' ')}`,
            `exit code: ${err.code ?? 'unknown'}`,
            stderr?.trim() ? `stderr:\n${stderr.trim()}` : null
          ]
            .filter(Boolean)
            .join('\n\n');
          return reject(new Error(msg));
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

async function getInstallationToken({ repo, config }) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['scripts/gh-app-auth.js', '--repo', repo, '--config', config, '--raw'],
    { cwd: process.cwd() }
  );
  const token = String(stdout || '').trim();
  if (!token) throw new Error('Failed to obtain installation token (empty output).');
  return token;
}

async function fetchIssues({ repo }) {
  const { stdout } = await execFileAsync(
    'gh',
    [
      'issue',
      'list',
      '--repo',
      repo,
      '--state',
      'all',
      '--limit',
      '500',
      '--json',
      'number,title,state,labels,author,body,milestone'
    ],
    { cwd: process.cwd() }
  );

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (e) {
    throw new Error(`Failed to parse gh JSON output (first 2000 chars):\n${stdout.slice(0, 2000)}`);
  }
  if (!Array.isArray(parsed)) throw new Error('Unexpected gh output (expected JSON array).');
  return parsed;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function normalizeBody(body) {
  return String(body ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function toLabelSet(labels) {
  // GitHub API returns labels as strings OR objects depending on endpoint.
  return new Set((labels || []).map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean));
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function getSecretsDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const secretsDir = path.resolve(__dirname, '..', '.secrets');
  ensureDir(secretsDir);
  return secretsDir;
}

function loadMappingOrThrow() {
  const secretsDir = getSecretsDir();
  const mapPath = path.join(secretsDir, 'issue-migration-map.json');
  if (!fs.existsSync(mapPath)) {
    throw new Error(`Mapping file not found: ${mapPath}\nRun the issue migration first to generate it.`);
  }
  const parsed = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  if (!Array.isArray(parsed?.mapping)) throw new Error('Invalid mapping file: missing "mapping" array.');
  return { mapPath, mapping: parsed.mapping, secretsDir };
}

async function listAllComments(octokit, { owner, repo, issueNumber }) {
  const out = [];
  let page = 1;
  while (true) {
    const { data } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
      page
    });
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return out;
}

function buildMigratedCommentBody({ oldIssueNumber, oldComment }) {
  const originalAuthor = oldComment?.user?.login || 'unknown';
  const originalDate = oldComment?.created_at || 'unknown-date';
  const originalUrl = oldComment?.html_url || 'unknown-url';
  const originalBody = String(oldComment?.body ?? '');
  const marker = `<!-- migrated-from:issue#${oldIssueNumber} comment:${oldComment?.id} -->`;

  return [
    marker,
    `> *Originally posted by @${originalAuthor} on ${originalDate}*`,
    `> Source: ${originalUrl}`,
    ``,
    originalBody
  ].join('\n');
}

async function migrateCommentsOnly({ octokit, owner, repo, mapping, secretsDir }) {
  const log = {
    repo: `${owner}/${repo}`,
    migratedAt: new Date().toISOString(),
    pairs: []
  };

  for (const pair of mapping) {
    const oldNum = pair?.old?.number;
    const newNum = pair?.new?.number;
    if (!oldNum || !newNum) continue;
    if (oldNum === 19) continue;

    const oldComments = await listAllComments(octokit, { owner, repo, issueNumber: oldNum });
    if (oldComments.length === 0) continue;

    const newComments = await listAllComments(octokit, { owner, repo, issueNumber: newNum });
    const existingBodies = newComments.map((c) => String(c?.body ?? ''));

    const pairLog = { old: oldNum, new: newNum, migrated: 0, skipped: 0, total: oldComments.length };

    for (const c of oldComments) {
      const marker = `<!-- migrated-from:issue#${oldNum} comment:${c?.id} -->`;
      const already = existingBodies.some((b) => b.includes(marker));
      if (already) {
        pairLog.skipped++;
        continue;
      }

      const body = buildMigratedCommentBody({ oldIssueNumber: oldNum, oldComment: c });
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: newNum,
        body
      });
      pairLog.migrated++;
    }

    log.pairs.push(pairLog);
  }

  const commentLogPath = path.join(secretsDir, 'issue-comment-migration-log.json');
  fs.writeFileSync(commentLogPath, JSON.stringify(log, null, 2));
  console.log(`Wrote comment migration log: ${commentLogPath}`);
}

async function verifyMigration({ octokit, owner, repo, mapping }) {
  const failures = [];

  for (const pair of mapping) {
    const oldNum = pair?.old?.number;
    const newNum = pair?.new?.number;
    if (!oldNum || !newNum) continue;
    if (oldNum === 19) continue;

    const [{ data: oldIssue }, { data: newIssue }] = await Promise.all([
      octokit.issues.get({ owner, repo, issue_number: oldNum }),
      octokit.issues.get({ owner, repo, issue_number: newNum })
    ]);

    if (String(oldIssue?.title ?? '') !== String(newIssue?.title ?? '')) {
      failures.push({ old: oldNum, new: newNum, field: 'title' });
    }

    if (normalizeBody(oldIssue?.body) !== normalizeBody(newIssue?.body)) {
      failures.push({ old: oldNum, new: newNum, field: 'body' });
    }

    const oldState = String(oldIssue?.state ?? '').toUpperCase();
    const newState = String(newIssue?.state ?? '').toUpperCase();
    if (oldState !== newState) failures.push({ old: oldNum, new: newNum, field: 'state' });

    const oldMilestone = oldIssue?.milestone?.number ?? null;
    const newMilestone = newIssue?.milestone?.number ?? null;
    if ((oldMilestone ?? null) !== (newMilestone ?? null)) {
      failures.push({ old: oldNum, new: newNum, field: 'milestone' });
    }

    const oldLabels = toLabelSet(oldIssue?.labels);
    const newLabels = toLabelSet(newIssue?.labels);
    if (!setsEqual(oldLabels, newLabels)) failures.push({ old: oldNum, new: newNum, field: 'labels' });

    const oldComments = await listAllComments(octokit, { owner, repo, issueNumber: oldNum });
    const newComments = await listAllComments(octokit, { owner, repo, issueNumber: newNum });
    const migratedCount = newComments.filter((c) =>
      String(c?.body ?? '').includes(`<!-- migrated-from:issue#${oldNum} comment:`)
    ).length;
    if (migratedCount !== oldComments.length) {
      failures.push({
        old: oldNum,
        new: newNum,
        field: 'comments',
        expected: oldComments.length,
        got: migratedCount
      });
    }
  }

  return failures;
}

async function cleanAttribution({ octokit, owner, repo, mapping }) {
  let cleanedCount = 0;

  for (const pair of mapping) {
    const newNum = pair?.new?.number;
    if (!newNum) continue;

    const comments = await listAllComments(octokit, { owner, repo, issueNumber: newNum });
    
    for (const comment of comments) {
      const body = String(comment?.body ?? '');
      
      // Only process comments with migration markers
      if (!body.includes('<!-- migrated-from:issue#')) continue;
      
      // Pattern: remove the attribution block
      // Example:
      // <!-- migrated-from:issue#3 comment:3842112060 -->
      // > *Originally posted by @finalFlick on 2026-02-03T15:48:18Z*
      // > Source: https://github.com/finalFlick/mantasphere/issues/3#issuecomment-...
      //
      // (followed by blank line and then actual content)
      const cleanBody = body.replace(
        /^(<!-- migrated-from:issue#\d+ comment:\d+ -->\n)> \*Originally posted by @.+ on .+\*\n> Source: https:\/\/github\.com\/.+\n\n/,
        '$1\n'
      );
      
      // Only update if something changed
      if (cleanBody !== body) {
        console.log(`Cleaning comment on issue #${newNum} (comment ID: ${comment.id})`);
        await octokit.issues.updateComment({
          owner,
          repo,
          comment_id: comment.id,
          body: cleanBody
        });
        cleanedCount++;
      }
    }
  }

  return cleanedCount;
}

function formatIssueForCreate(issue) {
  const labels = Array.isArray(issue.labels) ? issue.labels.map((l) => l?.name).filter(Boolean) : [];
  const milestoneNumber = issue.milestone?.number ?? null;

  const createParams = {
    title: issue.title,
    body: issue.body ?? '',
    labels
  };

  if (milestoneNumber != null) createParams.milestone = milestoneNumber;

  return { createParams, desiredState: issue.state };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.repo) {
    console.log(`Usage:
  node scripts/migrate-issues-to-bot.js --repo owner/name [--config .secrets/github-app.json] [--dry-run] [--author finalFlick] [--comments-only] [--verify] [--clean-attribution]

Recreates issues as a GitHub App bot using an installation token.
Leaves original issues untouched.

Options:
  --comments-only      Only migrate comments using the existing mapping file
  --verify             Verify old↔new parity (fields + comment counts)
  --clean-attribution  Remove "Originally posted by" headers from migrated comments
`);
    process.exit(args.help ? 0 : 1);
  }

  const [owner, repoName] = args.repo.split('/');
  if (!owner || !repoName) throw new Error(`Invalid --repo. Expected "owner/name", got "${args.repo}"`);

  if (args.commentsOnly || args.verify || args.cleanAttribution) {
    const token = await getInstallationToken({ repo: args.repo, config: args.config });
    const octokit = new Octokit({ auth: token });
    const { mapping, secretsDir, mapPath } = loadMappingOrThrow();

    if (args.commentsOnly) {
      console.log(`Migrating comments using mapping: ${mapPath}`);
      await migrateCommentsOnly({ octokit, owner, repo: repoName, mapping, secretsDir });
      console.log('Comment migration complete.');
    }

    if (args.verify) {
      console.log('Verifying migration parity (fields + comment counts)...');
      const failures = await verifyMigration({ octokit, owner, repo: repoName, mapping });
      if (failures.length === 0) {
        console.log('✅ Verification passed: all mapped issues match (including comment counts).');
      } else {
        console.log(`❌ Verification failed (${failures.length} mismatch(es))`);
        for (const f of failures) {
          console.log(
            `- old #${f.old} -> new #${f.new}: ${f.field}${
              f.expected != null ? ` (expected ${f.expected}, got ${f.got})` : ''
            }`
          );
        }
        process.exitCode = 2;
      }
    }

    if (args.cleanAttribution) {
      console.log('Cleaning attribution headers from migrated comments...');
      const cleanedCount = await cleanAttribution({ octokit, owner, repo: repoName, mapping });
      console.log(`✅ Cleaned ${cleanedCount} comment(s).`);
    }

    return;
  }

  const allIssues = await fetchIssues({ repo: args.repo });
  const toMigrate = allIssues.filter((i) => {
    const login = i?.author?.login;
    const num = i?.number;
    return login === args.author && num !== 19;
  });

  if (toMigrate.length === 0) {
    console.log(`No issues found authored by "${args.author}" to migrate (excluding #19).`);
    return;
  }

  console.log(`Found ${toMigrate.length} issue(s) to migrate (author=${args.author}, repo=${args.repo}).`);

  if (args.dryRun) {
    console.log('\n--dry-run enabled. Would create:');
    for (const i of toMigrate) {
      console.log(`- #${i.number} [${i.state}] ${i.title}`);
    }
    return;
  }

  const token = await getInstallationToken({ repo: args.repo, config: args.config });
  const octokit = new Octokit({ auth: token });

  const mapping = [];

  for (const oldIssue of toMigrate) {
    const { createParams, desiredState } = formatIssueForCreate(oldIssue);

    process.stdout.write(`Creating: #${oldIssue.number} -> `);
    const { data: created } = await octokit.issues.create({
      owner,
      repo: repoName,
      ...createParams
    });

    const newNumber = created?.number;
    process.stdout.write(`#${newNumber}\n`);

    // Preserve closed state
    if (desiredState && String(desiredState).toUpperCase() === 'CLOSED') {
      await octokit.issues.update({
        owner,
        repo: repoName,
        issue_number: newNumber,
        state: 'closed'
      });
    }

    mapping.push({
      old: { number: oldIssue.number, title: oldIssue.title, state: oldIssue.state },
      new: { number: newNumber, url: created?.html_url }
    });
  }

  // Write a local mapping file (gitignored location) for manual reference.
  const secretsDir = getSecretsDir();
  const mapPath = path.join(secretsDir, 'issue-migration-map.json');
  fs.writeFileSync(mapPath, JSON.stringify({ repo: args.repo, migratedAt: new Date().toISOString(), mapping }, null, 2));

  console.log(`\nDone. Wrote mapping: ${mapPath}`);
  console.log('New issues:');
  for (const m of mapping) {
    console.log(`- #${m.new.number}: ${m.new.url}`);
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

