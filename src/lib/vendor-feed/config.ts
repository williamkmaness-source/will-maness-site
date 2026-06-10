import { z } from "zod";

export const CompanySchema = z.object({
  name: z.string().min(1),
  blog_url: z.string().url(),
  github_org: z.string().min(1),
  rss_url: z.string().url().optional(),
  github_releases_url: z.string().url().optional(),
});

export type Company = z.infer<typeof CompanySchema>;

const rawCompanies = [
  {
    name: "Fivetran",
    blog_url: "https://www.fivetran.com/blog",
    github_org: "fivetran",
    rss_url: "https://www.fivetran.com/blog/rss.xml",
  },
  {
    name: "Airbyte",
    blog_url: "https://airbyte.com/blog",
    github_org: "airbytehq",
    rss_url: "https://airbyte.com/blog/rss.xml",
    github_releases_url: "https://github.com/airbytehq/airbyte/releases",
  },
  {
    name: "Stitch",
    blog_url: "https://www.stitchdata.com/blog",
    github_org: "stitchdata",
  },
  {
    name: "Matillion",
    blog_url: "https://www.matillion.com/blog",
    github_org: "matillion",
  },
  {
    name: "Hevo Data",
    blog_url: "https://hevodata.com/blog",
    github_org: "hevodata",
    rss_url: "https://hevodata.com/blog/feed",
  },
  {
    name: "dbt Labs",
    blog_url: "https://www.getdbt.com/blog",
    github_org: "dbt-labs",
    rss_url: "https://docs.getdbt.com/blog/rss.xml",
    github_releases_url: "https://github.com/dbt-labs/dbt-core/releases",
  },
  {
    name: "Coalesce",
    blog_url: "https://coalesce.io/blog",
    github_org: "coalesceio",
    rss_url: "https://coalesce.io/blog/?feed=rss2",
  },
  {
    name: "Astronomer",
    blog_url: "https://www.astronomer.io/blog",
    github_org: "astronomer",
    github_releases_url: "https://github.com/astronomer/astro-cli/releases",
  },
  {
    name: "Mage",
    blog_url: "https://www.mage.ai/blog",
    github_org: "mage-ai",
    github_releases_url: "https://github.com/mage-ai/mage-ai/releases",
  },
  {
    name: "Prefect",
    blog_url: "https://www.prefect.io/blog",
    github_org: "PrefectHQ",
    github_releases_url: "https://github.com/PrefectHQ/prefect/releases",
  },
  {
    name: "Unstructured",
    blog_url: "https://unstructured.io/blog",
    github_org: "Unstructured-IO",
    rss_url: "https://unstructured.substack.com/feed",
    github_releases_url: "https://github.com/Unstructured-IO/unstructured/releases",
  },
  {
    name: "LlamaIndex",
    blog_url: "https://www.llamaindex.ai/blog",
    github_org: "run-llama",
    github_releases_url: "https://github.com/run-llama/llama_index/releases",
  },
  {
    name: "Chunkr",
    blog_url: "https://chunkr.ai/blog",
    github_org: "lumina-ai-inc",
    rss_url: "https://chunkr.ai/rss.xml",
  },
  {
    name: "Hightouch",
    blog_url: "https://hightouch.com/blog",
    github_org: "HighTouchHQ",
  },
  {
    name: "Census",
    blog_url: "https://www.getcensus.com/blog",
    github_org: "sutrolabs",
  },
  {
    name: "Dagster",
    blog_url: "https://dagster.io/blog",
    github_org: "dagster-io",
    rss_url: "https://dagster.io/blog/rss.xml",
    github_releases_url: "https://github.com/dagster-io/dagster/releases",
  },
  {
    name: "Monte Carlo",
    blog_url: "https://www.montecarlodata.com/blog",
    github_org: "monte-carlo-data",
    rss_url: "https://montecarlo.ai/blog/feed",
  },
  {
    name: "Estuary",
    blog_url: "https://estuary.dev/blog",
    github_org: "estuary",
    rss_url: "https://estuary.dev/blog/rss.xml",
    github_releases_url: "https://github.com/estuary/flow/releases",
  },
];

export function loadCompanies(raw: unknown[] = rawCompanies): Company[] {
  return raw.map((entry, i) => {
    const result = CompanySchema.safeParse(entry);
    if (!result.success) {
      throw new Error(
        `Invalid company config at index ${i}: ${result.error.message}`
      );
    }
    return result.data;
  });
}

export const companies = loadCompanies();
