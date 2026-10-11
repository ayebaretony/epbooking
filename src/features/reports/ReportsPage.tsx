import { useState } from "react";
import { CircleCheck, Download, FileSpreadsheet, FileText, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/StateMessages";
import { useBookingDrawer } from "@/features/bookings/useBookingDrawer";
import { useBookingYears } from "@/features/bookings/hooks/useBookingYears";
import { usePitches } from "@/features/pitches/usePitches";
import { formatDate } from "@/lib/dateFormat";
import { downloadFile } from "@/lib/download";
import { formatAed } from "@/lib/money";
import { MONTH_NAMES } from "@/lib/months";
import { buildReport, type ReportPeriod } from "@/lib/report";
import { todayInTimezone } from "@/lib/time";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";
import { MIME_TYPES, reportFileName } from "./reportFiles";
import type { ReportSections } from "./reportPdf";
import { useReportData } from "./useReportData";

const { currency, timezone } = DEFAULT_CENTER_SETTINGS;
const selectClass = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-primary";

const SECTION_LABELS: { key: keyof ReportSections; label: string }[] = [
  { key: "revenue", label: "Revenue summary" },
  { key: "pitches", label: "Booking breakdown by pitch" },
  { key: "clients", label: "Top repeat clients" },
  { key: "utilisation", label: "Utilisation overview" },
];

export function ReportsPage() {
  const today = todayInTimezone(timezone);
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7)) - 1;
  const { version } = useBookingDrawer();
  const years = useBookingYears(currentYear);

  // What is typed in the filters, and what has been applied (the report only changes when "Apply filters" is pressed)
  const defaultPeriod = (year: number): ReportPeriod => ({ year, fromMonth: 0, toMonth: year === currentYear ? currentMonth : 11 });
  const [draft, setDraft] = useState<ReportPeriod>(() => defaultPeriod(currentYear));
  const [applied, setApplied] = useState<ReportPeriod>(() => defaultPeriod(currentYear));
  const [filterError, setFilterError] = useState<string | null>(null);
  const [sections, setSections] = useState<ReportSections>({ revenue: true, pitches: true, clients: true, utilisation: true });
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const [notice, setNotice] = useState<{ kind: "ready" | "error"; text: string } | null>(null);

  const { state, reload } = useReportData(applied, version);
  const { state: pitchState } = usePitches();

  function apply() {
    if (draft.fromMonth > draft.toMonth) return setFilterError("The start month must come before the end month.");
    setFilterError(null);
    setNotice(null);
    setApplied(draft);
  }

  function reset() {
    const period = defaultPeriod(currentYear);
    setDraft(period);
    setApplied(period);
    setFilterError(null);
    setNotice(null);
  }

  const pitches = pitchState.status === "ready" ? pitchState.data : [];
  const report = state.status === "ready" ? buildReport(state.data, applied, pitches.map((pitch) => pitch.name)) : null;
  const hasData = report !== null && report.summary.bookings > 0;
  const nothingTicked = !Object.values(sections).some(Boolean);

  async function download(kind: "pdf" | "xlsx") {
    if (!report) return;
    setBusy(kind);
    setNotice(null);
    try {
      const generatedOn = formatDate(todayInTimezone(timezone));
      // The generators are only loaded now, so they cost nothing until someone asks for a file
      const bytes =
        kind === "pdf"
          ? (await import("./reportPdf")).renderReportPdf(report, sections, { currency, generatedOn })
          : (await import("./reportXlsx")).renderReportXlsx(report, sections, generatedOn);
      downloadFile(bytes, reportFileName(report.label, kind), MIME_TYPES[kind]);
      setNotice({ kind: "ready", text: kind === "pdf" ? "PDF report ready to download." : "Excel file ready to download." });
    } catch {
      setNotice({ kind: "error", text: "We couldn't create the file. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="text-display font-bold">Reports</h1>
      <p className="mt-1 text-sm text-muted">Download a snapshot of your pitch business.</p>

      <Card className="mt-6 p-4 sm:p-5">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="flex flex-col gap-1.5 text-xs font-medium">
            Year
            <select value={draft.year} onChange={(event) => setDraft(defaultPeriod(Number(event.target.value)))} className={selectClass}>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium">
            From
            <select value={draft.fromMonth} onChange={(event) => setDraft({ ...draft, fromMonth: Number(event.target.value) })} className={selectClass}>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium">
            To
            <select value={draft.toMonth} onChange={(event) => setDraft({ ...draft, toMonth: Number(event.target.value) })} className={selectClass}>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" onClick={apply}>
            Apply filters
          </Button>
        </div>
        {filterError ? (
          <p role="alert" className="mt-3 text-xs text-danger">
            {filterError}
          </p>
        ) : null}
      </Card>

      {state.status === "loading" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" role="status" aria-label="Loading report">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : null}
      {state.status === "error" ? (
        <Card className="mt-4">
          <ErrorState message="We couldn't load the bookings for this report." onRetry={reload} />
        </Card>
      ) : null}

      {report && !hasData ? (
        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-muted">
              <Info className="size-4" aria-hidden="true" />
              No data for the selected range ({report.label}).
            </p>
            <Button variant="secondary" onClick={reset}>
              Reset filters
            </Button>
          </div>
        </Card>
      ) : null}

      {report && hasData ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="p-5">
            <span className="flex size-10 items-center justify-center rounded-lg bg-sidebar text-primary" aria-hidden="true">
              <FileText className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">Export your report</h2>
            <p className="mt-1 text-sm text-muted">Generate a detailed snapshot of your pitch business for {report.label}.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => void download("pdf")} loading={busy === "pdf"} disabled={busy !== null || nothingTicked}>
                <Download className="size-4" aria-hidden="true" />
                {busy === "pdf" ? "Creating PDF…" : "Download PDF report"}
              </Button>
              <Button variant="secondary" onClick={() => void download("xlsx")} loading={busy === "xlsx"} disabled={busy !== null}>
                <FileSpreadsheet className="size-4" aria-hidden="true" />
                {busy === "xlsx" ? "Creating Excel…" : "Export Excel"}
              </Button>
            </div>
            {nothingTicked ? <p className="mt-3 text-xs text-muted">Tick at least one section to create a PDF. The Excel file always includes the full list of bookings.</p> : null}
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold">Report includes</h2>
            <p className="mt-0.5 text-xs text-muted">Choose the sections to include in your report.</p>
            <fieldset className="mt-4 grid gap-2.5">
              <legend className="sr-only">Sections to include</legend>
              {SECTION_LABELS.map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={sections[key]} onChange={(event) => setSections({ ...sections, [key]: event.target.checked })} className="size-4 accent-primary" />
                  {label}
                </label>
              ))}
            </fieldset>
            <dl className="mt-5 divide-y divide-line rounded-xl bg-sidebar px-4 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted">{report.label} revenue</dt>
                <dd className="font-semibold">{formatAed(report.summary.revenue, currency)}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted">Bookings</dt>
                <dd className="font-semibold">{report.summary.bookings}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted">Busiest pitch</dt>
                <dd className="font-semibold">{report.busiestPitch ?? "-"}</dd>
              </div>
            </dl>
          </Card>
        </div>
      ) : null}

      {notice ? (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${notice.kind === "ready" ? "bg-sidebar text-primary" : "bg-danger-tint text-danger"}`}
        >
          {notice.kind === "ready" ? <CircleCheck className="size-4" aria-hidden="true" /> : <Info className="size-4" aria-hidden="true" />}
          {notice.text}
        </div>
      ) : null}
    </div>
  );
}
