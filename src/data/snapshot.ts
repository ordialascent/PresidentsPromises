import csvRaw from '../../data/deficit_fyfsd.csv?raw';

/**
 * A single append-only snapshot row, exactly as committed. Provenance travels
 * with the row, never with the file.
 */
export interface SnapshotRow {
  period: string;
  fy: number;
  valueRawMusd: number;
  seriesId: string;
  publisher: string;
  sourceUrl: string;
  retrievedAt: string;
  retrievalMethod: string;
  note: string;
}

function parse(csv: string): SnapshotRow[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0]!.split(',');
  const idx = (name: string) => header.indexOf(name);
  const iPeriod = idx('period');
  const iValue = idx('value_raw_musd');
  const iSeries = idx('series_id');
  const iPublisher = idx('publisher');
  const iUrl = idx('source_url');
  const iRetrieved = idx('retrieved_at');
  const iMethod = idx('retrieval_method');
  const iNote = idx('note');

  return lines.slice(1).map((line) => {
    const c = line.split(',');
    const period = c[iPeriod]!;
    return {
      period,
      fy: Number(period.replace(/[^0-9]/g, '')),
      valueRawMusd: Number(c[iValue]),
      seriesId: c[iSeries] ?? '',
      publisher: c[iPublisher] ?? '',
      sourceUrl: c[iUrl] ?? '',
      retrievedAt: c[iRetrieved] ?? '',
      retrievalMethod: c[iMethod] ?? '',
      note: c[iNote] ?? '',
    };
  });
}

/**
 * Resolve the "current" reading of the series: for each period, the row with
 * the latest retrieved_at. Older rows remain in the file as the audit trail;
 * they simply stop being the latest. Result is sorted by fiscal year.
 */
export function resolveCurrent(rows: SnapshotRow[]): SnapshotRow[] {
  const latest = new Map<string, SnapshotRow>();
  for (const row of rows) {
    const held = latest.get(row.period);
    if (!held || row.retrievedAt >= held.retrievedAt) latest.set(row.period, row);
  }
  return [...latest.values()].sort((a, b) => a.fy - b.fy);
}

export const snapshotRows: SnapshotRow[] = parse(csvRaw);
export const currentRows: SnapshotRow[] = resolveCurrent(snapshotRows);

export const dataAsOf: string = currentRows.reduce(
  (max, r) => (r.retrievedAt > max ? r.retrievedAt : max),
  '',
);
export const publisher: string = currentRows[0]?.publisher ?? 'OMB (via FRED)';
export const seriesId: string = currentRows[0]?.seriesId ?? 'FYFSD';
export const sourceUrl: string =
  currentRows[0]?.sourceUrl ?? 'https://fred.stlouisfed.org/series/FYFSD';
export const isBootstrap: boolean = currentRows.some(
  (r) => r.retrievalMethod === 'manual-bootstrap',
);
