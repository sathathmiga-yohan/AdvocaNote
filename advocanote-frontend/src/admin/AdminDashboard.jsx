
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  UsersRound,
  UserCheck,
  Crown,
  Wallet,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  CalendarDays,
  Clock3,
  AlertCircle,
  ShieldCheck,
  Bell,
  Search,
} from "lucide-react";

import "./AdminDashboard.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

const NUMBER_FORMAT = new Intl.NumberFormat("en-LK");

const CHART_COLORS = [
  "#07533d",
  "#d4ac60",
  "#8fbba7",
  "#dce8df",
  "#90a7a0",
];

const PERIOD_OPTIONS = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "12m", label: "12 Months" },
];

function formatCount(value) {
  if (value === null || value === undefined) return "—";

  const number = Number(value);

  return Number.isFinite(number)
    ? NUMBER_FORMAT.format(number)
    : "—";
}

function formatMoney(amountMinor, currency = "LKR") {
  if (amountMinor === null || amountMinor === undefined) {
    return "—";
  }

  const number = Number(amountMinor);

  if (!Number.isFinite(number)) return "—";

  try {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(number / 100);
  } catch {
    return "—";
  }
}

function compactMoney(amountMinor) {
  const value = Number(amountMinor) / 100;

  if (!Number.isFinite(value)) return "—";

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }

  return `${Math.round(value)}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(name) {
  const letters = String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return letters || "L";
}

function StatusBadge({ status }) {
  const text = String(status || "unknown");
  const key = text
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

  return (
    <span className={`adash-status adash-status--${key}`}>
      <span className="adash-status-dot" />
      {text.replaceAll("_", " ")}
    </span>
  );
}

function buildChart(series) {
  const raw = Array.isArray(series) ? series : [];

  const values = raw
    .map((entry) => ({
      label: String(entry.label || ""),
      value: Number(entry.amount_minor),
    }))
    .filter(
      (entry) =>
        Number.isFinite(entry.value) &&
        entry.value >= 0
    );

  if (values.length === 0) return null;

  const W = 840;
  const H = 270;
  const left = 58;
  const right = 18;
  const top = 20;
  const bottom = 37;

  const bottomY = H - bottom;
  const graphHeight = bottomY - top;
  const graphWidth = W - left - right;

  const highest = Math.max(...values.map((v) => v.value));
  const ceiling = Math.max(highest, 1);

  const points = values.map((item, index) => {
    const x =
      left +
      (values.length === 1
        ? graphWidth / 2
        : (index / (values.length - 1)) * graphWidth);

    const y =
      bottomY - (item.value / ceiling) * graphHeight;

    return {
      ...item,
      x,
      y,
    };
  });

  let linePath = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];

    const distance = current.x - previous.x;

    linePath += [
      "C",
      previous.x + distance * 0.45,
      previous.y,
      current.x - distance * 0.45,
      current.y,
      current.x,
      current.y,
    ].join(" ");
  }

  const areaPath = [
    linePath,
    `L ${points[points.length - 1].x} ${bottomY}`,
    `L ${points[0].x} ${bottomY}`,
    "Z",
  ].join(" ");

  return {
    W,
    H,
    left,
    right,
    top,
    bottomY,
    graphWidth,
    graphHeight,
    ceiling,
    points,
    linePath,
    areaPath,
    hasRevenue: highest > 0,
  };
}

function RevenueChart({ series }) {
  const chart = useMemo(
    () => buildChart(series),
    [series]
  );

  if (!chart || !chart.hasRevenue) {
    return (
      <div className="adash-chart-empty">
        <div className="adash-chart-empty-icon">
          <TrendingUp size={28} />
        </div>
        <strong>No revenue data yet</strong>
        <p>
          Verified payments will appear in this chart
          once transactions are recorded.
        </p>
      </div>
    );
  }

  const steps = 4;
  const showEvery = Math.max(
    1,
    Math.ceil(chart.points.length / 6)
  );

  return (
    <div className="adash-chart-wrap">
      <svg
        className="adash-chart-svg"
        viewBox={`0 0 ${chart.W} ${chart.H}`}
        role="img"
        aria-label="Revenue trend based on actual payment data"
      >
        <defs>
          <linearGradient
            id="adash-chart-gradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#0b7b58"
              stopOpacity="0.24"
            />
            <stop
              offset="100%"
              stopColor="#0b7b58"
              stopOpacity="0.015"
            />
          </linearGradient>
        </defs>

        {Array.from({ length: steps + 1 }).map(
          (_, index) => {
            const y =
              chart.top +
              (index / steps) * chart.graphHeight;

            const value =
              chart.ceiling * (1 - index / steps);

            return (
              <g key={index}>
                <line
                  x1={chart.left}
                  y1={y}
                  x2={chart.W - chart.right}
                  y2={y}
                  stroke="#e8eee9"
                  strokeDasharray="4 6"
                />

                <text
                  x={chart.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#93a29b"
                >
                  {compactMoney(value)}
                </text>
              </g>
            );
          }
        )}

        <path
          d={chart.areaPath}
          fill="url(#adash-chart-gradient)"
        />

        <path
          d={chart.linePath}
          fill="none"
          stroke="#08764f"
          strokeWidth="3.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {chart.points.map((point, index) => (
          <g key={index}>
            {(index % showEvery === 0 ||
              index === chart.points.length - 1) && (
                <text
                  x={point.x}
                  y={chart.H - 11}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#84988d"
                >
                  {point.label}
                </text>
              )}

            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#fff"
              stroke="#08764f"
              strokeWidth="2"
            >
              <title>
                {`${point.label}: ${formatMoney(
                  point.value
                )}`}
              </title>
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
}


function adaptSubscriptionOverview(overview, period) {
  if (
    !overview ||
    !Array.isArray(overview.lawyers) ||
    !Array.isArray(overview.plans) ||
    !Array.isArray(overview.payments)
  ) {
    throw new Error(
      "Invalid Admin Subscription Overview response."
    );
  }

  const { lawyers, plans, payments } = overview;

  const planMap = new Map(
    plans.map((plan) => [Number(plan.id), plan])
  );

  const lawyerMap = new Map(
    lawyers.map((lawyer) => [Number(lawyer.id), lawyer])
  );

  // Convert database LKR amounts into minor units
  // expected by the existing Dashboard chart.

  const moneyMinor = (payment) => {
    const value =
      payment.amount != null
        ? Number(payment.amount) * 100
        : Number(payment.amount_minor);

    return Number.isFinite(value)
      ? Math.round(value)
      : null;
  };

  const localDateKey = (date) =>
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

  // Generate chart periods.

  const buckets = new Map();
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  if (period === "12m") {
    for (let i = 11; i >= 0; i--) {
      const day = new Date(
        today.getFullYear(),
        today.getMonth() - i,
        1
      );

      buckets.set(localDateKey(day).slice(0, 7), {
        label: day.toLocaleDateString("en-GB", {
          month: "short",
          year: "2-digit",
        }),
        amount_minor: 0,
      });
    }
  } else {
    const days = period === "7d" ? 7 : 30;

    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);

      buckets.set(localDateKey(day), {
        label: day.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        }),
        amount_minor: 0,
      });
    }
  }

  // Count only paid LKR transactions.

  for (const payment of payments) {
    const status = String(
      payment.status || ""
    ).toLowerCase();

    if (
      !["paid", "succeeded"].includes(status) ||
      String(payment.currency).toUpperCase() !== "LKR"
    ) {
      continue;
    }

    const amount = moneyMinor(payment);
    const rawDate = payment.paid_at || payment.created_at;

    if (amount === null || !rawDate) continue;

    const textDate = String(rawDate);

    const parsed = new Date(
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(textDate)
        ? textDate
        : `${textDate}Z`
    );

    if (Number.isNaN(parsed.getTime())) continue;

    const dayKey = localDateKey(parsed);

    const key =
      period === "12m"
        ? dayKey.slice(0, 7)
        : dayKey;

    if (buckets.has(key)) {
      buckets.get(key).amount_minor += amount;
    }
  }

  const revenue_series = [...buckets.values()];

  // Subscription plan distribution.

  const subscriptionCount = new Map();
  let paidSubscriberCount = 0;

  for (const lawyer of lawyers) {
    const subscription = lawyer.subscription;

    if (subscription?.status !== "active") {
      continue;
    }

    paidSubscriberCount += 1;

    const planId = Number(subscription.plan_id);

    subscriptionCount.set(
      planId,
      (subscriptionCount.get(planId) || 0) + 1
    );
  }

  const plan_breakdown = [...subscriptionCount].map(
    ([planId, count]) => ({
      id: planId,
      name:
        planMap.get(planId)?.name ||
        `Plan #${planId}`,
      count,
    })
  );

  // Do not assume missing account status means active.

  const allStatusesKnown = lawyers.every(
    (lawyer) => typeof lawyer.is_active === "boolean"
  );

  return {
    payments_enabled: overview.payments_enabled !== false,

    summary: {
      total_lawyers: lawyers.length,

      active_lawyers: allStatusesKnown
        ? lawyers.filter((lawyer) => lawyer.is_active).length
        : null,

      paid_subscribers: paidSubscriberCount,

      collected_revenue_minor:
        revenue_series.reduce(
          (total, row) => total + row.amount_minor,
          0
        ),
    },

    revenue_series,
    plan_breakdown,

    recent_payments: payments
      .slice(0, 10)
      .map((payment) => {
        const lawyer = lawyerMap.get(
          Number(payment.user_id)
        );

        return {
          ...payment,
          lawyer_name:
            lawyer?.full_name || "Lawyer",

          lawyer_email:
            payment.lawyer_email ||
            lawyer?.email ||
            "",

          plan_name:
            payment.plan_name ||
            planMap.get(Number(payment.plan_id))?.name ||
            "—",

          amount_minor: moneyMinor(payment),
        };
      }),

    recent_lawyers: lawyers.slice(0, 5),
  };
}


export default function AdminDashboard() {
  const [period, setPeriod] = useState("30d");
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setLoading(true);
      setError("");
      setData(null);

      const token = sessionStorage.getItem(
        "advocanote_access_token"
      );

      if (!token) {
        setError("Please log in as an administrator.");
        setLoading(false);
        return;
      }

      try {

        const url = new URL(
          `${API_URL}/admin/subscriptions/overview`
        );


        url.searchParams.set("period", period);

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (response.status === 401) {
          throw new Error(
            "Your session has expired. Please log in again."
          );
        }

        if (response.status === 403) {
          throw new Error("Admin access is required.");
        }

        if (!response.ok) {
          throw new Error(
            `Dashboard API unavailable (${response.status}).`
          );
        }


        const overview = await response.json();

        const result = adaptSubscriptionOverview(
          overview,
          period
        );


        if (
          !result ||
          typeof result.summary !== "object" ||
          !Array.isArray(result.revenue_series) ||
          !Array.isArray(result.plan_breakdown) ||
          !Array.isArray(result.recent_payments) ||
          !Array.isArray(result.recent_lawyers)
        ) {
          throw new Error(
            "The dashboard API returned an invalid response."
          );
        }

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (err.name === "AbortError") return;

        setError(
          err.message || "Could not load dashboard data."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => controller.abort();
  }, [period, refreshKey]);

  const summary = data?.summary || {};

  const metrics = [
    {
      title: "Registered Lawyers",
      value: formatCount(summary.total_lawyers),
      caption: "Total lawyer accounts",
      icon: UsersRound,
      color: "green",
    },
    {
      title: "Active Accounts",
      value: formatCount(summary.active_lawyers),
      caption: "Currently enabled accounts",
      icon: UserCheck,
      color: "gold",
    },
    {
      title: "Paid Subscribers",
      value: formatCount(summary.paid_subscribers),
      caption: "Verified active paid plans",
      icon: Crown,
      color: "green",
    },
    {
      title: "Collected Revenue",
      value:
        data?.payments_enabled === false
          ? "Unavailable"
          : formatMoney(
            summary.collected_revenue_minor
          ),
      caption: "Successful payments in selected period",
      icon: Wallet,
      color: "gold",
    },
  ];

  const breakdown = Array.isArray(data?.plan_breakdown)
    ? data.plan_breakdown
    : [];

  const validBreakdown = breakdown.filter(
    (item) =>
      Number.isFinite(Number(item.count)) &&
      Number(item.count) > 0
  );

  const totalSubscriptions = validBreakdown.reduce(
    (sum, item) => sum + Number(item.count),
    0
  );

  let offset = 0;

  const donutParts = validBreakdown.map(
    (item, index) => {
      const percent =
        (Number(item.count) / totalSubscriptions) * 100;

      const from = offset;
      const to = offset + percent;
      offset = to;

      return {
        ...item,
        percent,
        color:
          CHART_COLORS[index % CHART_COLORS.length],
        from,
        to,
      };
    }
  );

  const donutBackground =
    totalSubscriptions > 0
      ? `conic-gradient(${donutParts
        .map(
          (part) =>
            `${part.color} ${part.from}% ${part.to}%`
        )
        .join(", ")})`
      : undefined;

  const payments = Array.isArray(data?.recent_payments)
    ? data.recent_payments
    : [];

  const filteredPayments = payments.filter((payment) =>
    [
      payment.id,
      payment.lawyer_name,
      payment.lawyer_email,
      payment.plan_name,
    ]
      .join(" ")
      .toLowerCase()
      .includes(paymentSearch.trim().toLowerCase())
  );

  const lawyers = Array.isArray(data?.recent_lawyers)
    ? data.recent_lawyers
    : [];

  return (
    <main className="adash-page">

      {/* WELCOME AREA */}

      <section className="adash-welcome">
        <div>
          <div className="adash-eyebrow">
            <span className="adash-live-dot" />
            ADVOCANOTE ADMIN OVERVIEW
          </div>

          <h1>
            Welcome back, <span>Admin.</span>
          </h1>

          <p>
            Your legal platform at a glance.
            Monitor lawyers, subscriptions and payments
            from one place.
          </p>
        </div>

        <div className="adash-welcome-actions">
          <span className="adash-current-date">
            <CalendarDays size={16} />
            {new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>

          <button
            type="button"
            className="adash-refresh"
            onClick={() => setRefreshKey((v) => v + 1)}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "adash-spinning" : ""}
            />
            Refresh
          </button>
        </div>
      </section>

      {/* API ERROR */}

      {error && !loading && (
        <div className="adash-alert" role="alert">
          <AlertCircle size={19} />

          <div>
            <strong>Live data is unavailable</strong>
            <p>{error}</p>
          </div>

          <button
            type="button"
            onClick={() => setRefreshKey((v) => v + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {/* STATISTICS */}

      <section className="adash-metrics">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.title}
              className="adash-metric-card"
            >
              <div className="adash-metric-top">
                <div
                  className={
                    `adash-metric-icon adash-icon-${metric.color}`
                  }
                >
                  <Icon size={22} strokeWidth={1.9} />
                </div>

                <span className="adash-metric-decoration">
                  <ArrowUpRight size={18} />
                </span>
              </div>

              <span className="adash-metric-title">
                {metric.title}
              </span>

              <strong className="adash-metric-value">
                {loading ? "—" : metric.value}
              </strong>

              <span className="adash-metric-caption">
                {metric.caption}
              </span>
            </article>
          );
        })}
      </section>

      {/* ANALYTICS AREA */}

      <section className="adash-analytics-grid">

        {/* REVENUE CHART */}

        <article className="adash-card adash-revenue-card">
          <div className="adash-card-header">
            <div>
              <span className="adash-section-eyebrow">
                PERFORMANCE
              </span>

              <h2>Revenue Analytics</h2>
              <p>Confirmed payment revenue over time</p>
            </div>

            <div className="adash-period-controls">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={
                    period === option.value ? "active" : ""
                  }
                  aria-pressed={period === option.value}
                  onClick={() => setPeriod(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="adash-revenue-overview">
            <div>
              <span className="adash-muted-label">
                Total collected in selected period
              </span>

              <div className="adash-revenue-number">
                {loading
                  ? "—"
                  : data?.payments_enabled === false
                    ? "Not configured"
                    : formatMoney(
                      summary.collected_revenue_minor
                    )}
              </div>
            </div>

            <div className="adash-chart-legend">
              <span />
              Successful payments
            </div>
          </div>

          {loading ? (
            <div className="adash-chart-loading">
              Loading analytics...
            </div>
          ) : (
            <RevenueChart
              series={data?.revenue_series || []}
            />
          )}

          <div className="adash-chart-footnote">
            <ShieldCheck size={15} />
            Payment revenue is not the same as bank payouts.
          </div>
        </article>

        {/* RIGHT PANELS */}

        <div className="adash-side-panels">

          {/* SUBSCRIPTION BREAKDOWN */}

          <article className="adash-card adash-breakdown-card">
            <div className="adash-card-header">
              <div>
                <span className="adash-section-eyebrow">
                  MEMBERSHIP
                </span>
                <h2>Plan Distribution</h2>
              </div>

              <div className="adash-small-icon">
                <Crown size={17} />
              </div>
            </div>

            <div className="adash-donut-layout">
              <div
                className="adash-donut"
                style={
                  donutBackground
                    ? { background: donutBackground }
                    : undefined
                }
              >
                <div className="adash-donut-inner">
                  <strong>
                    {loading
                      ? "—"
                      : formatCount(totalSubscriptions)}
                  </strong>
                  <span>Subscriptions</span>
                </div>
              </div>

              <div className="adash-donut-legend">
                {donutParts.length === 0 ? (
                  <p className="adash-empty-mini">
                    No subscription records yet.
                  </p>
                ) : (
                  donutParts.map((part, index) => (
                    <div
                      className="adash-legend-item"
                      key={part.id || index}
                    >
                      <span
                        className="adash-legend-color"
                        style={{ background: part.color }}
                      />
                      <span className="adash-legend-name">
                        {part.name}
                      </span>
                      <strong>{part.count}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Link
              to="/admin/subscriptions"
              className="adash-text-link"
            >
              Manage Subscriptions
              <ArrowRight size={15} />
            </Link>
          </article>

          {/* QUICK ACCESS */}

          <article className="adash-quick-card">
            <div className="adash-quick-heading">
              <div className="adash-quick-symbol">
                <TrendingUp size={22} />
              </div>
              <span>PLATFORM MANAGEMENT</span>
            </div>

            <h3>
              Everything in one
              <br />
              secure workspace.
            </h3>

            <p>
              Manage your growing legal community
              without accessing confidential case records.
            </p>

            <Link
              to="/admin/lawyers"
              className="adash-quick-button"
            >
              View Lawyers
              <ArrowUpRight size={17} />
            </Link>

            <div className="adash-quick-decoration" />
          </article>
        </div>
      </section>

      {/* BOTTOM TABLES */}

      <section className="adash-bottom-grid">

        {/* RECENT PAYMENTS */}

        <article className="adash-card adash-table-card">
          <div className="adash-card-header">
            <div>
              <span className="adash-section-eyebrow">
                BILLING ACTIVITY
              </span>
              <h2>Recent Transactions</h2>
              <p>Latest recorded payment transactions</p>
            </div>

            <Link
              to="/admin/subscriptions"
              className="adash-header-link"
            >
              View All
              <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="adash-table-toolbar">
            <div className="adash-table-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search transactions..."
                aria-label="Search transactions"
                value={paymentSearch}
                onChange={(e) =>
                  setPaymentSearch(e.target.value)
                }
              />
            </div>
          </div>

          <div className="adash-table-scroll">
            <table className="adash-table">
              <thead>
                <tr>
                  <th>Lawyer</th>
                  <th>Plan</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {!loading && filteredPayments.length > 0 ? (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <div className="adash-person">
                          <div className="adash-avatar">
                            {initials(payment.lawyer_name)}
                          </div>

                          <div>
                            <strong>
                              {payment.lawyer_name || "—"}
                            </strong>
                            <small>
                              {payment.lawyer_email || "—"}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        {payment.plan_name || "—"}
                      </td>

                      <td>
                        {formatDate(payment.created_at)}
                      </td>

                      <td className="adash-amount">
                        {formatMoney(
                          payment.amount_minor,
                          payment.currency || "LKR"
                        )}
                      </td>

                      <td>
                        <StatusBadge status={payment.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="adash-table-empty">
                      {loading
                        ? "Loading transactions..."
                        : paymentSearch
                          ? "No matching transactions found."
                          : "No real payment records yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        {/* RECENT LAWYERS */}

        <article className="adash-card adash-lawyers-card">
          <div className="adash-card-header">
            <div>
              <span className="adash-section-eyebrow">
                NEW MEMBERS
              </span>
              <h2>Recent Lawyers</h2>
              <p>Latest registered accounts</p>
            </div>

            <div className="adash-small-icon">
              <UsersRound size={17} />
            </div>
          </div>

          <div className="adash-lawyer-list">
            {!loading && lawyers.length > 0 ? (
              lawyers.slice(0, 5).map((lawyer) => (
                <div
                  className="adash-lawyer-row"
                  key={lawyer.id}
                >
                  <div className="adash-avatar adash-avatar-lg">
                    {initials(lawyer.full_name)}
                  </div>

                  <div className="adash-lawyer-details">
                    <strong>
                      {lawyer.full_name || "Lawyer"}
                    </strong>

                    <span>{lawyer.email || "—"}</span>

                    <small>
                      <Clock3 size={12} />
                      {formatDate(lawyer.created_at)}
                    </small>
                  </div>

                  <StatusBadge
                    status={

                      typeof lawyer.is_active !== "boolean"
                        ? "unknown"
                        : lawyer.is_active
                          ? "active"
                          : "inactive"

                    }
                  />
                </div>
              ))
            ) : (
              <div className="adash-lawyer-empty">
                <UsersRound size={30} />
                <strong>
                  {loading
                    ? "Loading lawyers..."
                    : "No lawyer records available"}
                </strong>
              </div>
            )}
          </div>

          <Link
            to="/admin/lawyers"
            className="adash-lawyers-footer"
          >
            View All Lawyers
            <ArrowRight size={16} />
          </Link>
        </article>
      </section>

      {/* SHORTCUTS */}

      <section className="adash-shortcuts">
        <Link to="/admin/lawyers">
          <UsersRound size={19} />
          Lawyer Management
          <ArrowUpRight size={15} />
        </Link>

        <Link to="/admin/subscriptions">
          <CreditCard size={19} />
          Subscriptions & Payments
          <ArrowUpRight size={15} />
        </Link>

        <Link to="/admin/notifications">
          <Bell size={19} />
          Notifications
          <ArrowUpRight size={15} />
        </Link>
      </section>

      <footer className="adash-footer">
        AdvocaNote Admin Portal
        <span>Secure platform overview</span>
      </footer>
    </main>
  );
}
