import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Page } from "@/features/bookings/bookings.filter";

// "Showing 1-10 of 42" with previous / next and the page numbers
export function Pagination<T>({ page, noun, onPage }: { page: Page<T>; noun: string; onPage: (page: number) => void }) {
  if (page.total === 0) return null;
  const numbers = Array.from({ length: page.pageCount }, (_, index) => index + 1).filter((n) => n === 1 || n === page.pageCount || Math.abs(n - page.page) <= 1);
  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-4 text-xs text-muted sm:flex-row">
      <p>
        Showing {page.from}–{page.to} of {page.total} {noun}
      </p>
      {page.pageCount > 1 ? (
        <nav aria-label="Pages" className="flex items-center gap-1">
          <button type="button" onClick={() => onPage(page.page - 1)} disabled={page.page === 1} aria-label="Previous page" className="flex size-8 items-center justify-center rounded-md border border-line bg-surface disabled:opacity-40">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          {numbers.map((n, index) => (
            <span key={n} className="flex items-center gap-1">
              {index > 0 && n - numbers[index - 1] > 1 ? <span aria-hidden="true">…</span> : null}
              <button
                type="button"
                onClick={() => onPage(n)}
                aria-current={n === page.page ? "page" : undefined}
                className={`flex size-8 items-center justify-center rounded-md border text-xs font-medium ${n === page.page ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink"}`}
              >
                {n}
              </button>
            </span>
          ))}
          <button type="button" onClick={() => onPage(page.page + 1)} disabled={page.page === page.pageCount} aria-label="Next page" className="flex size-8 items-center justify-center rounded-md border border-line bg-surface disabled:opacity-40">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
