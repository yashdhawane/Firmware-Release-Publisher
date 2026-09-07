# Author Notes

## Design

The publisher implements the complete firmware release workflow described by the
task specification.

The reference implementation is kept outside the `environment/` directory.
The `environment/` directory represents the clean environment provided to the
candidate and must not contain the reference publisher implementation.

The reference implementation is stored under:

`reference/release-publisher.mjs`

The positive-control script:

`solution/publish.sh`

installs the reference implementation into:

`/app/publisher/release-publisher.mjs`

before running the publisher.

### Publisher workflow

1. Loads `/app/fixtures/build_manifest.csv` into a local DuckDB database.

2. Reconciles the manifest using SQL:

   - Removes exact duplicate rows.
   - Identifies `WITHDRAWAL` records.
   - Excludes `BUILD` rows whose `entry_id` is referenced by a withdrawal.
   - Groups surviving builds by `bundle_id`.
   - Computes the surviving artifact count and total byte size.
   - Processes bundles in ascending `bundle_id` order.

3. Retrieves the current signing-key metadata from:

   `GET /v1/signing-key/current`

   The publisher does not hardcode the signing key identifier.

4. Creates a canonical JSON descriptor for each publishable bundle.

   The descriptor contains:

   - `artifact_count`
   - `bundle_id`
   - `total_bytes`

   Object keys are serialized in lexicographical order with no insignificant
   whitespace.

5. Signs the exact descriptor bytes using OpenSSL CMS detached signatures and
   the current signing key.

6. Sends the signed descriptor to the distribution gateway over HTTP:

   `POST /v1/publications`

7. Uses a deterministic request token:

   `token-<bundle_id>`

8. Stores publication information in `releases.duckdb`, including:

   - `bundle_id`
   - `request_token`
   - `publication_id`
   - `status`

9. Before submitting a publication, the publisher checks the local publication
   ledger. If the deterministic request token already has a successful
   publication, the stored receipt is reused instead of submitting a duplicate.

This makes repeated executions idempotent.

---

## Design Decisions

### SQL reconciliation

DuckDB is used for reconciliation because SQL-based reconciliation is an
explicit requirement of the task.

Exact duplicate manifest rows are removed before withdrawal processing.

Withdrawals are matched using:

`WITHDRAWAL.supersedes_id = BUILD.entry_id`

Only surviving `BUILD` records contribute to a publishable bundle.

### Current signing key

The publisher obtains the current signing-key metadata from the gateway rather
than assuming a particular key identifier.

The current certificate and private key are used for CMS signing. The revoked
key is never used for publication.

### Canonical descriptors

The descriptor is serialized deterministically before signing.

The exact UTF-8 bytes used for the signature are also sent to the gateway as
the descriptor. This prevents signature verification failures caused by
different JSON representations.

### Temporary signing files

OpenSSL CMS signing uses temporary files where required. Temporary files are
removed after signing, including when an error occurs.

### Idempotency

Request tokens are deterministic:

`token-<bundle_id>`

Successful publication receipts are persisted in DuckDB. A subsequent run
checks the local publication table before making another publication request.

This prevents duplicate publications and allows repeated runs to produce
deterministic status output.

---

## Difficulty Added

The assessment combines several independent engineering concepts:

- SQL data reconciliation
- Exact duplicate elimination
- Withdrawal handling
- Canonical JSON generation
- OpenSSL CMS detached signatures
- Signing-key rotation
- HTTP API integration
- DuckDB persistence
- Idempotent publication
- Deterministic command-line output

The verifier recomputes the expected publishable bundles from the supplied
manifest. Therefore, the reference implementation must derive its results
from the input data rather than relying on fixed bundle counts or hardcoded
golden output.

---

## Verification Strategy

The task uses two separate verification runs.

### Proof A — Negative Control

The environment is built from scratch with:

`/app/publisher/`

empty.

No reference publisher is installed.

The verifier is then executed directly.

Expected result:

```text
Reward = 0