# Author Notes

## Design

The publisher implements the complete firmware release workflow described in the task.

1. Loads `fixtures/build_manifest.csv` into a local DuckDB database.
2. Reconciles the manifest entirely using SQL:
   - Removes duplicate rows using `SELECT DISTINCT`.
   - Excludes withdrawn builds by matching `WITHDRAWAL.supersedes_id` with `BUILD.entry_id`.
   - Computes the publishable bundles, artifact counts, and total artifact sizes.
3. Retrieves the current signing key metadata from the distribution gateway instead of hardcoding the key identifier.
4. Creates a canonical JSON descriptor by sorting object keys before serialization.
5. Signs each descriptor using OpenSSL CMS detached signatures with the current private key.
6. Publishes the signed descriptor to the gateway over HTTP.
7. Stores publication receipts, request tokens, and publication status in `releases.duckdb`.
8. Before publishing, checks the local database for an existing publication and reuses the stored receipt, ensuring idempotent execution.

Deterministic request tokens are generated using:

```
token-<bundle_id>
```

This guarantees that rerunning the publisher does not create duplicate publications.

---

## Design Decisions

- DuckDB is used for all reconciliation logic because the task explicitly requires SQL-based processing.
- The current signing key is fetched from the gateway instead of hardcoding the key ID.
- Canonical JSON is generated before signing to ensure the gateway verifies the exact same bytes.
- Temporary files created for OpenSSL signing are always removed using a `finally` block.
- Publication receipts are persisted locally so repeated executions remain deterministic.

---

## Difficulty Added

The assessment combines several independent concepts into a single workflow:

- SQL data reconciliation
- Duplicate record elimination
- Withdrawal processing
- Canonical JSON generation
- OpenSSL CMS signing
- HTTP API integration
- DuckDB persistence
- Idempotent publishing

A hardcoded implementation cannot reliably pass because the verifier recomputes the expected publishable bundles directly from the manifest instead of comparing against fixed output.

---

## Validation

### Negative Run

No publisher implementation was provided.

Result:

```
Reward = 0
```

The publisher produced no valid output and no publications were created.

### Positive Run

Implemented:

- `publisher/release-publisher.mjs`
- `solution/publish.sh`

Result:

```
Reward = 1
```

The publisher successfully:

- reconciled the manifest,
- signed every publishable bundle,
- published using the current signing key,
- persisted publication receipts,
- reproduced deterministic output,
- remained idempotent across repeated executions.