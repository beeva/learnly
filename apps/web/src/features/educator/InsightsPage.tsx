import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { isApiError, type InsightsRange } from "../../api/client";
import { useClassroomHeatmap, useClassroomInsights, useClassrooms, useCourses } from "../../api/hooks";
import { useT } from "../../i18n/I18nProvider";
import { Badge, Banner, Button, ButtonLink, Card, EmptyState, Skeleton, TabPanel, Tabs, useToast } from "../../ui/components";
import { AlertIcon, ArrowLeftIcon, CalendarIcon, ChartIcon, CheckIcon, DownloadIcon, LayersIcon, RefreshIcon, UsersIcon } from "../../ui/icons";
import { JoinCodeChip } from "./ClassroomsPage";
import { csvFilename, downloadClassroomCsv } from "./exportCsv";
import { HotspotList } from "./HotspotList";
import { MasteryDistribution } from "./MasteryDistribution";
import { MasteryHeatmap } from "./MasteryHeatmap";
import { OverviewTiles } from "./OverviewTiles";
import { StudentTable, relativeTime } from "./StudentTable";
import styles from "./Insights.module.css";

type RangePreset = 7 | 14 | 30;
type View = "overview" | "heatmap" | "students";

function localDay(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

/** Inclusive window ending today: "last 7 days" is today plus the six before it. */
export function rangeForPreset(days: RangePreset, now = new Date()): InsightsRange {
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  return { from: localDay(from), to: localDay(now) };
}

function InsightsSkeleton() {
  return (
    <div aria-busy="true" className={styles.skeleton}>
      <div className={styles.tiles}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={112} radius={20} />
        ))}
      </div>
      <div className={styles.overviewGrid}>
        <Skeleton height={300} radius={20} />
        <Skeleton height={300} radius={20} />
      </div>
    </div>
  );
}

export function InsightsPage() {
  const { classroomId = "" } = useParams();
  const { t, locale } = useT();
  const { toast } = useToast();
  const [preset, setPreset] = useState<RangePreset>(7);
  const [view, setView] = useState<View>("overview");
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const range = useMemo(() => rangeForPreset(preset), [preset]);

  const classrooms = useClassrooms();
  const courses = useCourses();
  const insights = useClassroomInsights(classroomId, range);
  const heatmap = useClassroomHeatmap(classroomId);

  const classroom = classrooms.data?.classrooms.find((candidate) => candidate.id === classroomId);
  const course = courses.data?.courses.find((candidate) => candidate.id === classroom?.courseId);
  const missing = (classrooms.isSuccess && !classroom) || isApiError(insights.error, "not_found") || isApiError(insights.error, "forbidden");

  async function exportCsv() {
    if (!classroom) return;
    setExporting(true);
    setExportStatus(t("educator.export.preparing"));
    try {
      await downloadClassroomCsv(classroom.id, csvFilename(classroom.name));
      setExportStatus(t("educator.export.done"));
      toast({ tone: "success", icon: CheckIcon, title: t("educator.export.done") });
    } catch {
      setExportStatus(t("educator.export.failed"));
      toast({ tone: "warning", title: t("educator.export.failed") });
    } finally {
      setExporting(false);
    }
  }

  if (missing) {
    return (
      <EmptyState
        icon={UsersIcon}
        title={t("educator.insights.missingTitle")}
        description={t("educator.insights.missingBody")}
        action={
          <ButtonLink to="/teach" variant="secondary" leadingIcon={ArrowLeftIcon}>
            {t("educator.insights.back")}
          </ButtonLink>
        }
      />
    );
  }

  const data = insights.data;
  const presets: { value: RangePreset; label: string }[] = [
    { value: 7, label: t("educator.range.7") },
    { value: 14, label: t("educator.range.14") },
    { value: 30, label: t("educator.range.30") },
  ];

  return (
    <div className={styles.page}>
      <Link to="/teach" className={styles.back}>
        <ArrowLeftIcon size={16} /> {t("educator.insights.back")}
      </Link>

      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className="eyebrow">{t("educator.insights.eyebrow")}</p>
          {classroom ? <h1>{classroom.name}</h1> : <Skeleton width={280} height={40} />}
          <div className={styles.headerMeta}>
            {course ? <Badge tone="primary">{course.title}</Badge> : null}
            {classroom ? (
              <Badge icon={UsersIcon}>{t("educator.card.students", { count: classroom.studentCount })}</Badge>
            ) : null}
            {classroom ? <JoinCodeChip code={classroom.joinCode} /> : null}
          </div>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.rangeGroup} role="group" aria-label={t("educator.range.label")}>
            <CalendarIcon size={16} className={styles.rangeIcon} aria-hidden="true" />
            {presets.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.rangeButton}
                aria-pressed={preset === option.value}
                onClick={() => setPreset(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" leadingIcon={DownloadIcon} loading={exporting} disabled={!classroom} onClick={() => void exportCsv()}>
            {t("educator.export.button")}
          </Button>
          <span className="sr-only" role="status" aria-live="polite">
            {exportStatus}
          </span>
        </div>
      </header>

      {data ? (
        <p className={styles.updated}>
          {t("educator.insights.updated", { time: relativeTime(data.generatedAt, locale) })}
          {insights.isFetching ? <span className={styles.refreshing}> · {t("common.loading")}</span> : null}
        </p>
      ) : null}

      <Tabs<View>
        label={t("educator.tabs.label")}
        idPrefix="insights"
        value={view}
        onChange={setView}
        items={[
          { value: "overview", label: t("educator.tabs.overview"), icon: ChartIcon },
          { value: "heatmap", label: t("educator.tabs.heatmap"), icon: LayersIcon },
          { value: "students", label: t("educator.tabs.students"), icon: UsersIcon },
        ]}
      />

      {insights.isError && !data ? (
        <EmptyState
          icon={AlertIcon}
          title={t("educator.insights.errorTitle")}
          description={t("educator.insights.errorBody")}
          action={
            <Button variant="secondary" leadingIcon={RefreshIcon} onClick={() => void insights.refetch()}>
              {t("common.retry")}
            </Button>
          }
        />
      ) : !data ? (
        <InsightsSkeleton />
      ) : data.students.length === 0 ? (
        <Card padding="none" className={styles.emptyRoster}>
          <EmptyState
            icon={UsersIcon}
            title={t("educator.insights.emptyTitle")}
            description={t("educator.insights.emptyBody", { code: classroom?.joinCode ?? "" })}
            action={classroom ? <JoinCodeChip code={classroom.joinCode} /> : undefined}
          />
        </Card>
      ) : (
        <>
          {view === "overview" ? (
            <TabPanel idPrefix="insights" value="overview">
              <div className={styles.overview}>
                <OverviewTiles insights={data} />
                {data.students.some((student) => student.needsAttention) ? (
                  <Banner
                    tone="warning"
                    title={t("educator.insights.attentionTitle", { count: data.students.filter((student) => student.needsAttention).length })}
                    action={
                      <Button size="sm" variant="secondary" onClick={() => setView("students")}>
                        {t("educator.insights.attentionCta")}
                      </Button>
                    }
                  >
                    {t("educator.insights.attentionBody")}
                  </Banner>
                ) : null}
                <div className={styles.overviewGrid}>
                  <Card padding="lg">
                    <MasteryDistribution distribution={data.masteryDistribution} />
                  </Card>
                  <Card padding="lg">
                    <HotspotList hotspots={data.hotspots} />
                  </Card>
                </div>
              </div>
            </TabPanel>
          ) : null}
          {view === "heatmap" ? (
            <TabPanel idPrefix="insights" value="heatmap">
              <Card padding="lg">
                {heatmap.data ? (
                  <MasteryHeatmap heatmap={heatmap.data} />
                ) : heatmap.isError ? (
                  <EmptyState
                    compact
                    icon={AlertIcon}
                    title={t("educator.insights.errorTitle")}
                    action={
                      <Button variant="secondary" leadingIcon={RefreshIcon} onClick={() => void heatmap.refetch()}>
                        {t("common.retry")}
                      </Button>
                    }
                  />
                ) : (
                  <Skeleton height={360} radius={16} />
                )}
              </Card>
            </TabPanel>
          ) : null}
          {view === "students" ? (
            <TabPanel idPrefix="insights" value="students">
              <Card padding="lg">
                <StudentTable students={data.students} />
              </Card>
            </TabPanel>
          ) : null}
        </>
      )}
    </div>
  );
}
