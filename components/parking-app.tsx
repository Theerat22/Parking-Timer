"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  CarFront,
  Timer,
  History,
  ChartNoAxesColumnIncreasing,
  Mic,
  ArrowRight,
  Play,
  Square,
  Clock3,
  Wallet,
  ChevronRight,
  Settings2,
  X,
  Copy,
  Check,
  KeyRound,
  Trash2,
  Pencil,
  RefreshCw,
  WifiOff,
  Sun,
  Moon,
  Monitor,
  Download,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  bangkokDate,
  calculateParking,
  clock,
  dateLabel,
  duration,
  fromBangkokInput,
  localInput,
  money,
  summarize,
  timer,
  type ParkingSession,
  type ShortcutToken,
} from "@/lib/parking";

type Tab = "today" | "history" | "stats" | "siri";
type Payload = {
  ok: boolean;
  message?: string;
  state?: string;
  server_time?: string;
  sessions?: ParkingSession[];
  tokens?: ShortcutToken[];
  token?: string;
  owner?: { id: string };
};
type Pending = { action: "start" | "stop"; key: string; userId: string };
const navigation = [
  { id: "today", name: "หน้าหลัก", icon: Timer },
  { id: "history", name: "ประวัติ", icon: History },
  { id: "stats", name: "สถิติ", icon: ChartNoAxesColumnIncreasing },
  { id: "siri", name: "Siri", icon: Mic },
] as const;
async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  }).catch(() => {
    throw new Error(
      "ยังยืนยันการบันทึกไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่",
    );
  });
  let data: Payload;
  try {
    data = await response.json();
  } catch {
    throw new Error("ยังยืนยันการบันทึกไม่ได้ กรุณาตรวจสอบในเว็บ");
  }
  if (!response.ok || !data.ok)
    throw Object.assign(
      new Error(data.message ?? "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่"),
      { status: response.status },
    );
  return data;
}
function IconButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Empty({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof History;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Icon size={32} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export default function ParkingApp({ configured }: { configured: boolean }) {
  const [tab, setTab] = useState<Tab>("today");
  const [rows, setRows] = useState<ParkingSession[]>([]);
  const [tokens, setTokens] = useState<ShortcutToken[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(0);
  const offset = useRef(0);
  const refreshVersion = useRef(0);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const lock = useRef(false);
  const userIdRef = useRef("");
  const [theme, setTheme] = useState("system");
  const [origin, setOrigin] = useState("");
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState("");
  const accountDialog = useRef<HTMLDialogElement>(null);
  const editDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<ParkingSession | null>(null);
  const [deleting, setDeleting] = useState<ParkingSession | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editError, setEditError] = useState("");
  const [historyMonth, setHistoryMonth] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [period, setPeriod] = useState<"day" | "month" | "year">("month");
  const [selection, setSelection] = useState("");
  const refresh = useCallback(
    async (quiet = false) => {
      if (!configured) return;
      const version = ++refreshVersion.current;
      if (!quiet) setLoading(true);
      try {
        const data = await request("/api/bootstrap");
        if (version !== refreshVersion.current) return;
        setRows(data.sessions ?? []);
        setTokens(data.tokens ?? []);
        setDataReady(true);
        userIdRef.current = data.owner?.id ?? "";
        if (
          pendingRef.current &&
          pendingRef.current.userId !== userIdRef.current
        ) {
          pendingRef.current = null;
          setPending(null);
          sessionStorage.removeItem("parking-pending");
        }
        if (data.server_time)
          offset.current = Date.parse(data.server_time) - Date.now();
        setNow(Date.now() + offset.current);
        setLastSync(Date.now());
        setStale(false);
      } catch (e) {
        if (version !== refreshVersion.current) return;
        if ((e as { status?: number }).status === 401) {
          setDataReady(false);
          setRows([]);
          setTokens([]);
          setSecret("");
        } else {
          setStale(true);
          if (!quiet) setError((e as Error).message);
        }
      } finally {
        if (version === refreshVersion.current) setLoading(false);
      }
    },
    [configured],
  );
  useEffect(() => {
    setOrigin(location.origin);
    setNow(Date.now());
    const hash = location.hash.slice(1);
    if (navigation.some((n) => n.id === hash)) setTab(hash as Tab);
    const stored = localStorage.getItem("parking-theme") ?? "system";
    setTheme(stored);
    document.documentElement.dataset.theme = stored;
    try {
      const storedPending = JSON.parse(
        sessionStorage.getItem("parking-pending") ?? "null",
      );
      if (
        storedPending &&
        ["start", "stop"].includes(storedPending.action) &&
        typeof storedPending.key === "string"
      ) {
        setPending(storedPending);
        pendingRef.current = storedPending;
      }
    } catch {
      sessionStorage.removeItem("parking-pending");
    }
    const hashChange = () => {
      const hash = location.hash.slice(1);
      if (navigation.some((n) => n.id === hash)) setTab(hash as Tab);
    };
    window.addEventListener("hashchange", hashChange);
    return () => window.removeEventListener("hashchange", hashChange);
  }, []);
  useEffect(() => {
    void refresh();
    const timerId = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 30_000);
    const focus = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    const net = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void refresh(true);
      else setStale(true);
    };
    setOnline(navigator.onLine);
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      clearInterval(timerId);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [refresh]);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!selection && now) setSelection(bangkokDate(now).slice(0, 7));
  }, [now, selection]);
  useEffect(() => {
    if (tab !== "siri") setSecret("");
  }, [tab]);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  function go(next: Tab) {
    setTab(next);
    location.hash = next;
    setError("");
    setNotice("");
  }
  async function copy(value: string, id: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("คัดลอกไม่ได้ กรุณาเลือกและคัดลอกข้อความด้วยตนเอง");
    }
  }
  async function mutate(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function parking() {
    const action = pendingRef.current?.action ?? (active ? "stop" : "start");
    const operation = pendingRef.current ?? {
      action,
      key: crypto.randomUUID(),
      userId: userIdRef.current,
    };
    pendingRef.current = operation;
    setPending(operation);
    sessionStorage.setItem("parking-pending", JSON.stringify(operation));
    await mutate(async () => {
      const result = await request(`/api/parking/${operation.action}`, {
        method: "POST",
        headers: { "Idempotency-Key": operation.key },
      });
      pendingRef.current = null;
      setPending(null);
      sessionStorage.removeItem("parking-pending");
      setNotice(result.message ?? "บันทึกแล้ว");
      await refresh(true);
    });
  }
  function openAccount() {
    accountDialog.current?.showModal();
  }
  function chooseTheme(value: string) {
    setTheme(value);
    localStorage.setItem("parking-theme", value);
    document.documentElement.dataset.theme = value;
  }
  const active = rows.find((r) => !r.ended_at);
  const day = now ? bangkokDate(now) : "";
  const todayRows = rows.filter(
    (r) => r.ended_at && bangkokDate(r.started_at) === day,
  );
  const today = summarize(todayRows);
  const calculation = active
    ? calculateParking(
        active.started_at,
        now || active.started_at,
        active.free_minutes,
        active.hourly_rate_satang,
        active.billing_model,
      )
    : null;
  const digits = timer(calculation?.elapsedMs ?? 0);
  const paid = Boolean(calculation?.costSatang);
  const ready = configured && dataReady && !loading && online && !stale;
  const completed = rows.filter((r) => r.ended_at);
  const historyRows = completed.filter(
    (r) => !historyMonth || bangkokDate(r.started_at).startsWith(historyMonth),
  );
  const groups = Object.groupBy(historyRows.slice(0, visibleCount), (r) =>
    bangkokDate(r.started_at),
  );
  const filtered = completed.filter((r) =>
    bangkokDate(r.started_at).startsWith(selection),
  );
  const stats = summarize(filtered);
  const bucketLength = period === "year" ? 7 : 10;
  const buckets = Object.entries(
    Object.groupBy(filtered, (r) =>
      bangkokDate(r.started_at).slice(0, bucketLength),
    ),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      key,
      cost: (items ?? []).reduce((s, r) => s + (r.cost_satang ?? 0), 0),
    }));
  const maxCost = Math.max(1, ...buckets.map((b) => b.cost));
  const heading = {
    today: "เวลาจอดของคุณ",
    history: "ประวัติการจอด",
    stats: "สถิติการจอด",
    siri: "จอดรถด้วย Siri",
  }[tab];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        ข้ามไปเนื้อหา
      </a>
      <aside className="sidebar">
        <a className="brand" href="#today" onClick={() => go("today")}>
          <CarFront size={28} />
          <span>Parking Timer</span>
        </a>
        <nav aria-label="เมนูหลัก">
          {navigation.map(({ id, name, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon size={22} />
              <span>{name}</span>
              {tab === id && <ChevronRight size={16} className="nav-arrow" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="account-link" onClick={openAccount}>
            <Settings2 size={20} />
            <span>{"การตั้งค่า"}</span>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <a
            className="brand mobile-brand"
            href="#today"
            onClick={() => go("today")}
          >
            <CarFront size={25} />
            <span>Parking Timer</span>
          </a>
          <span className="desktop-date">
            {now ? dateLabel(now, true) : "Parking Timer"}
          </span>
          <div className="header-actions">
            {dataReady && (
              <span className="sync-label">
                <span className={`status-dot ${stale ? "warning" : ""}`} />
                {stale ? "รอยืนยันข้อมูล" : "อัปเดตแล้ว"}
              </span>
            )}
            <IconButton label="การตั้งค่า" onClick={openAccount}>
              <Settings2 size={21} />
            </IconButton>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1>{heading}</h1>
              {tab === "today" && now > 0 && <p>{dateLabel(now, true)}</p>}
            </div>
            {dataReady && (
              <IconButton
                label="อัปเดตข้อมูล"
                disabled={loading || busy}
                onClick={() => void refresh()}
              >
                <RefreshCw size={20} className={loading ? "spin" : ""} />
              </IconButton>
            )}
          </div>
          {!configured && (
            <div className="setup-banner">
              <div>
                <strong>เชื่อมต่อ Supabase เพื่อเริ่มใช้งาน</strong>
              </div>
              <button onClick={openAccount}>
                วิธีตั้งค่า <ArrowRight size={16} />
              </button>
            </div>
          )}
          {(!online || stale) && dataReady && (
            <div className="notice warning-notice" role="status">
              <WifiOff size={20} />
              <span>
                {!online
                  ? "ไม่มีอินเทอร์เน็ต ยังบันทึกการจอดไม่ได้"
                  : "ยังยืนยันสถานะล่าสุดไม่ได้ กรุณาอัปเดตข้อมูล"}
                {lastSync && ` · ข้อมูลเมื่อ ${clock(lastSync)} น.`}
              </span>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={20} />
              <span>{error}</span>
              <IconButton label="ปิดข้อความ" onClick={() => setError("")}>
                <X size={17} />
              </IconButton>
            </div>
          )}
          {notice && (
            <div className="notice success" role="status">
              <CheckCircle2 size={20} />
              <span>{notice}</span>
            </div>
          )}
          {loading && !rows.length ? (
            <div className="loading" role="status">
              <LoaderCircle className="spin" />
              <span>กำลังโหลดข้อมูลการจอด</span>
            </div>
          ) : (
            <>
              {tab === "today" && (
                <div className="dashboard-grid">
                  <section
                    className={`timer-panel ${paid ? "paid" : ""}`}
                    aria-labelledby="timer-heading"
                  >
                    <div className="timer-status">
                      <span
                        className={`badge ${active ? (paid ? "paid-badge" : "free-badge") : ""}`}
                      >
                        <span className="status-dot" />
                        {active
                          ? paid
                            ? "กำลังจอด · ช่วงคิดค่าจอด"
                            : "กำลังจอด · ช่วงจอดฟรี"
                          : "ยังไม่ได้เริ่มจอด"}
                      </span>
                    </div>
                    <h2 id="timer-heading" className="sr-only">
                      ระยะเวลาจอด
                    </h2>
                    <div
                      className="timer-digits"
                      role="timer"
                      aria-label={`ระยะเวลาจอด ${duration(calculation?.elapsedMs ?? 0)}`}
                      aria-live="off"
                    >
                      {digits.map((digit, i) => (
                        <span key={i}>
                          {digit}
                          {i < 2 && <b aria-hidden="true">:</b>}
                        </span>
                      ))}
                    </div>
                    <div className="timer-units" aria-hidden="true">
                      <span>ชั่วโมง</span>
                      <span>นาที</span>
                      <span>วินาที</span>
                    </div>
                    {active && (
                      <p className="started-at">
                        <Clock3 size={16} />
                        เริ่ม {dateLabel(active.started_at)} เวลา{" "}
                        {clock(active.started_at)} น.
                      </p>
                    )}
                    <div className="parking-price">
                      <div>
                        <span>ค่าจอด</span>
                        <strong>
                          {money(calculation?.costSatang ?? 0)}{" "}
                          <small>บาท</small>
                        </strong>
                      </div>
                      <div className="allowance">
                        <span>
                          {paid ? "เกินช่วงจอดฟรี" : "เวลาจอดฟรีที่เหลือ"}
                        </span>
                        <strong>
                          {active
                            ? paid
                              ? duration(
                                  Math.max(
                                    0,
                                    (calculation?.elapsedMs ?? 0) -
                                      active.free_minutes * 60000,
                                  ),
                                )
                              : `${Math.ceil((calculation?.freeRemainingMs ?? 0) / 60000)} นาที`
                            : "120 นาที"}
                        </strong>
                      </div>
                    </div>
                    <button
                      className={`primary parking-action ${active ? "stop-action" : ""}`}
                      disabled={!ready || busy}
                      onClick={() => void parking()}
                    >
                      {busy ? (
                        <LoaderCircle size={20} className="spin" />
                      ) : active ? (
                        <Square size={18} />
                      ) : (
                        <Play size={19} />
                      )}
                      <span>
                        {busy
                          ? "กำลังยืนยันการบันทึก…"
                          : pending
                            ? "ยืนยันคำสั่งเดิมอีกครั้ง"
                            : active
                              ? "สิ้นสุดการจอด"
                              : "เริ่มจอดรถ"}
                      </span>
                    </button>
                    {pending && (
                      <p className="pending-hint">
                        มีคำสั่ง
                        {pending.action === "start" ? "เริ่ม" : "สิ้นสุด"}
                        ที่ยังไม่ได้รับการยืนยัน กดเพื่อส่งคำขอเดิมอีกครั้ง
                      </p>
                    )}
                  </section>
                  <div className="today-side">
                    <section className="today-summary">
                      <h2>สรุปวันนี้</h2>
                      <dl className="summary-list">
                        <div>
                          <dt>
                            <Wallet size={19} />
                            ค่าใช้จ่ายรวม
                          </dt>
                          <dd>
                            {money(today.totalSatang)} <small>บาท</small>
                          </dd>
                        </div>
                        <div>
                          <dt>
                            <Clock3 size={19} />
                            เวลาจอดรวม
                          </dt>
                          <dd>{duration(today.totalMs)}</dd>
                        </div>
                        <div>
                          <dt>
                            <CarFront size={19} />
                            จำนวนครั้ง
                          </dt>
                          <dd>
                            {today.count} <small>ครั้ง</small>
                          </dd>
                        </div>
                      </dl>
                      {active && (
                        <p className="active-note">ยังไม่รวมรอบปัจจุบัน</p>
                      )}
                    </section>
                    <button className="siri-entry" onClick={() => go("siri")}>
                      <Mic size={23} />
                      <span>
                        <strong>บอก Siri แทนการกด</strong>
                        <small>“ฉันมาจอดรถแล้ว”</small>
                      </span>
                      <ChevronRight size={20} />
                    </button>
                    <section className="latest-section">
                      <div className="section-heading">
                        <h2>จอดล่าสุด</h2>
                        <button
                          className="text-button"
                          onClick={() => go("history")}
                        >
                          ดูทั้งหมด <ArrowRight size={15} />
                        </button>
                      </div>
                      {completed.length ? (
                        <div className="latest-row">
                          <div>
                            <strong>
                              {dateLabel(completed[0].started_at)}
                            </strong>
                            <p>
                              {clock(completed[0].started_at)} –{" "}
                              {clock(completed[0].ended_at!)} น.
                            </p>
                          </div>
                          <strong>
                            {money(completed[0].cost_satang ?? 0)}{" "}
                            <small>บาท</small>
                          </strong>
                        </div>
                      ) : (
                        <div className="small-empty">
                          <History size={23} />
                          <p>ประวัติจะปรากฏเมื่อสิ้นสุดการจอดครั้งแรก</p>
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}
              {tab === "history" && (
                <section>
                  <div className="toolbar">
                    <label className="field-inline">
                      เดือน{" "}
                      <input
                        aria-label="กรองประวัติตามเดือน"
                        type="month"
                        value={historyMonth}
                        onChange={(e) => {
                          setHistoryMonth(e.target.value);
                          setVisibleCount(20);
                        }}
                      />
                    </label>
                    {historyMonth && (
                      <button
                        className="text-button"
                        onClick={() => setHistoryMonth("")}
                      >
                        ดูทั้งหมด
                      </button>
                    )}
                    <span className="toolbar-total">
                      {historyRows.length} รายการ ·{" "}
                      {money(summarize(historyRows).totalSatang)} บาท
                    </span>
                  </div>
                  {!historyRows.length ? (
                    <Empty icon={History} title="ยังไม่มีประวัติการจอด">
                      {historyMonth
                        ? "ลองเลือกเดือนอื่น หรือดูประวัติทั้งหมด"
                        : "เมื่อสิ้นสุดการจอด รายการจะถูกเก็บไว้ที่นี่"}
                    </Empty>
                  ) : (
                    Object.entries(groups).map(([key, items]) => (
                      <section className="history-group" key={key}>
                        <h2>{dateLabel(`${key}T12:00:00+07:00`, true)}</h2>
                        <div className="history-table">
                          {items?.map((row) => (
                            <article className="history-row" key={row.id}>
                              <span className="row-symbol">
                                <CarFront size={21} />
                              </span>
                              <div className="history-time">
                                <strong>
                                  {clock(row.started_at)} –{" "}
                                  {clock(row.ended_at!)} น.
                                </strong>
                                <p>
                                  {duration(
                                    Date.parse(row.ended_at!) -
                                      Date.parse(row.started_at),
                                  )}
                                  {bangkokDate(row.started_at) !==
                                    bangkokDate(row.ended_at!) &&
                                    ` · ออก ${dateLabel(row.ended_at!)}`}
                                </p>
                              </div>
                              <div className="history-amount">
                                <strong>{money(row.cost_satang ?? 0)}</strong>
                                <small>บาท</small>
                              </div>
                              <div className="row-actions">
                                <IconButton
                                  label={`แก้ไขรายการ ${clock(row.started_at)}`}
                                  disabled={busy || !ready}
                                  onClick={() => {
                                    setEditing(row);
                                    setEditStart(localInput(row.started_at));
                                    setEditEnd(localInput(row.ended_at!));
                                    setEditError("");
                                    editDialog.current?.showModal();
                                  }}
                                >
                                  <Pencil size={17} />
                                </IconButton>
                                <IconButton
                                  label={`ลบรายการ ${clock(row.started_at)}`}
                                  disabled={busy || !ready}
                                  onClick={() => {
                                    setDeleting(row);
                                    deleteDialog.current?.showModal();
                                  }}
                                >
                                  <Trash2 size={17} />
                                </IconButton>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    ))
                  )}
                  {historyRows.length > visibleCount && (
                    <button
                      className="secondary load-more"
                      onClick={() => setVisibleCount((c) => c + 20)}
                    >
                      แสดงเพิ่มอีก 20 รายการ
                    </button>
                  )}
                </section>
              )}
              {tab === "stats" && (
                <section>
                  <div className="stats-controls">
                    <div className="segmented" aria-label="ช่วงเวลาของสถิติ">
                      {(["day", "month", "year"] as const).map((p, i) => (
                        <button
                          key={p}
                          aria-pressed={period === p}
                          onClick={() => {
                            setPeriod(p);
                            setSelection(
                              day.slice(
                                0,
                                p === "day" ? 10 : p === "month" ? 7 : 4,
                              ),
                            );
                          }}
                        >
                          {["รายวัน", "รายเดือน", "รายปี"][i]}
                        </button>
                      ))}
                    </div>
                    <label className="field-inline">
                      <span className="sr-only">เลือกช่วงเวลา</span>
                      <input
                        aria-label="เลือกช่วงเวลาสถิติ"
                        type={
                          period === "day"
                            ? "date"
                            : period === "month"
                              ? "month"
                              : "number"
                        }
                        min={period === "year" ? "2000" : undefined}
                        max={period === "year" ? "9999" : undefined}
                        value={selection}
                        onChange={(e) => setSelection(e.target.value)}
                      />
                    </label>
                  </div>
                  <dl className="stats-overview">
                    <div>
                      <dt>ค่าใช้จ่ายรวม</dt>
                      <dd>
                        {money(stats.totalSatang)} <small>บาท</small>
                      </dd>
                    </div>
                    <div>
                      <dt>เวลาจอดรวม</dt>
                      <dd>{duration(stats.totalMs)}</dd>
                    </div>
                    <div>
                      <dt>จำนวนครั้ง</dt>
                      <dd>
                        {stats.count} <small>ครั้ง</small>
                      </dd>
                    </div>
                  </dl>
                  <section className="chart-panel">
                    <div className="section-heading">
                      <h2>
                        ค่าใช้จ่าย
                        {period === "year" ? "แต่ละเดือน" : "แต่ละวัน"}
                      </h2>
                      <span className="section-note">บาท</span>
                    </div>
                    {!filtered.length ? (
                      <Empty
                        icon={ChartNoAxesColumnIncreasing}
                        title="ยังไม่มีข้อมูลในช่วงนี้"
                      >
                        เลือกช่วงเวลาอื่น หรือเริ่มบันทึกการจอดครั้งแรก
                      </Empty>
                    ) : (
                      <>
                        <div
                          className="bar-chart"
                          role="img"
                          aria-label={`กราฟค่าใช้จ่าย รวม ${money(stats.totalSatang)} บาท ดูรายละเอียดในตารางด้านล่าง`}
                        >
                          <div className="chart-axis">
                            <span>{money(maxCost)}</span>
                            <span>0</span>
                          </div>
                          <div className="chart-bars">
                            {buckets.map((b) => (
                              <div className="bar-column" key={b.key}>
                                <div className="bar-area">
                                  <div
                                    className="bar"
                                    style={{
                                      height: `${(b.cost / maxCost) * 100}%`,
                                    }}
                                    title={`${b.key}: ${money(b.cost)} บาท`}
                                  />
                                </div>
                                <span>
                                  {period === "year"
                                    ? b.key.slice(5)
                                    : b.key.slice(8)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <details className="chart-details">
                          <summary>ดูข้อมูลกราฟเป็นตาราง</summary>
                          <table>
                            <thead>
                              <tr>
                                <th>
                                  {period === "year" ? "เดือน" : "วันที่"}
                                </th>
                                <th>ค่าใช้จ่าย (บาท)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {buckets.map((b) => (
                                <tr key={b.key}>
                                  <td>{b.key}</td>
                                  <td>{money(b.cost)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      </>
                    )}
                  </section>
                  <dl className="average-list">
                    <div>
                      <dt>เวลาจอดเฉลี่ยต่อครั้ง</dt>
                      <dd>{duration(stats.averageMs)}</dd>
                    </div>
                    <div>
                      <dt>ค่าใช้จ่ายเฉลี่ยต่อครั้ง</dt>
                      <dd>{money(stats.averageSatang)} บาท</dd>
                    </div>
                    <div>
                      <dt>
                        ค่าใช้จ่ายเฉลี่ยต่อวันที่มีการจอด
                        <small>เฉลี่ยจาก {stats.days} วัน</small>
                      </dt>
                      <dd>{money(stats.averageDailySatang)} บาท</dd>
                    </div>
                  </dl>
                </section>
              )}
              {tab === "siri" && (
                <div className="siri-layout">
                  <section>
                    <div className="siri-intro">
                      <p>
                        สร้างคำสั่งในแอป Shortcuts บน iPhone
                        แล้วเรียกชื่อคำสั่งผ่าน Siri
                      </p>
                    </div>
                    <section className="token-section">
                      <div className="section-heading">
                        <h2>โทเคนสำหรับ Shortcuts</h2>
                        <KeyRound size={20} />
                      </div>
                      <p>ใช้แทนรหัสผ่านสำหรับคำสั่งจอดรถเท่านั้น</p>
                      <button
                        className="primary"
                        disabled={!ready || busy}
                        onClick={() =>
                          void mutate(async () => {
                            const data = await request("/api/tokens", {
                              method: "POST",
                            });
                            setSecret(data.token ?? "");
                            setNotice(data.message ?? "");
                            await refresh(true);
                          })
                        }
                      >
                        {busy ? (
                          <LoaderCircle size={18} className="spin" />
                        ) : (
                          <KeyRound size={18} />
                        )}
                        สร้างโทเคน
                      </button>
                      {secret && (
                        <div className="secret-box">
                          <strong>คัดลอกตอนนี้ โทเคนจะแสดงเฉพาะครั้งนี้</strong>
                          <code>{secret}</code>
                          <button
                            className="secondary"
                            onClick={() => void copy(secret, "secret")}
                          >
                            {copied === "secret" ? (
                              <Check size={17} />
                            ) : (
                              <Copy size={17} />
                            )}
                            คัดลอกโทเคน
                          </button>
                        </div>
                      )}
                      <div className="tokens">
                        {tokens
                          .filter((t) => !t.revoked_at)
                          .map((t) => (
                            <div className="token-row" key={t.id}>
                              <div>
                                <strong>{t.name}</strong>
                                <code>{t.prefix}…</code>
                                <small>
                                  {t.last_used_at
                                    ? `ได้รับคำสั่งแล้ว ${dateLabel(t.last_used_at)} ${clock(t.last_used_at)} น.`
                                    : "ยังไม่ได้รับคำสั่งทดสอบ"}
                                </small>
                              </div>
                              <button
                                className="text-button danger-text"
                                disabled={busy || !ready}
                                onClick={() =>
                                  void mutate(async () => {
                                    const result = await request(
                                      `/api/tokens/${t.id}`,
                                      { method: "DELETE" },
                                    );
                                    setSecret("");
                                    setNotice(result.message ?? "");
                                    await refresh(true);
                                  })
                                }
                              >
                                เพิกถอน
                              </button>
                            </div>
                          ))}
                      </div>
                    </section>
                    <div className="install-note">
                      <Download size={21} />
                      <div>
                        <strong>เพิ่มเว็บไว้บน Home Screen</strong>
                        <p>ใน Safari กดแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”</p>
                      </div>
                    </div>
                  </section>
                  <section className="shortcut-guide">
                    <h2>ตั้งค่าคำสั่งเสียง</h2>
                    <p>
                      เว็บต้องเปิดผ่าน HTTPS และเชื่อม Supabase ก่อนทดสอบบน
                      iPhone
                    </p>
                    {[
                      {
                        action: "start",
                        name: "ฉันมาจอดรถแล้ว",
                        method: "POST",
                      },
                      {
                        action: "stop",
                        name: "ออกจากที่จอดรถแล้ว",
                        method: "POST",
                      },
                      {
                        action: "status",
                        name: "ค่าจอดรถเท่าไหร่",
                        method: "GET",
                      },
                    ].map((shortcut, i) => (
                      <details key={shortcut.action} open={i === 0}>
                        <summary>
                          <span className="step-number">{i + 1}</span>
                          <span>“{shortcut.name}”</span>
                          <ChevronRight size={18} />
                        </summary>
                        <div className="guide-content">
                          <ol>
                            <li>
                              เปิด Shortcuts สร้างคำสั่งใหม่ ตั้งชื่อ “
                              {shortcut.name}”
                            </li>
                            {shortcut.method === "POST" && (
                              <li>
                                เพิ่ม Generate UUID เก็บค่าไว้ในตัวแปร Request
                                ID หนึ่งค่าต่อการเรียก
                              </li>
                            )}
                            <li>
                              เพิ่ม Get Contents of URL ใช้ URL นี้
                              <div className="copy-field">
                                <code>
                                  {origin}/api/parking/{shortcut.action}
                                </code>
                                <IconButton
                                  label={`คัดลอก URL ${shortcut.action}`}
                                  onClick={() =>
                                    void copy(
                                      `${origin}/api/parking/${shortcut.action}`,
                                      shortcut.action,
                                    )
                                  }
                                >
                                  {copied === shortcut.action ? (
                                    <Check size={17} />
                                  ) : (
                                    <Copy size={17} />
                                  )}
                                </IconButton>
                              </div>
                            </li>
                            <li>
                              ตั้ง Method เป็น <code>{shortcut.method}</code>{" "}
                              และเพิ่ม Headers:
                              <pre>
                                Authorization: Bearer [โทเคนของคุณ]
                                {shortcut.method === "POST"
                                  ? "\nIdempotency-Key: [ตัวแปร Request ID]"
                                  : ""}
                              </pre>
                              {shortcut.method === "POST" &&
                                "ไม่ต้องส่ง Request Body หากส่งซ้ำให้ใช้ Request ID เดิม"}
                            </li>
                            <li>
                              เพิ่ม Get Dictionary Value เลือกฟิลด์{" "}
                              <code>ok</code> ถ้าเป็น true ให้อ่าน{" "}
                              <code>message</code> ด้วย Speak Text
                            </li>
                            <li>
                              ถ้า ok ไม่เป็น true หรือไม่ได้รับข้อมูล ให้พูด
                              “ยังยืนยันการบันทึกไม่ได้ กรุณาตรวจสอบในเว็บ”
                            </li>
                          </ol>
                          <p>
                            ทดสอบด้วยปุ่มเล่นก่อน แล้วเรียก Siri ด้วยชื่อคำสั่ง
                            หากเครือข่ายทำให้ Shortcut หยุด ให้เปิดเว็บตรวจสถานะ
                            การใช้งานขณะล็อกเครื่องอาจต้องปลดล็อกก่อน
                          </p>
                        </div>
                      </details>
                    ))}
                    <a
                      className="external-link"
                      href="https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios"
                      target="_blank"
                      rel="noreferrer"
                    >
                      คู่มือ Web API ของ Apple <ExternalLink size={15} />
                    </a>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="เมนูบนมือถือ">
        {navigation.map(({ id, name, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => go(id)}
          >
            <Icon size={23} />
            <span>{name}</span>
          </a>
        ))}
      </nav>
      <dialog
        ref={accountDialog}
        className="dialog account-dialog"
        aria-labelledby="account-title"
        onCancel={() => setSecret("")}
      >
        <div className="dialog-heading">
          <h2 id="account-title">
            {configured ? "การตั้งค่า" : "ตั้งค่าก่อนเริ่มใช้งาน"}
          </h2>
          <IconButton
            label="ปิดหน้าต่าง"
            onClick={() => accountDialog.current?.close()}
          >
            <X size={21} />
          </IconButton>
        </div>
        {!configured && (
          <div className="setup-instructions">
            <p>เชื่อมต่อฐานข้อมูลตาม README.md ของโปรเจกต์</p>
            <ol>
              <li>สร้างโปรเจกต์ Supabase และรัน migration ตามลำดับ</li>
              <li>
                คัดลอก .env.example เป็น .env.local แล้วกรอก URL, service role
                key และ APP_ORIGIN
              </li>
              <li>เปิดแอปใหม่ ใช้งานได้ทันทีโดยไม่ต้องสร้างบัญชี</li>
            </ol>
            <p>เก็บ service role key ไว้บนเซิร์ฟเวอร์เท่านั้น</p>
          </div>
        )}
        <section className="theme-section">
          <h3>การแสดงผล</h3>
          <div className="theme-options">
            {[
              { value: "light", label: "สว่าง", icon: Sun },
              { value: "dark", label: "มืด", icon: Moon },
              { value: "system", label: "ตามเครื่อง", icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                aria-pressed={theme === value}
                onClick={() => chooseTheme(value)}
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </div>
        </section>
      </dialog>
      <dialog ref={editDialog} className="dialog" aria-labelledby="edit-title">
        <div className="dialog-heading">
          <h2 id="edit-title">แก้ไขเวลาจอด</h2>
          <IconButton
            label="ปิดหน้าต่างแก้ไข"
            disabled={busy}
            onClick={() => editDialog.current?.close()}
          >
            <X size={21} />
          </IconButton>
        </div>
        <form
          className="edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            setEditError("");
            if (!editing) return;
            void mutate(async () => {
              try {
                const start = fromBangkokInput(editStart),
                  end = fromBangkokInput(editEnd);
                if (Date.parse(end) < Date.parse(start))
                  throw new Error("เวลาออกต้องไม่ก่อนเวลาเข้า");
                if (Date.parse(end) > now)
                  throw new Error("เวลาออกต้องไม่เกินเวลาปัจจุบัน");
                const result = await request(`/api/history/${editing.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ started_at: start, ended_at: end }),
                });
                editDialog.current?.close();
                setNotice(result.message ?? "");
                await refresh(true);
              } catch (e) {
                setEditError((e as Error).message);
              }
            });
          }}
        >
          <p>วันและเวลาประเทศไทย ค่าจอดจะคำนวณใหม่</p>
          <label>
            เวลาเข้า
            <input
              type="datetime-local"
              step="0.001"
              value={editStart}
              onChange={(e) => setEditStart(e.target.value)}
              required
            />
          </label>
          <label>
            เวลาออก
            <input
              type="datetime-local"
              step="0.001"
              value={editEnd}
              onChange={(e) => setEditEnd(e.target.value)}
              required
            />
          </label>
          {editError && (
            <p className="form-error" role="alert">
              {editError}
            </p>
          )}
          <button className="primary" disabled={busy || !online}>
            {busy ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
          </button>
        </form>
      </dialog>
      <dialog
        ref={deleteDialog}
        className="dialog"
        aria-labelledby="delete-title"
      >
        <div className="dialog-heading">
          <h2 id="delete-title">ลบรายการจอดนี้?</h2>
          <IconButton
            label="ยกเลิกการลบ"
            disabled={busy}
            onClick={() => deleteDialog.current?.close()}
          >
            <X size={21} />
          </IconButton>
        </div>
        <p>
          {deleting &&
            `${dateLabel(deleting.started_at)} เวลา ${clock(deleting.started_at)} น.`}
        </p>
        <p>รายการและค่าใช้จ่ายนี้จะถูกนำออกจากสถิติ และกู้คืนไม่ได้</p>
        <div className="dialog-actions">
          <button
            className="secondary"
            disabled={busy}
            onClick={() => deleteDialog.current?.close()}
          >
            ยกเลิก
          </button>
          <button
            className="primary"
            disabled={busy || !online}
            onClick={() =>
              void mutate(async () => {
                if (!deleting) return;
                const result = await request(`/api/history/${deleting.id}`, {
                  method: "DELETE",
                });
                deleteDialog.current?.close();
                setNotice(result.message ?? "");
                await refresh(true);
              })
            }
          >
            {busy ? "กำลังลบ…" : "ลบรายการ"}
          </button>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </dialog>
    </div>
  );
}
