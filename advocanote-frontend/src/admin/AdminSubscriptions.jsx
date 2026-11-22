
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Clock3,
  CreditCard,
  Crown,
  Layers3,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import AdminPlanManager from "./AdminPlanManager";
import "./AdminSubscriptions.css";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const ROWS_PER_PAGE = 10;
const COLOMBO_TZ = "Asia/Colombo";

function getAdminToken() {
  const token = localStorage.getItem(
    "advocanote_access_token"
  );

  return token
    ? token.replace(/^Bearer\s+/i, "")
    : null;
}

function normalizeStatus(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase();
}

function formatStatus(value) {
  return normalizeStatus(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function StatusBadge({ status }) {
  const value = normalizeStatus(status);

  return (
    <span className={`asub-status asub-status-${value}`}>
      {formatStatus(value)}
    </span>
  );
}

function getPaymentAmount(payment) {
  if (
    payment?.amount !== null &&
    payment?.amount !== undefined
  ) {
    return Number(payment.amount);
  }

  if (
    payment?.amount_minor !== null &&
    payment?.amount_minor !== undefined
  ) {
    return Number(payment.amount_minor) / 100;
  }

  return null;
}

function formatMoney(
  amount,
  currency = "LKR",
  decimals = 2
) {
  if (
    amount === null ||
    amount === undefined ||
    !Number.isFinite(Number(amount))
  ) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: currency || "LKR",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(amount));
  } catch {
    return `${currency || "LKR"} ${Number(amount).toFixed(decimals)}`;
  }
}

function parseBackendDate(value) {
  if (!value) return null;

  const raw = String(value)
    .trim()
    .replace(" ", "T");

  const normalized =
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
      ? raw
      : `${raw}Z`;

  const date = new Date(normalized);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatDate(value) {
  const date = parseBackendDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: COLOMBO_TZ,
  }).format(date);
}

function monthKey(date) {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: COLOMBO_TZ,
      year: "numeric",
      month: "2-digit",
    }
  ).formatToParts(date);

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  return `${year}-${month}`;
}

function isPaidPayment(payment) {
  return ["paid", "succeeded"].includes(
    normalizeStatus(payment?.status)
  );
}

function getLawyerName(lawyer = {}) {
  return (
    lawyer.full_name ||
    lawyer.fullName ||
    lawyer.name ||
    [
      lawyer.first_name,
      lawyer.last_name,
    ].filter(Boolean).join(" ") ||
    (lawyer.id
      ? `Lawyer #${lawyer.id}`
      : "Lawyer")
  );
}

function getLawyerSubscription(lawyer) {
  return lawyer?.subscription || null;
}

function getSubscriptionEnd(subscription) {
  return (
    subscription?.current_period_end ||
    subscription?.ends_at ||
    null
  );
}

// Display old DB plan names using current UI names.
// Stripe IDs and backend plan records stay unchanged.
function displayPlanName(value) {
  const name = String(value || "").trim();
  const key = name.toLowerCase();

  if (key === "free plus") return "Basic";
  if (key === "pro") return "Premium";
  if (key === "plus") return "Annual";

  return name || "Not assigned";
}

function PlanTag({ name }) {
  const label = displayPlanName(name);
  const key = label.toLowerCase();

  const variant = [
    "basic",
    "premium",
    "annual",
  ].includes(key)
    ? key
    : "default";

  return (
    <span
      className={`asub-plan-tag asub-plan-${variant}`}
    >
      {label}
    </span>
  );
}

// =====================================
// PAGINATION
// =====================================

function Pager({
  page,
  totalPages,
  onChange,
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="asub-pager">
      <span>
        Page {page} of {totalPages}
      </span>

      <div className="asub-pager-actions">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// =====================================
// REVENUE CHART
// =====================================

function RevenueChart({ payments }) {
  const months = useMemo(() => {
    const [year, month] = monthKey(
      new Date()
    )
      .split("-")
      .map(Number);

    const series = Array.from(
      { length: 6 },
      (_, index) => {
        const date = new Date(
          Date.UTC(
            year,
            month - 1 - (5 - index),
            1,
            12
          )
        );

        return {
          key: monthKey(date),

          label: new Intl.DateTimeFormat(
            "en-US",
            {
              month: "short",
              timeZone: "UTC",
            }
          ).format(date),

          amount: 0,
        };
      }
    );

    const byKey = new Map(
      series.map((entry) => [
        entry.key,
        entry,
      ])
    );

    payments.forEach((payment) => {
      const date = parseBackendDate(
        payment.paid_at ||
        payment.created_at
      );

      const amount = getPaymentAmount(
        payment
      );

      if (
        !date ||
        amount === null ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return;
      }

      const entry = byKey.get(
        monthKey(date)
      );

      if (entry) {
        entry.amount += amount;
      }
    });

    return series;
  }, [payments]);

  const maxValue = Math.max(
    0,
    ...months.map(
      (month) => month.amount
    )
  );

  const axisMax =
    maxValue > 0
      ? Math.ceil(maxValue / 1000) * 1000
      : 1000;

  return (
    <section className="asub-overview-card asub-revenue-card">
      <div className="asub-card-heading">
        <BarChart3 size={19} />

        <h2>
          Subscription Revenue{" "}
          <span>(Last 6 Months)</span>
        </h2>
      </div>

      <div className="asub-chart">
        <div
          className="asub-chart-axis"
          aria-hidden="true"
        >
          {[4, 3, 2, 1, 0].map(
            (tick) => (
              <span key={tick}>
                {formatMoney(
                  (axisMax * tick) / 4,
                  "LKR",
                  0
                )}
              </span>
            )
          )}
        </div>

        <div className="asub-chart-main">
          <div className="asub-chart-plot">
            <div
              className="asub-chart-grid"
              aria-hidden="true"
            />

            <div className="asub-chart-bars">
              {months.map(
                (month, index) => (
                  <div
                    className="asub-chart-bar-slot"
                    key={month.key}
                  >
                    <div
                      className={`asub-chart-bar ${
                        index ===
                        months.length - 1
                          ? "latest"
                          : ""
                      }`}
                      style={{
                        height: `${
                          Math.max(
                            0,
                            Math.min(
                              100,
                              (
                                month.amount /
                                axisMax
                              ) * 100
                            )
                          )
                        }%`,
                      }}
                      title={`${month.label}: ${formatMoney(month.amount)}`}
                      aria-label={`${month.label}: ${formatMoney(month.amount)}`}
                    />
                  </div>
                )
              )}
            </div>
          </div>

          <div className="asub-chart-months">
            {months.map((month) => (
              <span key={month.key}>
                {month.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================
// MAIN PAGE
// =====================================

export default function AdminSubscriptions() {
  const [data, setData] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [refreshKey, setRefreshKey] =
    useState(0);

  const [activeTab, setActiveTab] =
    useState("overview");

  const [search, setSearch] =
    useState("");

  const [lawyerPage, setLawyerPage] =
    useState(1);

  const [paymentPage, setPaymentPage] =
    useState(1);

  // ===================================
  // EXISTING BACKEND API
  // ===================================

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadSubscriptions() {
      setLoading(true);
      setError("");

      const token = getAdminToken();

      if (!token) {
        setData(null);

        setError(
          "Please log in as an administrator."
        );

        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/admin/subscriptions/overview`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,

              Accept:
                "application/json",
            },

            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          throw new Error(
            "Your session has expired. Please log in again."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "Administrator permission is required."
          );
        }

        if (response.status === 404) {
          throw new Error(
            "Admin Subscription Overview API was not found."
          );
        }

        if (!response.ok) {
          throw new Error(
            `Unable to load subscription data (${response.status}).`
          );
        }

        const result =
          await response.json();

        if (
          !result ||
          !Array.isArray(result.lawyers) ||
          !Array.isArray(result.plans) ||
          !Array.isArray(result.payments)
        ) {
          throw new Error(
            "Unexpected Admin Subscription API response."
          );
        }

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (
          controller.signal.aborted ||
          err.name === "AbortError"
        ) {
          return;
        }

        setData(null);

        setError(
          err.message ||
          "Unable to load subscription details."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSubscriptions();

    return () => controller.abort();
  }, [refreshKey]);

  const lawyers = data?.lawyers || [];
  const plans = data?.plans || [];
  const payments = data?.payments || [];

  // ===================================
  // PAID LKR PAYMENTS
  // ===================================

  const paidPayments = useMemo(
    () =>
      payments.filter(
        (payment) =>
          isPaidPayment(payment) &&
          String(
            payment.currency || ""
          ).toUpperCase() === "LKR"
      ),
    [payments]
  );

  const totalRevenue = useMemo(
    () =>
      paidPayments.reduce(
        (total, payment) => {
          const amount =
            getPaymentAmount(payment);

          return (
            total +
            (
              amount !== null &&
              Number.isFinite(amount)
                ? amount
                : 0
            )
          );
        },
        0
      ),
    [paidPayments]
  );

  // ===================================
  // SUBSCRIPTION STATISTICS
  // ===================================

  const activeSubscriptions = useMemo(
    () =>
      lawyers.filter(
        (lawyer) =>
          normalizeStatus(
            getLawyerSubscription(
              lawyer
            )?.status
          ) === "active"
      ).length,
    [lawyers]
  );

  const trialUsers = useMemo(
    () =>
      lawyers.filter(
        (lawyer) =>
          normalizeStatus(
            getLawyerSubscription(
              lawyer
            )?.status
          ) === "trialing"
      ).length,
    [lawyers]
  );

  // ===================================
  // THREE RECENT SUBSCRIPTIONS
  // ===================================

  const recentSubscriptions = useMemo(
    () => {
      const sorted = [
        ...paidPayments,
      ].sort((a, b) => {
        const aDate =
          parseBackendDate(
            a.paid_at ||
            a.created_at
          )?.getTime() || 0;

        const bDate =
          parseBackendDate(
            b.paid_at ||
            b.created_at
          )?.getTime() || 0;

        return (
          bDate - aDate ||
          Number(b.id || 0) -
          Number(a.id || 0)
        );
      });

      const seen = new Set();
      const result = [];

      sorted.forEach((payment) => {
        if (result.length >= 3) {
          return;
        }

        const identity = String(
          payment.user_id ||
          payment.lawyer_email ||
          `payment-${payment.id}`
        );

        if (seen.has(identity)) {
          return;
        }

        seen.add(identity);

        const lawyer = lawyers.find(
          (item) =>
            Number(item.id) ===
            Number(payment.user_id)
        );

        const plan = plans.find(
          (item) =>
            Number(item.id) ===
            Number(payment.plan_id)
        );

        result.push({
          id: payment.id,

          name: lawyer
            ? getLawyerName(lawyer)
            : payment.lawyer_email ||
              `Lawyer #${payment.user_id || "—"}`,

          plan:
            payment.plan_name ||
            plan?.name ||
            "Subscription",

          amount:
            getPaymentAmount(payment),

          date:
            payment.paid_at ||
            payment.created_at,
        });
      });

      return result;
    },
    [paidPayments, lawyers, plans]
  );

  // ===================================
  // LAWYERS SEARCH + PAGINATION
  // ===================================

  const filteredLawyers = useMemo(
    () => {
      const query = search
        .toLowerCase()
        .trim();

      if (!query) {
        return lawyers;
      }

      return lawyers.filter(
        (lawyer) => {
          const subscription =
            getLawyerSubscription(
              lawyer
            );

          return [
            lawyer.id,
            getLawyerName(lawyer),
            lawyer.email,
            subscription?.plan_name,
            subscription?.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      );
    },
    [lawyers, search]
  );

  const lawyerPages = Math.max(
    1,
    Math.ceil(
      filteredLawyers.length /
      ROWS_PER_PAGE
    )
  );

  const currentLawyerPage = Math.min(
    lawyerPage,
    lawyerPages
  );

  const visibleLawyers =
    filteredLawyers.slice(
      (currentLawyerPage - 1) *
        ROWS_PER_PAGE,

      currentLawyerPage *
        ROWS_PER_PAGE
    );

  // ===================================
  // PAYMENTS PAGINATION
  // ===================================

  const sortedPayments = useMemo(
    () =>
      [...payments].sort((a, b) => {
        const aDate =
          parseBackendDate(
            a.paid_at ||
            a.created_at
          )?.getTime() || 0;

        const bDate =
          parseBackendDate(
            b.paid_at ||
            b.created_at
          )?.getTime() || 0;

        return (
          bDate - aDate ||
          Number(b.id || 0) -
          Number(a.id || 0)
        );
      }),
    [payments]
  );

  const paymentPages = Math.max(
    1,
    Math.ceil(
      sortedPayments.length /
      ROWS_PER_PAGE
    )
  );

  const currentPaymentPage = Math.min(
    paymentPage,
    paymentPages
  );

  const visiblePayments =
    sortedPayments.slice(
      (currentPaymentPage - 1) *
        ROWS_PER_PAGE,

      currentPaymentPage *
        ROWS_PER_PAGE
    );

  // ===================================
  // NAVIGATION
  // ===================================

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "lawyers",
      label: "Lawyer Subscriptions",
      icon: Users,
    },
    {
      id: "plans",
      label: "Subscription Plans",
      icon: Layers3,
    },
    {
      id: "payments",
      label: "Payment History",
      icon: CreditCard,
    },
  ];

  // ===================================
  // UI
  // ===================================

  return (
    <div className="asub-page">

      {/* HEADER */}

      <header className="asub-heading">
        <div className="asub-heading-copy">
        

          <div>
            <h1>
              Subscription <span>Management</span>
            </h1>

            <p>
              Manage lawyer subscriptions,
              plans and payment details.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="asub-refresh"
          onClick={() =>
            setRefreshKey(
              (number) => number + 1
            )
          }
          disabled={loading}
        >
          <RefreshCw
            size={15}
            className={
              loading
                ? "asub-spinning"
                : ""
            }
          />

          {loading
            ? "Loading..."
            : "Refresh"}
        </button>
      </header>

      {/* TABS */}

      <nav
        className="asub-tabs"
        aria-label="Subscription management tabs"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              className={
                activeTab === tab.id
                  ? "active"
                  : ""
              }
              aria-current={
                activeTab === tab.id
                  ? "page"
                  : undefined
              }
              onClick={() =>
                setActiveTab(tab.id)
              }
            >
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* LOADING */}

      {loading && (
        <div
          className="asub-message"
          role="status"
        >
          Loading subscription data...
        </div>
      )}

      {/* ERROR */}

      {!loading && error && (
        <div
          className="asub-error"
          role="alert"
        >
          <AlertCircle size={18} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setRefreshKey(
                (number) => number + 1
              )
            }
          >
            Retry
          </button>
        </div>
      )}

      {/* BACKEND DATA */}

      {!loading && !error && data && (
        <>

          {/* ==========================
              OVERVIEW
          ========================== */}

          {activeTab === "overview" && (
            <>

              {/* FOUR KPI CARDS */}

              <section
                className="asub-stats"
                aria-label="Subscription overview"
              >

                <article className="asub-stat">
                  <div className="asub-stat-icon green">
                    <Users size={23} />
                  </div>

                  <div className="asub-stat-copy">
                    <span>
                      Registered Lawyers
                    </span>

                    <strong>
                      {lawyers.length}
                    </strong>
                  </div>
                </article>

                <article className="asub-stat">
                  <div className="asub-stat-icon gold">
                    <Crown size={23} />
                  </div>

                  <div className="asub-stat-copy">
                    <span>
                      Active Subscriptions
                    </span>

                    <strong>
                      {activeSubscriptions}
                    </strong>
                  </div>
                </article>

                <article className="asub-stat">
                  <div className="asub-stat-icon green">
                    <Layers3 size={23} />
                  </div>

                  <div className="asub-stat-copy">
                    <span>
                      Trial Users
                    </span>

                    <strong>
                      {trialUsers}
                    </strong>
                  </div>
                </article>

                <article className="asub-stat">
                  <div className="asub-stat-icon gold">
                    <Wallet size={23} />
                  </div>

                  <div className="asub-stat-copy">
                    <span>
                      Total Revenue
                    </span>

                    <strong>
                      {formatMoney(
                        totalRevenue,
                        "LKR",
                        0
                      )}
                    </strong>
                  </div>
                </article>

              </section>

              {/* CHART + RECENT SUBSCRIPTIONS */}

              <div className="asub-overview-grid">
                <RevenueChart
                  payments={paidPayments}
                />

                <section className="asub-overview-card asub-recent-card">

                  <div className="asub-card-heading asub-recent-heading">
                    <div className="asub-recent-heading-name">
                      <Clock3 size={19} />

                      <h2>
                        Recent Subscriptions
                      </h2>
                    </div>

                    <button
                      type="button"
                      className="asub-view-all"
                      onClick={() =>
                        setActiveTab("payments")
                      }
                    >
                      View All →
                    </button>
                  </div>

                  <div className="asub-recent-list">

                    {recentSubscriptions.length === 0 ? (
                      <div className="asub-no-recent">
                        No paid subscriptions
                        found yet.
                      </div>
                    ) : (
                      recentSubscriptions.map(
                        (item) => (
                          <div
                            className="asub-recent-item"
                            key={item.id}
                          >
                            <div className="asub-avatar">
                              <Users size={18} />
                            </div>

                            <div className="asub-recent-person">
                              <strong
                                title={item.name}
                              >
                                {item.name}
                              </strong>

                              <span>
                                Subscribed on{" "}
                                {formatDate(
                                  item.date
                                )}
                              </span>
                            </div>

                            <PlanTag
                              name={item.plan}
                            />

                            <b className="asub-recent-amount">
                              {formatMoney(
                                item.amount,
                                "LKR",
                                0
                              )}
                            </b>
                          </div>
                        )
                      )
                    )}
                  </div>
                </section>
              </div>

            </>
          )}

          {/* ==========================
              LAWYER SUBSCRIPTIONS
          ========================== */}

          {activeTab === "lawyers" && (
            <section className="asub-panel">

              <div className="asub-section-heading">
                <div>
                  <h2>
                    Lawyer Subscriptions
                  </h2>

                </div>
              </div>

              <div className="asub-toolbar">
                <div className="asub-search">
                  <Search size={18} />

                  <input
                    type="search"
                    placeholder="Search lawyer name or email..."
                    value={search}
                    onChange={(event) => {
                      setSearch(
                        event.target.value
                      );

                      setLawyerPage(1);
                    }}
                  />
                </div>
              </div>

              <div className="asub-table-scroll">
                <table className="asub-table">
                  <thead>
                    <tr>
                      <th>Lawyer</th>
                      <th>Email</th>
                      <th>Current Plan</th>
                      <th>
                        Subscription Status
                      </th>
                      <th>Expiry Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleLawyers.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="asub-empty"
                        >
                          No matching lawyer
                          records found.
                        </td>
                      </tr>
                    ) : (
                      visibleLawyers.map(
                        (lawyer) => {
                          const subscription =
                            getLawyerSubscription(
                              lawyer
                            );

                          const plan =
                            plans.find(
                              (item) =>
                                Number(
                                  item.id
                                ) ===
                                Number(
                                  subscription?.plan_id
                                )
                            );

                          return (
                            <tr key={lawyer.id}>
                              <td>
                                <strong>
                                  {getLawyerName(
                                    lawyer
                                  )}
                                </strong>
                              </td>

                              <td>
                                {lawyer.email ||
                                  "—"}
                              </td>

                              <td>
                                <PlanTag
                                  name={
                                    subscription?.plan_name ||
                                    plan?.name
                                  }
                                />
                              </td>

                              <td>
                                <StatusBadge
                                  status={
                                    subscription?.status ||
                                    "not_subscribed"
                                  }
                                />
                              </td>

                              <td>
                                {formatDate(
                                  getSubscriptionEnd(
                                    subscription
                                  )
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <Pager
                page={currentLawyerPage}
                totalPages={lawyerPages}
                onChange={setLawyerPage}
              />
            </section>
          )}

          {/* ==========================
              SUBSCRIPTION PLANS
          ========================== */}

          {activeTab === "plans" && (
            <section className="asub-panel asub-plans-panel">
              <AdminPlanManager
                plans={plans}
                lawyers={lawyers}
                onChanged={() =>
                  setRefreshKey(
                    (number) =>
                      number + 1
                  )
                }
              />
            </section>
          )}

          {/* ==========================
              PAYMENT HISTORY
          ========================== */}

          {activeTab === "payments" && (
            <section className="asub-panel">

              <div className="asub-section-heading">
                <div>
                  <h2>
                    Payment History
                  </h2>
                </div>
              </div>

              <div className="asub-table-scroll">
                <table className="asub-table">
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Lawyer</th>
                      <th>Plan</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visiblePayments.length === 0 ? (
                      <tr>
                        <td
                          colSpan="6"
                          className="asub-empty"
                        >
                          No payment records
                          found.
                        </td>
                      </tr>
                    ) : (
                      visiblePayments.map(
                        (payment) => {
                          const relatedPlan =
                            plans.find(
                              (plan) =>
                                Number(
                                  plan.id
                                ) ===
                                Number(
                                  payment.plan_id
                                )
                            );

                          const relatedLawyer =
                            lawyers.find(
                              (lawyer) =>
                                Number(
                                  lawyer.id
                                ) ===
                                Number(
                                  payment.user_id
                                )
                            );

                          return (
                            <tr key={payment.id}>
                              <td>
                                <strong>
                                  #{payment.id}
                                </strong>
                              </td>

                              <td>
                                {payment.lawyer_email ||
                                  relatedLawyer?.email ||
                                  "—"}
                              </td>

                              <td>
                                {payment.plan_name ||
                                  relatedPlan?.name ||
                                  `Plan #${payment.plan_id}`}
                              </td>

                              <td>
                                {formatMoney(
                                  getPaymentAmount(
                                    payment
                                  ),
                                  payment.currency
                                )}
                              </td>

                              <td>
                                <CalendarDays
                                  size={13}
                                  className="asub-date-icon"
                                />

                                {formatDate(
                                  payment.paid_at ||
                                  payment.created_at
                                )}
                              </td>

                              <td>
                                <StatusBadge
                                  status={
                                    payment.status
                                  }
                                />
                              </td>
                            </tr>
                          );
                        }
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <Pager
                page={currentPaymentPage}
                totalPages={paymentPages}
                onChange={setPaymentPage}
              />
            </section>
          )}

        </>
      )}
    </div>
  );
}
