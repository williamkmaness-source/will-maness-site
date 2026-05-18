"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
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
  architectural_shift: "bg-bg-soft text-ink-soft border border-line",
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

export function FeedClient({ entities }: { entities: FeedEntity[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedCompanies = useMemo(
    () => parseParam(searchParams, "companies"),
    [searchParams]
  );
  const selectedTypes = useMemo(
    () => parseParam(searchParams, "types") as EntityType[],
    [searchParams]
  );

  // Unique companies present in the data, alphabetically sorted
  const availableCompanies = useMemo(
    () => [...new Set(entities.map((e) => e.company))].sort(),
    [entities]
  );

  const updateParams = useCallback(
    (updates: { companies?: string[]; types?: string[] }) => {
      const params = new URLSearchParams(searchParams.toString());
      const companies = updates.companies ?? selectedCompanies;
      const types = updates.types ?? selectedTypes;

      if (companies.length > 0) {
        params.set("companies", companies.join(","));
      } else {
        params.delete("companies");
      }
      if (types.length > 0) {
        params.set("types", types.join(","));
      } else {
        params.delete("types");
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, selectedCompanies, selectedTypes]
  );

  function toggleCompany(company: string) {
    const next = selectedCompanies.includes(company)
      ? selectedCompanies.filter((c) => c !== company)
      : [...selectedCompanies, company];
    updateParams({ companies: next });
  }

  function toggleType(type: EntityType) {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    updateParams({ types: next });
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const filtered = useMemo(
    () =>
      entities.filter((e) => {
        const companyMatch =
          selectedCompanies.length === 0 || selectedCompanies.includes(e.company);
        const typeMatch =
          selectedTypes.length === 0 || selectedTypes.includes(e.entityType);
        return companyMatch && typeMatch;
      }),
    [entities, selectedCompanies, selectedTypes]
  );

  const hasActiveFilters = selectedCompanies.length > 0 || selectedTypes.length > 0;

  return (
    <div className="mb-[96px]">
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
            {filtered.length} of {entities.length}{" "}
            {entities.length === 1 ? "entity" : "entities"}
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
            No entities match these filters.
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
