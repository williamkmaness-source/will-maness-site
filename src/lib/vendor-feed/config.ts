import { z } from "zod";

export const CompanySchema = z.object({
  name: z.string().min(1),
  blog_url: z.string().url(),
  github_org: z.string().min(1),
  rss_url: z.string().url().optional(),
});

export type Company = z.infer<typeof CompanySchema>;

const rawCompanies = [
  {
    name: "Fivetran",
    blog_url: "https://www.fivetran.com/blog",
    github_org: "fivetran",
  },
  {
    name: "Airbyte",
    blog_url: "https://airbyte.com/blog",
    github_org: "airbytehq",
    rss_url: "https://airbyte.com/blog/rss.xml",
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
  },
  {
    name: "dbt Labs",
    blog_url: "https://www.getdbt.com/blog",
    github_org: "dbt-labs",
  },
  {
    name: "Coalesce",
    blog_url: "https://coalesce.io/blog",
    github_org: "coalesceio",
  },
  {
    name: "Astronomer",
    blog_url: "https://www.astronomer.io/blog",
    github_org: "astronomer",
  },
  {
    name: "Mage",
    blog_url: "https://www.mage.ai/blog",
    github_org: "mage-ai",
  },
  {
    name: "Prefect",
    blog_url: "https://www.prefect.io/blog",
    github_org: "PrefectHQ",
  },
  {
    name: "Unstructured",
    blog_url: "https://unstructured.io/blog",
    github_org: "Unstructured-IO",
  },
  {
    name: "LlamaIndex",
    blog_url: "https://www.llamaindex.ai/blog",
    github_org: "run-llama",
  },
  {
    name: "Chunkr",
    blog_url: "https://chunkr.ai/blog",
    github_org: "lumina-ai-inc",
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
