# Placeholder instruction — Scaffold harbor_negative_control stub.
# Replace with the real instruction at human handoff.
# Harbor's Task validator requires this file to exist; the file's
# contents are not consulted by harbor_negative_control.
# Firmware Release Publisher

Implement the firmware release publisher located at:

/app/publisher/release-publisher.mjs

The program is executed using:

npm run report

Your implementation must:

- Read the build manifest from
  /app/fixtures/build_manifest.csv

- Reconcile the manifest by:
  - Removing exact duplicate rows.
  - Ignoring BUILD rows referenced by WITHDRAWAL records.
  - Publishing only bundles with at least one remaining BUILD.

- Create a DuckDB database named:

  releases.duckdb

- Store publication information in a table named:

  publications

with columns:

- bundle_id
- request_token
- publication_id
- status

The publisher must:

1. Query the current signing key from

GET http://127.0.0.1:7070/v1/signing-key/current

2. Build a canonical JSON descriptor for every publishable bundle.

The descriptor must contain:

- bundle_id
- artifact_count
- total_bytes

Object keys must be sorted lexicographically.

3. Sign the descriptor using the current signing key.

Do not use the revoked signing key.

4. Submit every descriptor to

POST http://127.0.0.1:7070/v1/publications

using:

{
  descriptor,
  signature,
  request_token
}

5. Use deterministic request tokens:

token-<bundle_id>

6. Preserve idempotency.

If a publication already exists locally, reuse it instead of submitting again.

7. Print exactly:

BUNDLE <bundle_id> SIGNED KEY=<key_id>

followed by

BUNDLE <bundle_id> PUBLISHED RECEIPT=<publication_id> TOKEN=<request_token> STATUS=PUBLISHED

Bundles must be processed in ascending bundle_id order.

Do not hardcode publication ids, signing keys, bundle counts, or expected output.
All values must be derived from the manifest and gateway.