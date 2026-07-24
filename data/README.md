# Data

`deficit_fyfsd.csv` — the federal surplus/deficit series that the seed claim is
measured against.

## Source

FRED series **FYFSD** — *Federal Surplus or Deficit [-]*, by fiscal year, in
millions of USD, produced by the U.S. Office of Management and Budget and
distributed by the Federal Reserve Bank of St. Louis (FRED). It reaches back
decades and so can express a claim about FY2009–FY2013.

We chose FYFSD deliberately. The Treasury *Fiscal Data* API's MTS dataset only
begins at FY2015 and cannot express a 2009 claim at all.

**Sign convention is preserved as published**: surplus is positive, deficit is
negative. The transform into a positive deficit magnitude (and into billions)
happens in the app, in `src/claim/obamaDeficit2009.ts`, right next to the
comparator that depends on it — never in this file.

## Every row carries its own provenance

`source_url`, `publisher`, `retrieved_at`, and `retrieval_method` travel with
each measurement, not with the file as a whole.

## Append-only — this is the audit trail

The refresh job **only ever inserts**. It never updates a value in place and
never deletes a row. When a figure is revised, the new figure lands as a **new
row** for the same `period` with a later `retrieved_at`; the old row stays as
part of the record. A reader (and the app) resolves the "current" value for a
period as the row with the **latest `retrieved_at`**. Git history is the
as-of log.

A number silently overwriting an older one would destroy the trail the whole
project rests on. Do not edit historical rows.

## Bootstrap notice

Every row here is currently marked `retrieval_method: manual-bootstrap`. The
build environment that seeded this repository had no network route to FRED
(egress policy), so these values were hand-entered from published OMB figures.
FY2012 in particular is approximate. The first successful automated refresh
(`npm run refresh`, or the scheduled workflow, run from a network that can reach
FRED) will **insert** authoritative rows that supersede these by `retrieved_at`
— no bootstrap row is deleted; it simply stops being the latest.
