"use client";

// FeedClient.tsx — client component for filtering and displaying the vendor feed.
// useSearchParams is isolated to SearchParamsSyncer (wrapped in Suspense fallback={null})
// so entity cards are always present in the initial SSR HTML.

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import type { FeedEntity, EntityType } from "@/lib/vendor-feed/feed-queries";

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<EntityType, { label: string; activeCls: string }> = {
  feature_launch: {
    label: "Feature Launch",
    activeCls: "bg-accent text-bg border-accent",
  },
  pricing_change: {
    label: "Pricing Change",
    activeCls: "bg-clay text-bg border-clay",
  },
  partnership: {
    label: "Partnership",
    activeCls: "bg-accent-soft text-accent border-accent",
  },
  architectural_shift: {
    label: "Architecture",
    activeCls: "bg-ink text-bg border-ink",
  },
};

const TYPE_BADGE: Record<EntityType, string> = {
  feature_launch: "bg-accent text-bg",
  pricing_change: "bg-clay text-bg",
  partnership: "bg-accent-soft text-accent",
  architectural_shift: "bg-ink text-bg",
};

const ALL_TYPES = Object.keys(TYPE_CONFIG) as EntityType[];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Date unknown";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function parseParam(params: URLSearchParams, key: string): string[] {
  const val = params.get(key);
  return val ? val.split(",").filter(Boolean) : [];
}

// ── SearchParamsSyncer ────────────────────────────────────────────────────────
// Isolated client component that reads URL state and syncs it to parent state.
// Wrapped in <Suspense fallback={null}> in FeedClient so entity cards are not
// gated on this component during prerendering.

function SearchParamsSyncer({
  setSelectedCompanies,
  setSelectedTypes,
}: {
  setSelectedCompanies: (c: string[]) => void;
  setSelectedTypes: (t: EntityType[]) => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    setSelectedCompanies(parseParam(searchParams, "companies"));
    setSelectedTypes(parseParam(searchParams, "types") as EntityType[]);
  }, [searchParams, setSelectedCompanies, setSelectedTypes]);
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  activeCls,
  onClick,
}: {
  label: string;
  active: boolean;
  activeCls: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={[
        "font-mono text-[11px] tracking-[0.03em] px-[10px] py-[4px] rounded-sm border transition-colors duration-[120ms] cursor-pointer",
        active
          ? activeCls
          : "bg-bg text-muted border-line hover:border-accent hover:text-accent",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function EntityCard({ entity }: { entity: FeedEntity }) {
  const badge = TYPE_BADGE[entity.entityType];
  const label = TYPE_CONFIG[entity.entityType].label;

  return (
    <article className="py-[28px] border-b border-line last:border-b-0">
      <div className="flex items-start justify-between gap-[16px] mb-[10px]">
        <div className="flex items-center gap-[10px] flex-wrap">
          <span
            className={`inline-block font-mono text-[11px] tracking-[0.04em] px-[8px] py-[3px] rounded-sm ${badge}`}
          >
            {label}
          </span>
          <span className="font-mono text-[12px] text-muted">{entity.company}</span>
        </div>
        <span className="font-mono text-[12px] text-hint shrink-0">
          {formatDate(entity.date)}
        </span>
      </div>

      <h2 className="font-serif text-[20px] font-medium leading-[1.3] tracking-[-0.01em] text-ink mb-[8px]">
        {entity.title}
      </h2>

      <p className="font-sans text-[15px] leading-[1.65] text-ink-soft mb-[14px]">
        {entity.description}
      </p>

      <a
        href={entity.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[12px] text-accent no-underline hover:underline"
      >
        Source →
      </a>
    </article>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function FeedClient({
  entities,
  totalCount,
  initialCompanies,
  initialTypes,
}: {
  entities: FeedEntity[];
  totalCount: number;
  initialCompanies: string[];
  initialTypes: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(initialCompanies);
  const [selectedTypes, setSelectedTypes] = useState<EntityType[]>(
    initialTypes as EntityType[]
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [matchingUrls, setMatchingUrls] = useState<Set<string> | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Unique companies present in the data, alphabetically sorted
  const availableCompanies = useMemo(
    () => [...new Set(entities.map((e) => e.company))].sort(),
    [entities]
  );

  const updateParams = useCallback(
    (updates: { companies?: string[]; types?: string[] }) => {
      const companies = updates.companies ?? selectedCompanies;
      const types = updates.types ?? selectedTypes;
      const params = new URLSearchParams();

      if (companies.length > 0) params.set("companies", companies.join(","));
      if (types.length > 0) params.set("types", types.join(","));

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, selectedCompanies, selectedTypes]
  );

  function toggleCompany(company: string) {
    const next = selectedCompanies.includes(company)
      ? selectedCompanies.filter((c) => c !== company)
      : [...selectedCompanies, company];
    setSelectedCompanies(next);
    updateParams({ companies: next });
  }

  function toggleType(type: EntityType) {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(next);
    updateParams({ types: next });
  }

  async function handleSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) {
      setMatchingUrls(null);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/vendor-feed/search?q=${encodeURIComponent(trimmed)}`);
      const data = (await res.json()) as { matches?: { sourceUrl: string }[] };
      const urls = new Set<string>((data.matches ?? []).map((m) => m.sourceUrl));
      setMatchingUrls(urls);
    } catch {
      setMatchingUrls(null);
    } finally {
      setIsSearching(false);
    }
  }

  function clearAll() {
    setSelectedCompanies([]);
    setSelectedTypes([]);
    setSearchQuery("");
    setMatchingUrls(null);
    router.replace(pathname, { scroll: false });
  }

  const filtered = useMemo(
    () =>
      entities.filter((e) => {
        const companyMatch =
          selectedCompanies.length === 0 || selectedCompanies.includes(e.company);
        const typeMatch =
          selectedTypes.length === 0 || selectedTypes.includes(e.entityType);
        const searchMatch = matchingUrls === null || matchingUrls.has(e.sourceUrl);
        return companyMatch && typeMatch && searchMatch;
      }),
    [entities, selectedCompanies, selectedTypes, matchingUrls]
  );

  const hasActiveFilters =
    selectedCompanies.length > 0 || selectedTypes.length > 0 || matchingUrls !== null;

  return (
    <div className="mb-[96px]">
      {/* Syncs URL search params → state after hydration, for client-side navigation */}
      <Suspense fallback={null}>
        <SearchParamsSyncer
          setSelectedCompanies={setSelectedCompanies}
          setSelectedTypes={setSelectedTypes}
        />
      </Suspense>

      {/* Semantic search */}
      <div className="mb-[24px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(searchQuery);
          }}
        >
          <div className="flex gap-[8px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) setMatchingUrls(null);
              }}
              placeholder="Search by concept, feature, or company…"
              className="flex-1 font-mono text-[13px] px-[12px] py-[8px] bg-bg border border-line rounded-sm text-ink placeholder:text-hint focus:outline-none focus:border-accent transition-colors duration-[120ms]"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="font-mono text-[12px] px-[14px] py-[8px] bg-bg border border-line rounded-sm text-muted hover:border-accent hover:text-accent transition-colors duration-[120ms] disabled:opacity-50 cursor-pointer"
            >
              {isSearching ? "…" : "Search"}
            </button>
          </div>
        </form>
      </div>

      {/* Filter controls */}
      <div className="mb-[32px] space-y-[16px]">
        {/* Type filter */}
        <div>
          <p className="font-mono text-[11px] text-hint tracking-[0.04em] uppercase mb-[10px]">
            Type
          </p>
          <div className="flex flex-wrap gap-[8px]">
            {ALL_TYPES.map((type) => (
              <FilterPill
                key={type}
                label={TYPE_CONFIG[type].label}
                active={selectedTypes.includes(type)}
                activeCls={TYPE_CONFIG[type].activeCls}
                onClick={() => toggleType(type)}
              />
            ))}
          </div>
        </div>

        {/* Company filter */}
        <div>
          <p className="font-mono text-[11px] text-hint tracking-[0.04em] uppercase mb-[10px]">
            Company
          </p>
          <div className="flex flex-wrap gap-[8px]">
            {availableCompanies.map((company) => (
              <FilterPill
                key={company}
                label={company}
                active={selectedCompanies.includes(company)}
                activeCls="bg-ink-soft text-bg border-ink-soft"
                onClick={() => toggleCompany(company)}
              />
            ))}
          </div>
        </div>

        {/* Clear + count row */}
        <div className="flex items-center justify-between pt-[4px]">
          <span className="font-mono text-[12px] text-hint">
            {filtered.length} of{" "}
            {totalCount > entities.length
              ? `${totalCount.toLocaleString()} total (showing most recent ${entities.length})`
              : `${entities.length} ${entities.length === 1 ? "entity" : "entities"}`}
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="font-mono text-[12px] text-muted hover:text-clay transition-colors duration-[120ms] cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="py-[60px] text-center">
          <p className="font-serif text-[20px] text-muted mb-[12px]">
            {matchingUrls !== null && matchingUrls.size === 0
              ? `No results for “${searchQuery}”.`
              : "No entities match these filters."}
          </p>
          <button
            onClick={clearAll}
            className="font-mono text-[13px] text-accent hover:underline cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      ) : (
        filtered.map((entity) => <EntityCard key={entity.id} entity={entity} />)
      )}
    </div>
  );
}
