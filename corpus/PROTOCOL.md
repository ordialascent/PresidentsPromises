# Extraction protocol (v1, draft)

How promises are found in a source, cut into units, described and rated for
verifiability. The same protocol applies to every president and every source.
Nothing in it may be adjusted for one president.

The protocol has five steps:

1. **Screen** every sentence of the source, and record a decision for each candidate.
2. **Include or exclude** each candidate by the rules below, giving a reason code.
3. **Cut** included text into atomic promises.
4. **Describe** each promise: type, theme, deadline, verifiability, uncertainty.
5. **Link** each promise to the same commitment in other sources and terms.

The output of step 1–2 is a **screening ledger** per source. The output of steps
3–5 is `promises.yaml`. A validator checks both (see [Checks](#checks)).

---

## 1. Screen

Read the source sentence by sentence. A sentence is a **candidate** if it
matches the trigger lexicon, or if the reader judges it to express a commitment
even without a trigger word.

**Trigger lexicon** (case-insensitive, whole words):

| Group  | Patterns |
|--------|----------|
| firm   | `I will`, `I'll`, `we will`, `we'll`, `I am / I'm going to`, `we are / we're going to`, `I shall`, `we shall`, `my administration will`, `my plan will`, `as president, I`, `on day one`, `I pledge`, `I promise`, `I commit`, `I vow`, `my pledge`, `my promise`, `commitment` |
| soft   | `we must`, `we need to`, `we have to`, `we should`, `I want to`, `I hope to`, `I intend to`, `I plan to`, `I'd like to` |

Every trigger-matched sentence gets a ledger row. This makes recall
mechanically checkable: the validator re-runs the lexicon and fails if a
matched sentence has no row.

Debates: screen only the president's turns (paragraphs whose speaker label
equals the front-matter `speaker_label`). Moderators and opponents are never
screened.

## 2. Include or exclude

A candidate is **included** when the first three tests hold. The fourth
decides its **kind**:

| Test | Holds when |
|------|------------|
| **Speaker** | The president says it in their own voice. Not a quote of someone else, not a paraphrase of an opponent. |
| **Committer** | The subject is the speaker, their administration, or a "we" that includes the government they will lead. |
| **Future** | It refers to something to be done or brought about after the speech. |
| **Firm** | Firm commitment language (firm group above, or an equivalent like "X will be repealed under my administration") → kind `promise`. Obligation, wish or intention (soft group, or an equivalent) → kind `ambition`. |

A **promise** says the president will do it. An **ambition** says the
president wants it or thinks it must happen. Ambitions are not promises and
never get a kept/broken verdict, but they state a direction, so they are
recorded, described and linked the same way. Later they can be read for
movement in that direction.

Everything else is **excluded** with one code:

| Code | Meaning | Example |
|------|---------|---------|
| `others` | Commitment or obligation placed on someone else (citizens, Congress, other countries) | "I ask you to be citizens." |
| `past` | Record, accomplishment, or past action | "We cut taxes for every family." |
| `describe` | Description, prediction or rhetoric with no commitment | "The story goes on." |
| `conditional` | Hinges on a hypothetical outside the speaker's term | "If our country does not lead the cause of freedom, it will not be led." |
| `attack` | About the opponent or predecessor only | "She will raise your taxes." |
| `ceremony` | Thanks, greetings, blessings | "God bless America." |

Notes:

- **Vagueness is not a reason to exclude.** "We will defend our allies" is a
  promise, rated `low` (uncheckable) in step 4. Showing how much of a
  president's language is vague is part of the goal.
- **Soft language is an ambition, never a promise.** "We will reform Social
  Security" is a promise; "We must reform Social Security" is an ambition. The
  line is drawn by the words alone, the same for every president, so the
  share of firm versus soft language can be compared.
- **Conditionals tied to the election** ("If I'm elected, I will …") count as firm.
- A purpose clause ("…to recover the momentum of our economy") belongs to its
  promise; it is not a separate promise unless stated as its own commitment.
- When a test is unclear, include, and set `uncertainty: contested` with a note.

## 3. Cut into atomic promises

One promise has **one object** that could get **one verdict**.

- **Split** a sentence when its parts could get different verdicts: "We will
  reform Social Security and Medicare" → two promises. Siblings share a `group`.
- **Join** consecutive sentences that state one commitment: the ref becomes a
  range (`¶24.1-24.2`).
- **Merge** repeats of the same commitment in the same term into one promise
  with several `sources` occurrences. "Same" means same object and same success
  criterion; a sharper restatement (a number added) stays its own promise and
  is linked with `refines`.
- A list of manner-only commitments that are all `low` ("advance my convictions
  with civility, serve with courage, …") may stay one promise.

## 4. Describe

### Type

| Type | The promise is kept by … | Example |
|------|--------------------------|---------|
| `action` | a discrete act: sign, pass, repeal, build, withdraw, appoint | "We will reduce taxes." |
| `outcome` | a state of the world, whatever the means | "Cut the deficit in half." |
| `ongoing` | a stance or conduct held throughout the term | "We will defend our allies." |

### Deadline

Applied the same way to every promise:

1. An explicit date or period in the words wins ("by 2010", "in my first 100 days", "on day one").
2. Otherwise the deadline is **end of term** (20 January after the term).
3. `ongoing` promises are judged over the whole term.

The stated words are kept in `deadline.stated`; the applied date in
`deadline.applied`. "Immediately" and "very quickly" are recorded as stated, and
the applied deadline is end of term (the words give no checkable date).

### Verifiability

Three questions, the same for every type:

| Question | Yes when |
|----------|----------|
| **Object** | It is clear what the promise is about (a law, a programme, a quantity). |
| **Record** | A public record exists that shows what happened (statute, budget, official statistic, treaty, executive order). |
| **Criterion** | The words fix what counts as kept: the act itself (for `action`), a number or a direction (for `outcome`), or an observable conduct (for `ongoing`). |

| Level | Rule |
|-------|------|
| `high` | All three yes. |
| `medium` | Object and record yes; the criterion needs one stated judgement call (e.g. what counts as "reform"; which proxy measures "beyond challenge"). The judgement call goes in `verifiability.ambiguity`. |
| `low` | Object or record missing, or the criterion would need more than one judgement call. |

Only `high` and `medium` promises get verdicts later. `low` promises are kept
and shown as uncheckable: they measure how much of a president's language
cannot be held to account. Ambitions get the same rating but never a verdict.
Where the line between `medium` and `low` falls is reviewed once several terms
are re-extracted.

### Theme

Exactly one primary theme from this list. Changing the list is a protocol change.

`economy` · `taxes` · `budget` · `trade` · `energy` · `environment` ·
`health` · `education` · `immigration` · `defense` · `foreign-policy` ·
`crime-justice` · `retirement` · `government` · `rights` · `infrastructure` ·
`veterans` · `welfare`

### Uncertainty

`uncertainty.extraction`: `clear` · `probable` · `contested`, with a note when
not `clear`. Use it for unclear scope, unclear subject, anaphora ("we will not
allow **it**"), or sarcasm.

## 5. Link

`links` connects promises across sources and terms:

| Kind | Meaning |
|------|---------|
| `repeats` | Same commitment made again in a later term (Trump 2016 → 2024). |
| `refines` | A sharper version of a broader promise (adds a number or date). |
| `shared` | A different president made the same commitment (Bush 2004 and Obama 2009 on halving the deficit). |

---

## Records

### Screening ledger: `<year>-<kind>.screening.yaml`

```yaml
source: 2001-inaugural
protocol: 1
rows:
  - ref: "¶14.2"
    decision: include
    promises: [bush-2000-reform-socialsecurity, bush-2000-reform-medicare]
  - ref: "¶12.1"
    decision: include
    promises: [bush-2000-live-up-to-calling]   # an ambition
  - ref: "¶25.2"
    decision: others
```

### Promise or ambition (`promises.yaml`, protocol 1)

Both kinds share one record shape and one file; `kind` tells them apart.

```yaml
  - id: bush-2000-reform-socialsecurity
    kind: promise                       # promise | ambition
    sources:
      - in: inaugural
        ref: "¶14.2"
        quote: We will reform Social Security and Medicare, sparing our children from struggles we have the power to prevent.
    restatement: Reform Social Security.
    group: bush-2000-reform-entitlements
    type: action
    theme: retirement
    deadline: { stated: null, applied: 2005-01-20 }
    verifiability:
      level: medium
      object: Social Security programme
      record: enacted legislation (Congress.gov); SSA programme rules
      criterion: a Social Security reform law is enacted
      ambiguity: The speech does not say what "reform" means; any enacted structural change to benefits or financing counts.
    uncertainty: { extraction: clear }
    links: []
```

Quotes are exact: the whole cited span or a contiguous part of it, with
whitespace normalised. No ellipses. To skip text, cite two occurrences.

## Checks

The validator (`npm run validate`, run in CI) fails when:

- a trigger-matched sentence in a screened source has no ledger row;
- a ledger `include` row names a promise that does not exist, or a promise cites a ref no row includes;
- a ref does not resolve, or a quote is not a contiguous part of its span;
- a debate ref falls outside the president's turns;
- an id is duplicated, a theme is not in the list, or a required field is missing;
- `deadline.applied` is missing, or a `high`/`medium` promise has no criterion;
- a `medium` promise has no `ambiguity`, or a non-`clear` uncertainty has no note.

Terms not yet re-extracted (legacy `promises.yaml` without `protocol: 1`) get
the id and ref checks only; their quote problems are reported as warnings.

## Repeatability

Language is ambiguous; two careful readers will sometimes disagree. To measure
that, a second independent pass screens a sample (one source per term, chosen
in rotation) without seeing the first ledger. Agreement on include/exclude and
on verifiability level is reported on the methodology page, with every
disagreement and how it was resolved.
