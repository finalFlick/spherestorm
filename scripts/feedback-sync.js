/**
 * Playtest Feedback Sync Script
 * 
 * Reads unprocessed rows from Google Sheets, aggregates stats,
 * posts a daily comment to the version thread, and marks rows as processed.
 * 
 * Environment variables required:
 *   GSHEET_ID - Google Sheet ID (from URL)
 *   GSHEET_CREDS_JSON - Service account credentials JSON
 *   GITHUB_TOKEN - GitHub token with issues:write permission
 * 
 * Usage: node scripts/feedback-sync.js
 */

import { google } from 'googleapis';
import { Octokit } from '@octokit/rest';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// Configuration
// ============================================================================

const SHEET_RANGE = 'Sheet1!A:N'; // Timestamp through Processed columns
const PLAYTEST_LABEL = 'playtest';

// Column indices (0-based, after header row)
const COL = {
  TIMESTAMP: 0,
  VERSION: 1,
  ARENA: 2,
  WAVE: 3,
  SCORE: 4,
  TIME: 5,
  Q1: 6,        // Fun (1-5)
  Q2: 7,        // Controls
  Q3: 8,        // Clarity
  Q4: 9,        // Difficulty
  Q5: 10,       // Play Again
  OPEN_FEEDBACK: 11,
  TESTER_NAME: 12,
  PROCESSED: 13
};

// ============================================================================
// Environment validation
// ============================================================================

const { GSHEET_ID, GSHEET_CREDS_JSON, GITHUB_TOKEN } = process.env;

if (!GSHEET_ID || !GSHEET_CREDS_JSON || !GITHUB_TOKEN) {
  console.error('Missing required environment variables:');
  if (!GSHEET_ID) console.error('  - GSHEET_ID');
  if (!GSHEET_CREDS_JSON) console.error('  - GSHEET_CREDS_JSON');
  if (!GITHUB_TOKEN) console.error('  - GITHUB_TOKEN');
  process.exit(1);
}

// Parse repo from GITHUB_REPOSITORY env var (set by Actions)
const [REPO_OWNER, REPO_NAME] = (process.env.GITHUB_REPOSITORY || '').split('/');
if (!REPO_OWNER || !REPO_NAME) {
  console.error('GITHUB_REPOSITORY not set (expected format: owner/repo)');
  process.exit(1);
}

// ============================================================================
// Google Sheets client
// ============================================================================

const creds = JSON.parse(GSHEET_CREDS_JSON);
const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

// ============================================================================
// GitHub client
// ============================================================================

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// ============================================================================
// Main sync logic
// ============================================================================

async function main() {
  console.log('Starting playtest feedback sync...');
  
  // 1. Fetch all rows from sheet
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: GSHEET_ID,
    range: SHEET_RANGE
  });
  
  const allRows = response.data.values || [];
  if (allRows.length < 2) {
    console.log('No data in sheet (only header or empty)');
    process.exit(0);
  }
  
  const [header, ...dataRows] = allRows;
  console.log(`Found ${dataRows.length} total rows`);
  
  // 2. Filter to unprocessed rows
  const unprocessedRows = [];
  const unprocessedIndices = []; // Sheet row indices (1-based, +1 for header)
  
  dataRows.forEach((row, idx) => {
    const processed = row[COL.PROCESSED];
    if (!processed || processed.trim() === '') {
      unprocessedRows.push(row);
      unprocessedIndices.push(idx + 2); // +2 for 1-based + header row
    }
  });
  
  if (unprocessedRows.length === 0) {
    console.log('No new feedback to process');
    process.exit(0);
  }
  
  console.log(`Found ${unprocessedRows.length} unprocessed rows`);
  
  // 3. Determine version thread key
  const versions = [...new Set(unprocessedRows.map(r => r[COL.VERSION] || 'unknown'))];
  const primaryVersion = versions[0];
  const threadKey = getThreadKey(primaryVersion);
  const threadTitle = `[Playtest] Feedback Thread - ${threadKey}`;
  
  console.log(`Thread key: ${threadKey}`);
  console.log(`Versions in batch: ${versions.join(', ')}`);
  
  // 4. Check if we already posted today (idempotency)
  const today = new Date().toISOString().split('T')[0];
  const thread = await findOrCreateThread(threadTitle);
  
  if (await alreadyPostedToday(thread.number, today)) {
    console.log('Already posted today, skipping');
    process.exit(0);
  }
  
  // 5. Aggregate stats
  const stats = aggregateStats(unprocessedRows);
  
  // 6. Write raw data doc
  const docPath = `docs/playtests/${today}.md`;
  writeRawDoc(docPath, today, unprocessedRows, stats);
  console.log(`Wrote ${docPath}`);
  
  // 7. Post comment to thread
  const comment = formatComment(today, stats, unprocessedRows);
  await octokit.issues.createComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: thread.number,
    body: comment
  });
  console.log(`Posted comment to issue #${thread.number}`);
  
  // 8. Mark rows as processed
  await markRowsProcessed(unprocessedIndices, today);
  console.log(`Marked ${unprocessedIndices.length} rows as processed`);
  
  console.log('Sync complete!');
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Convert version string to thread key (e.g., "0.2.3" -> "v0.2.x")
 */
function getThreadKey(version) {
  if (!version) return 'v0.0.x';
  const parts = version.replace(/^v/, '').split('.');
  if (parts.length >= 2) {
    return `v${parts[0]}.${parts[1]}.x`;
  }
  return `v${parts[0]}.x`;
}

/**
 * Find existing thread issue or create a new one
 */
async function findOrCreateThread(title) {
  // Search for existing open issue with this title
  const { data: issues } = await octokit.issues.listForRepo({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    state: 'open',
    labels: PLAYTEST_LABEL,
    per_page: 100
  });
  
  const existing = issues.find(i => i.title === title);
  if (existing) {
    console.log(`Found existing thread: #${existing.number}`);
    return existing;
  }
  
  // Create new thread
  console.log(`Creating new thread: ${title}`);
  const { data: newIssue } = await octokit.issues.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title,
    body: `# ${title}\n\nFeedback for this version series.\n\n**Daily summaries appear as comments below.**`,
    labels: [PLAYTEST_LABEL]
  });
  
  return newIssue;
}

/**
 * Check if we already posted a comment today
 */
async function alreadyPostedToday(issueNumber, today) {
  const { data: comments } = await octokit.issues.listComments({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: issueNumber,
    per_page: 50
  });
  
  // Authorship can vary (github-actions bot token vs GitHub App token). Use content-based idempotency.
  const dateHeading = `## ${today}`;
  const rawLink = `[Raw data](docs/playtests/${today}.md)`;
  return comments.some((c) => c.body?.includes(dateHeading) && c.body?.includes(rawLink));
}

/**
 * Aggregate stats from rows
 */
function aggregateStats(rows) {
  const stats = {
    count: rows.length,
    versions: {},
    q1: { sum: 0, count: 0, dist: {} },  // Fun (1-5)
    q2: {},  // Controls
    q3: {},  // Clarity
    q4: {},  // Difficulty
    q5: {},  // Play Again
    quotes: []
  };
  
  for (const row of rows) {
    // Version distribution
    const ver = row[COL.VERSION] || 'unknown';
    stats.versions[ver] = (stats.versions[ver] || 0) + 1;
    
    // Q1: Fun (numeric 1-5)
    const q1 = parseInt(row[COL.Q1], 10);
    if (!isNaN(q1) && q1 >= 1 && q1 <= 5) {
      stats.q1.sum += q1;
      stats.q1.count++;
      stats.q1.dist[q1] = (stats.q1.dist[q1] || 0) + 1;
    }
    
    // Q2-Q5: Categorical
    const q2 = row[COL.Q2]?.trim();
    const q3 = row[COL.Q3]?.trim();
    const q4 = row[COL.Q4]?.trim();
    const q5 = row[COL.Q5]?.trim();
    
    if (q2) stats.q2[q2] = (stats.q2[q2] || 0) + 1;
    if (q3) stats.q3[q3] = (stats.q3[q3] || 0) + 1;
    if (q4) stats.q4[q4] = (stats.q4[q4] || 0) + 1;
    if (q5) stats.q5[q5] = (stats.q5[q5] || 0) + 1;
    
    // Collect quotes
    const feedback = row[COL.OPEN_FEEDBACK]?.trim();
    const tester = row[COL.TESTER_NAME]?.trim() || 'Anonymous';
    if (feedback && feedback.length > 0) {
      stats.quotes.push({ text: feedback, tester });
    }
  }
  
  // Calculate average for Q1
  if (stats.q1.count > 0) {
    stats.q1.avg = (stats.q1.sum / stats.q1.count).toFixed(1);
  }
  
  return stats;
}

/**
 * Format distribution object as string (e.g., "Great:2, Okay:1")
 */
function formatDist(dist) {
  return Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
}

/**
 * Format the daily comment for GitHub
 */
function formatComment(today, stats, rows) {
  const versionStr = Object.entries(stats.versions)
    .map(([v, c]) => `${v} (${c})`)
    .join(', ');
  
  let md = `## ${today} (${stats.count} response${stats.count !== 1 ? 's' : ''})\n\n`;
  md += `**Versions:** ${versionStr}\n\n`;
  
  // Results table
  md += `| Question | Results |\n`;
  md += `|----------|--------|\n`;
  
  // Q1: Fun with average
  const q1Dist = Object.entries(stats.q1.dist)
    .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
    .map(([k, v]) => `${k}★:${v}`)
    .join(', ');
  md += `| Fun (avg ${stats.q1.avg || 'N/A'}) | ${q1Dist || 'N/A'} |\n`;
  
  // Q2-Q5
  md += `| Controls | ${formatDist(stats.q2) || 'N/A'} |\n`;
  md += `| Clarity | ${formatDist(stats.q3) || 'N/A'} |\n`;
  md += `| Difficulty | ${formatDist(stats.q4) || 'N/A'} |\n`;
  md += `| Play Again | ${formatDist(stats.q5) || 'N/A'} |\n`;
  
  // Quotes (max 5)
  if (stats.quotes.length > 0) {
    md += `\n**Quotes:**\n`;
    const displayQuotes = stats.quotes.slice(0, 5);
    for (const q of displayQuotes) {
      const truncated = q.text.length > 200 ? q.text.substring(0, 200) + '...' : q.text;
      md += `> "${truncated}" — ${q.tester}\n`;
    }
    if (stats.quotes.length > 5) {
      md += `\n*...and ${stats.quotes.length - 5} more*\n`;
    }
  }
  
  md += `\n[Raw data](docs/playtests/${today}.md)`;
  
  return md;
}

/**
 * Write raw data markdown file
 */
function writeRawDoc(filePath, today, rows, stats) {
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  let md = `# Playtest Feedback - ${today}\n\n`;
  md += `**Total Responses:** ${rows.length}\n\n`;
  
  // Version summary
  const versionStr = Object.entries(stats.versions)
    .map(([v, c]) => `${v} (${c})`)
    .join(', ');
  md += `**Versions:** ${versionStr}\n\n`;
  
  md += `---\n\n`;
  
  // Individual responses
  md += `## Individual Responses\n\n`;
  
  rows.forEach((row, idx) => {
    md += `### Response ${idx + 1}\n\n`;
    md += `- **Timestamp:** ${row[COL.TIMESTAMP] || 'N/A'}\n`;
    md += `- **Version:** ${row[COL.VERSION] || 'N/A'}\n`;
    md += `- **Tester:** ${row[COL.TESTER_NAME] || 'Anonymous'}\n`;
    md += `- **Stats:** Arena ${row[COL.ARENA] || '?'}, Wave ${row[COL.WAVE] || '?'}, Score ${row[COL.SCORE] || '?'}, Time ${row[COL.TIME] || '?'}\n`;
    md += `- **Fun:** ${row[COL.Q1] || 'N/A'}/5\n`;
    md += `- **Controls:** ${row[COL.Q2] || 'N/A'}\n`;
    md += `- **Clarity:** ${row[COL.Q3] || 'N/A'}\n`;
    md += `- **Difficulty:** ${row[COL.Q4] || 'N/A'}\n`;
    md += `- **Play Again:** ${row[COL.Q5] || 'N/A'}\n`;
    
    const feedback = row[COL.OPEN_FEEDBACK]?.trim();
    if (feedback) {
      md += `- **Feedback:** "${feedback}"\n`;
    }
    
    md += `\n`;
  });
  
  fs.writeFileSync(filePath, md);
}

/**
 * Mark rows as processed in the sheet
 */
async function markRowsProcessed(rowIndices, today) {
  // Build batch update data
  const data = rowIndices.map(rowIdx => ({
    range: `Sheet1!N${rowIdx}`,  // Column N = Processed
    values: [[today]]
  }));
  
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: GSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data
    }
  });
}

// ============================================================================
// Run
// ============================================================================

main().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
