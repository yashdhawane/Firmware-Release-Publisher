import duckdb from "duckdb";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const db = new duckdb.Database("releases.duckdb");

const CERT_PATH = "/app/keys/current/current.cert.pem";
const KEY_PATH = "/app/keys/current/current.key.pem";

function signDescriptor(descriptorString) {

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "publisher-"));

    const descriptorFile = path.join(dir, "descriptor.json");
    const signatureFile = path.join(dir, "signature.pem");

    fs.writeFileSync(descriptorFile, descriptorString);
    try{
    execFileSync("openssl", [
        "cms",
        "-sign",
        "-binary",
        "-in",
        descriptorFile,
        "-signer",
        CERT_PATH,
        "-inkey",
        KEY_PATH,
        "-outform",
        "PEM",
        "-out",
        signatureFile
    ]);

    return fs.readFileSync(signatureFile, "utf8");

    }
    finally{
        fs.rmSync(dir, {
                recursive: true,
                force: true
        });
    }
}

function escapeSql(value) {
    return value.replaceAll("'", "''");
}

function canonicalJson(obj) {
    return JSON.stringify(
        Object.keys(obj)
            .sort()
            .reduce((result, key) => {
                result[key] = obj[key];
                return result;
            }, {})
    );
}

async function getCurrentSigningKey() {
    const response = await fetch(
        "http://127.0.0.1:7070/v1/signing-key/current"
    );

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return await response.json();
}

async function getPublication(bundleId) {
    const rows = await query(`
        SELECT *
        FROM publications
        WHERE bundle_id = '${escapeSql(bundleId)}'
    `);

    return rows.length > 0 ? rows[0] : null;
}

async function savePublication(receipt, bundleId, token) {

    await query(`
        INSERT INTO publications
        VALUES (
            '${escapeSql(bundleId)}',
            '${escapeSql(token)}',
            '${escapeSql(receipt.publication_id)}',
            '${escapeSql(receipt.status)}'
        )
    `);
}

function query(sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

await query(`
DROP TABLE IF EXISTS manifest;
`);

await query(`
CREATE TABLE manifest AS
SELECT *
FROM read_csv_auto('fixtures/build_manifest.csv');
`);

await query(`
CREATE TABLE IF NOT EXISTS publications (
    bundle_id TEXT PRIMARY KEY,
    request_token TEXT,
    publication_id TEXT,
    status TEXT
);
`);

try{
    const rows = await query(`
WITH dedup AS (
    SELECT DISTINCT *
    FROM manifest
),

withdrawn AS (
    SELECT supersedes_id
    FROM dedup
    WHERE record_type = 'WITHDRAWAL'
)

SELECT
    bundle_id,
    COUNT(*) AS artifact_count,
    SUM(size_bytes) AS total_bytes
FROM dedup
WHERE record_type = 'BUILD'
AND entry_id NOT IN (
    SELECT supersedes_id
    FROM withdrawn
)
GROUP BY bundle_id
HAVING COUNT(*) > 0
ORDER BY bundle_id;
`);

const signingKey = await getCurrentSigningKey();

for (const row of rows) {

    const descriptor = {
        artifact_count: Number(row.artifact_count),
        bundle_id: row.bundle_id,
        total_bytes: Number(row.total_bytes)
    };

    const descriptorString = canonicalJson(descriptor);

    const token = `token-${row.bundle_id}`;

    const existing = await getPublication(row.bundle_id);

    if (existing) {

        console.log(
            `BUNDLE ${row.bundle_id} PUBLISHED RECEIPT=${existing.publication_id} TOKEN=${existing.request_token} STATUS=${existing.status}`
        );

        continue;
    }


    const signature = signDescriptor(descriptorString);

    console.log(
        `BUNDLE ${row.bundle_id} SIGNED KEY=${signingKey.key_id}`
    );

    
    const response = await fetch(
    "http://127.0.0.1:7070/v1/publications",
    {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            descriptor: descriptorString,
            signature,
            request_token: token
        })
    }
    );

    if (!response.ok) {
        throw new Error(await response.text());
    }

    const receipt = await response.json();

    if (receipt.error) {
        throw new Error(JSON.stringify(receipt));
    }

    await savePublication(
        receipt,
        row.bundle_id,
        token
    );

    console.log(
        `BUNDLE ${row.bundle_id} PUBLISHED RECEIPT=${receipt.publication_id} TOKEN=${token} STATUS=${receipt.status}`
    );
}

}

catch(error) {

    console.error("Error", error);

}
finally {

    db.close();

}