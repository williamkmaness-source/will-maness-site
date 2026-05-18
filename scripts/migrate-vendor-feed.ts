// migrate-vendor-feed.ts — Creates the Postgres schema for the vendor feed pipeline.
// Safe to re-run (all statements use IF NOT EXISTS).
// Uses POSTGRES_URL_NON_POOLING (direct connection required for DDL).

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("POSTGRES_URL_NON_POOLING is not set");

  const sql = neon(connectionString);

  await sql`
    CREATE TYPE IF NOT EXISTS vendor_feed_status AS ENUM ('pending', 'extracted', 'failed')
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vf_raw_pages (
      id            bigserial PRIMARY KEY,
      company       text        NOT NULL,
      source_url    text        NOT NULL,
      content_hash  text        NOT NULL,
      raw_content   text        NOT NULL,
      status        vendor_feed_status NOT NULL DEFAULT 'pending',
      error_message text,
      scraped_at    timestamptz NOT NULL DEFAULT now(),
      UNIQUE (source_url)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vf_feature_launches (
      id           bigserial PRIMARY KEY,
      raw_page_id  bigint NOT NULL REFERENCES vf_raw_pages(id),
      company      text   NOT NULL,
      product_name text   NOT NULL,
      description  text   NOT NULL,
      release_date date,
      source_url   text   NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vf_pricing_changes (
      id             bigserial PRIMARY KEY,
      raw_page_id    bigint NOT NULL REFERENCES vf_raw_pages(id),
      company        text   NOT NULL,
      description    text   NOT NULL,
      direction      text,
      effective_date date,
      source_url     text   NOT NULL,
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vf_partnerships (
      id               bigserial PRIMARY KEY,
      raw_page_id      bigint NOT NULL REFERENCES vf_raw_pages(id),
      company          text   NOT NULL,
      partner_company  text   NOT NULL,
      integration_type text,
      description      text   NOT NULL,
      announced_date   date,
      source_url       text   NOT NULL,
      created_at       timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vf_architectural_shifts (
      id               bigserial PRIMARY KEY,
      raw_page_id      bigint NOT NULL REFERENCES vf_raw_pages(id),
      company          text   NOT NULL,
      from_technology  text,
      to_technology    text,
      description      text   NOT NULL,
      announced_date   date,
      source_url       text   NOT NULL,
      created_at       timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_vf_raw_pages_status ON vf_raw_pages(status)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_vf_raw_pages_company ON vf_raw_pages(company)
  `;

  console.log("✓ vendor feed schema up to date");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
