#!/usr/bin/env node
/**
 * Append-only refresh of data/deficit_fyfsd.csv from FRED series FYFSD.
 *
 * This job ONLY EVER INSERTS. It never updates a value in place and never
 * deletes a row. For each fiscal year, it appends a new row iff there is no
 * existing row whose latest value already equals the freshly fetched value.
 * A revised figure therefore lands as a NEW row with a later retrieved_at,
 * superseding the old one by recency while leaving the old one in place as the
 * audit trail. Git history is the as-of log.
 *
 * Network note: the FRED public CSV endpoint is keyless. If FRED is
 * unreachable (e.g. an egress policy blocks it), this job exits without
 * touching the file — the committed bootstrap stays authoritative until a run
 * from a network that can reach FRED supersedes it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(HERE, '..', 'data', 'deficit_fyfsd.csv');
const SERIES_ID = 'FYFSD';
const SERIES_PAGE = 'https://fred.stlouisfed.org/series/FYFSD';
const CSV_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=FYFSD';
const PUBLISHER = 'OMB (via FRED)';

// Column order MUST match data/deficit_fyfsd.csv exactly, since rows are read
// by header position: period,value_raw_musd,series_id,publisher,source_url,
// retrieved_at,retrieval_method,note
function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseExisting(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const iPeriod = header.indexOf('period');
  const iValue = header.indexOf('value_raw_musd');
  const iRetrieved = header.indexOf('retrieved_at');
  // latest value per period, by retrieved_at then file order
  const latest = new Map();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const c = line.split(',');
    const period = c[iPeriod];
    const value = Number(c[iValue]);
    const retrievedAt = c[iRetrieved] ?? '';
    const held = latest.get(period);
    if (!held || retrievedAt >= held.retrievedAt) latest.set(period, { value, retrievedAt });
  }
  return latest;
}

async function fetchFred() {
  const res = await fetch(CSV_URL, { headers: { accept: 'text/csv' } });
  if (!res.ok) throw new Error(`FRED responded ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  // first column is the observation date; the value column is the other one
  const iVal = header.findIndex((h, i) => i > 0);
  const out = [];
  for (const line of lines.slice(1)) {
    const c = line.split(',');
    const raw = c[iVal];
    if (raw === undefined || raw === '' || raw === '.') continue; // missing observation
    const year = Number(String(c[0]).slice(0, 4));
    if (!Number.isFinite(year)) continue;
    out.push({ period: `FY${year}`, value: Math.round(Number(raw)) });
  }
  return out;
}

async function main() {
  const existingText = readFileSync(CSV_PATH, 'utf8');
  const latest = parseExisting(existingText);

  let observations;
  try {
    observations = await fetchFred();
  } catch (err) {
    console.error(`refresh: FRED unreachable (${err.message}); leaving snapshot untouched.`);
    process.exit(0);
  }

  const stamp = today();
  const inserts = [];
  for (const obs of observations) {
    const held = latest.get(obs.period);
    if (held && held.value === obs.value) continue; // unchanged -> no insert
    // period,value_raw_musd,series_id,publisher,source_url,retrieved_at,retrieval_method,note
    inserts.push(
      `${obs.period},${obs.value},${SERIES_ID},${PUBLISHER},${SERIES_PAGE},${stamp},fred-csv,`,
    );
  }

  if (inserts.length === 0) {
    console.log('refresh: no new or revised figures; nothing appended.');
    return;
  }

  // Append only. Never rewrite an existing line. Normalize a trailing newline.
  const base = existingText.replace(/\s*$/, '');
  const next = `${base}\n${inserts.join('\n')}\n`;
  writeFileSync(CSV_PATH, next);
  console.log(`refresh: appended ${inserts.length} row(s):`);
  for (const row of inserts) console.log(`  + ${row}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
