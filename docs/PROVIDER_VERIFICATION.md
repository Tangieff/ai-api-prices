# Provider transparency records

## What this is

A transparency layer inside the Providers view. It answers one question about
each provider in the index:

> What publicly verifiable information exists about who operates this service?

That is the whole scope. The records are provider profiles: who publicly
represents or runs the service, what company the provider says it is, whether
that company can be confirmed independently, which official accounts belong to
it, and what is still unknown.

## What this is not

It is **not** a safety guarantee, a scam detector, an authenticity guarantee, an
audit certification, a reputation marketplace or a provider trust ranking. It
does not verify that a provider serves the model it advertises — that is
model-authenticity verification, which this product does not do.

There is no opaque score. No provider is ever labelled trusted, safe, unsafe,
approved or a scam. The only numbers shown are counts of things we found, and
every one can be checked against the sources in the drawer.

It is also **not an investigation report**. The feature leads with what was
found, never with how many providers failed to prove themselves. Not finding a
person is a gap in the public record, not a finding about the provider, and the
copy must never imply otherwise.

Keep the two product ideas apart:

- **Price verification** — is a published price real and correctly normalized?
  That is the rest of the product.
- **Provider transparency** — what can the public establish about the operator?
  That is this document.

## The three identity concepts

Collapsing these is how a transparency record turns into a trust claim. They have
different evidence bars on purpose.

### A. Public founder or operator — an accountability signal

This does **not** require registry-grade evidence, and demanding it would erase
every operator who is perfectly public about what they run. A person counts when
strong public evidence connects an identifiable person to the service:

- they publicly say they founded, built, run or maintain it, and the account
  plausibly is theirs;
- the provider's own site, docs or official account links them;
- official project or company material names them;
- a credible interview, podcast, LinkedIn profile, GitHub profile or conference
  listing states their role;
- several independent public sources consistently reinforce the relationship.

A person does not need to be a registered director to count here. But the wording
on screen must match the evidence: "Public operator", "Founder, <parent company>"
— never "Legal owner verified" unless legal ownership was actually established.

### B. Provider-stated company

The provider names a company in its own Terms, Privacy, About or billing
material. That is a claim, and renders as **Provider-stated**.

### C. Independently registered company

A government or company registry record, a regulator record, an official
corporate filing, or comparably strong independent corporate evidence, **and** a
reference we can point at. Renders as **Independently registered**.

**A LinkedIn company page is not registry proof. Terms and Privacy are not proof.**

## Where the data lives

```
src/lib/verification/types.ts     the record shape
src/lib/verification/records.ts   the researched records — the only file you edit
src/lib/verification/derive.ts    level, signals and status derivation
src/lib/verification/filters.ts   the filter chips
src/lib/verification/index.ts     row and summary shaping
(internal, unpublished)          the provider-by-provider research matrix
```

There is no database, no admin surface and no runtime collection. Records are a
static typed source file, exactly like `src/lib/providers.ts` and
`src/lib/official-prices.ts`.

They are shaped in the browser, not on the server: `ProviderPassport` is loaded
through `next/dynamic` only when someone previews or opens a provider from the
pricing table, and it calls `buildVerificationRows()` itself. The records are
static, so there is nothing for the server to compute per request, and this keeps
the evidence payload out of every homepage response — most visits never open a
passport.

Every active provider in `PROVIDERS` must have exactly one record. Records for
inactive providers may remain as historical research, but they cannot produce a
passport row. An active provider without a record renders as `Unverified` / `Not
reviewed`, and `tests/provider-verification.test.ts` fails until the record exists.

## The methodology

The level is derived, never written by hand. `deriveTransparencyLevel()` uses two
inputs: whether an accountability anchor exists, and how many official channels
we could establish. An anchor is **either** a publicly identified operator **or**
a company — they are alternatives, because a named person who publicly runs a
service is real accountability information even where no company is registered.

| Level | Rule |
| --- | --- |
| **High transparency** | An operator identified in the public record, or an independently registered company, **and** at least four established channels. |
| **Moderate transparency** | An anchor that is public but thinner — an indicated operator, or a provider-stated company — **and** at least three established channels. |
| **Limited transparency** | At least one official channel exists, but no operator or company could be established. |
| **Unverified** | The record has not been reviewed, or nothing at all was found. |

The ten channels are `website`, `docs`, `pricing`, `terms`, `privacy`, `github`,
`x`, `linkedin`, `chat` and `support`.

**Published is not the same as established.** Some providers serve a page that
renders its text in the browser, so a fetch returns an empty shell. List those
keys in `unreadable_surfaces`: the page stays in `official_presence`, because the
provider does publish it, but it does not count toward the level and renders as
`Partial`. The table column shows how many channels a provider publishes; the
level uses only the ones whose contents were established.

## Statuses

`founder_operator.status` describes a *person*:

| Status | Means |
| --- | --- |
| `identified` | Publicly identified, with evidence that holds up. |
| `likely` | Credibly indicated, but the evidence is thinner. |
| `not_found` | We searched the public record and found no one. |
| `unknown` | Sources were unreachable or too ambiguous to conclude. |

`legal_entity.status` describes a *company*: `verified`, `self_disclosed`,
`not_found`, `unknown`, exactly as sections B and C above.

Both carry a `strength`: `strong`, `supported`, `weak` or `none`. Only `strong`
and `supported` reach the screen. `weak` means discovery only — a lone search
snippet, a scraped mirror, an uncorroborated handle — and is recorded so the lead
is not lost, never displayed.

## How the layer fails closed

`founderStatus()` and `entityStatus()` weaken a claim the evidence does not carry,
and can never strengthen one:

- an `identified` operator drops to `likely` unless the record has a displayable
  founder/operator evidence entry that **names that person**;
- a `verified` company drops to `self_disclosed` unless it has a
  `registration_reference` **and** a registry-grade source naming that company;
- a `self_disclosed` company drops to `unknown` if no entity evidence exists at
  all.

Without the name check, any independent-looking link filed under `entity` would
promote whatever company name happened to sit in the same record. An editing
mistake can lose a signal; it cannot manufacture one. A test asserts no shipped
record is currently being weakened, so a mismatch between a status and its
sources is a test failure rather than a silent misrepresentation. Another builds
the record index and requires it to throw on a duplicate `provider_id`.

## Evidence requirements

Every `evidence` entry records a source that was actually consulted:

```ts
{
  claim_type: 'founder',
  category: 'founder',
  label: 'Relay Explained (official channel)',
  source_name: 'OpenGPU Network YouTube',
  url: 'https://www.youtube.com/watch?v=...',
  source_type: 'first_party',
  note: 'The provider parent’s own channel hosts a video presenting him explaining Relay.',
  strength: 'strong',
  opened: true,
  checked_at: '2026-08-27',
}
```

Rules:

- `note` states what the source shows. "LinkedIn profile identifies X as Founder
  of Y" — never "seems to be the founder".
- `opened: false` marks a source we could only read through a search index. X and
  LinkedIn often refuse automated fetches; the lead is still recorded, and the
  drawer says so in the open.
- `source_type: 'first_party'` is the provider's own material: good proof a page
  exists, weak proof of who is behind it.
- Never turn a pseudonym into a real name. A handle is a handle.
- Store only public professional identity — name, role, public profile URL,
  relationship to the provider. No home addresses, phone numbers, family details
  or private contact information. **A name appearing only inside a mailing
  address is not an operator claim** and must not be published as one.
- Distinguish a parent company from the specific product where they differ. If
  someone founded the parent but no source ties them to this product, say that.
- Never write that a provider is a scam, fraudulent, fake or illegal. This layer
  reports what can be verified, not accusations. A test rejects that vocabulary
  in any record string.

## Do not default to "not found"

An earlier research pass concluded that no provider had an identifiable public
operator. That was wrong, and it was wrong because a single blocked fetch was
treated as a negative result. When X, LinkedIn or Crunchbase refuse:

- read the search-result titles, which often carry the profile headline verbatim;
- search the exact quoted bio phrase to find it mirrored elsewhere;
- look for the account linked from the provider's own site or GitHub;
- try a text proxy such as `r.jina.ai`;
- use the open GitHub API — `api.github.com/users/<name>` exposes the company and
  blog fields;
- check the parent project's own channels.

Equally: a search index can serve text that is no longer on the live page. Before
publishing a biography, confirm it against the page itself. One founder bio
attributed to a provider's About page turned out not to be on it.

## Updating a record

1. Open the provider's own surfaces: site, docs, about, footer, terms, privacy,
   and any account the site links itself.
2. Update `official_presence`. `null` means "we looked and did not find one".
3. List any served-but-unreadable pages in `unreadable_surfaces`.
4. Update the two identity blocks, honouring the status and strength tables.
5. Replace the `evidence` array with what you actually consulted, each with
   today's `checked_at` and an honest `opened`.
6. Rewrite `summary` — two or three sentences of what was found, in plain factual
   language — and `unknowns`, which is rendered verbatim and must not be empty.
7. Set `last_reviewed_at` to today, in UTC, as `YYYY-MM-DD`.
8. Run `npm run lint && npm run typecheck && npm test`.

Do not touch `transparency_level`; it does not exist in the record. If a level
looks wrong, the evidence or the methodology is what needs changing.

## Last-reviewed semantics

`last_reviewed_at` is the date a human last consulted the sources and confirmed
the record. The site prints it verbatim next to every provider, so it is a claim
about work that was done.

**Never advance it without redoing the checks.** Providers change their public
material without notice; a stale date that is honest is far better than a fresh
one that is not. `checked_at` on an individual evidence entry is the date that
source was consulted, and moves independently.

## Copy

Concrete, not promotional, and never framed around failure:

- "Public identity and company information we found for 6 API providers."
- "Entity listed in the provider's Terms; independent registration not confirmed."
- "Public founder or operator not identified."
- "Last reviewed 27 Aug 2026."
- "Transparency reflects publicly available information. It does not guarantee
  service safety, legality, model authenticity, availability or quality."
