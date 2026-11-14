
import { useEffect, useMemo, useState } from "react";

import {
  Crown,
  CreditCard,
  Users,
  Search,
  RefreshCw,
  Wallet,
  CalendarDays,
  AlertCircle,
  ShieldCheck,
  Receipt,
  CheckCircle2,
} from "lucide-react";

import "./AdminSubscriptions.css";
import AdminPlanManager from "./AdminPlanManager";
// =====================================
// API CONFIGURATION
// =====================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

// =====================================
// ADMIN AUTHENTICATION
// =====================================

function getAdminToken() {
  const token = sessionStorage.getItem(
    "advocanote_access_token"
  );

  return token
    ? token.replace(/^Bearer\s+/i, "")
    : null;
}

// =====================================
// MONEY HELPERS
// =====================================

// Our current MySQL Payment model stores
// LKR 1000 as amount = 1000.00.
//
// Older overview APIs may return amount_minor.
// Support both without dividing twice.

function getPlanAmount(plan) {
  if (
    plan?.price !== null &&
    plan?.price !== undefined
  ) {
    return Number(plan.price);
  }

  if (
    plan?.price_minor !== null &&
    plan?.price_minor !== undefined
  ) {
    return Number(plan.price_minor) / 100;
  }

  return null;
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

function formatMoney(amount, currency = "LKR") {
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

// =====================================
// DATE HELPERS
// =====================================

function formatDate(value) {
  if (!value) return "—";

  const raw = String(value);

  // Backend stores naive UTC datetimes.
  const normalized =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)
      ? raw
      : `${raw}Z`;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).format(date);
}

// =====================================
// STATUS HELPERS
// =====================================

function normalizeStatus(status) {
  return String(status || "unknown")
    .trim()
    .toLowerCase();
}

function formatStatus(status) {
  return normalizeStatus(status)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function isPaidPayment(payment) {
  const status = normalizeStatus(payment?.status);

  return status === "paid" ||
    status === "succeeded";
}

function StatusBadge({ status }) {
  const value = normalizeStatus(status);

  return (
    <span
      className={`asub-status asub-status-${value}`}
    >
      {formatStatus(value)}
    </span>
  );
}

// =====================================
// PLAN HELPERS
// =====================================

function getBillingCycle(plan) {
  const cycle =
    plan?.billing_interval ||
    plan?.billing_cycle ||
    plan?.interval;

  if (!cycle) return "—";

  if (
    cycle === "month" ||
    cycle === "monthly"
  ) {
    return "Monthly";
  }

  if (
    cycle === "year" ||
    cycle === "yearly"
  ) {
    return "Yearly";
  }

  return formatStatus(cycle);
}

function getLawyerName(lawyer) {
  return (
    lawyer.full_name ||
    lawyer.fullName ||
    lawyer.name ||
    [
      lawyer.first_name,
      lawyer.last_name,
    ].filter(Boolean).join(" ") ||
    `Lawyer #${lawyer.id}`
  );
}

function getLawyerSubscription(lawyer) {
  return lawyer.subscription || null;
}

function getSubscriptionEnd(subscription) {
  return (
    subscription?.current_period_end ||
    subscription?.ends_at ||
    null
  );
}

// =====================================
// MAIN ADMIN SUBSCRIPTIONS PAGE
// =====================================

export default function AdminSubscriptions() {
  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  const [activeTab, setActiveTab] = useState(
    "lawyers"
  );

  const [search, setSearch] = useState("");

  // ===================================
  // FETCH REAL BACKEND DATA
  // ===================================

  useEffect(() => {
    const controller = new AbortController();

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
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
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
            "Admin Subscription Overview API was not found. Please check the backend route."
          );
        }

        if (!response.ok) {
          throw new Error(
            `Unable to load subscription data (${response.status}).`
          );
        }

        const result = await response.json();

        // Never invent missing backend data.
        // Validate the actual overview response.
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

  // ===================================
  // BACKEND DATA
  // ===================================

  const lawyers = data?.lawyers || [];
  const plans = data?.plans || [];
  const payments = data?.payments || [];

  // ===================================
  // FILTER LAWYERS
  // ===================================

  const filteredLawyers = useMemo(() => {
    const query = search
      .toLowerCase()
      .trim();

    if (!query) {
      return lawyers;
    }

    return lawyers.filter((lawyer) => {
      const subscription =
        getLawyerSubscription(lawyer);

      const searchableText = [
        lawyer.id,
        getLawyerName(lawyer),
        lawyer.email,
        subscription?.plan_name,
        subscription?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });

  }, [lawyers, search]);

  // ===================================
  // ACTIVE SUBSCRIBERS
  // ===================================

  const activeSubscribers = useMemo(() => {
    return lawyers.filter((lawyer) => {
      const subscription =
        getLawyerSubscription(lawyer);

      return (
        normalizeStatus(subscription?.status) ===
        "active"
      );
    }).length;
  }, [lawyers]);

  // ===================================
  // ACTIVE PLANS
  // ===================================

  const activePlans = useMemo(() => {
    return plans.filter(
      (plan) => plan.is_active === true
    ).length;
  }, [plans]);

  // ===================================
  // PAYMENT REVENUE
  // ===================================

  const paidPayments = useMemo(() => {
    return payments.filter(
      (payment) =>
        isPaidPayment(payment) &&
        String(payment.currency || "").toUpperCase() ===
        "LKR"
    );
  }, [payments]);

  const totalRevenue = useMemo(() => {
    return paidPayments.reduce(
      (total, payment) => {
        const amount = getPaymentAmount(payment);

        if (
          amount === null ||
          !Number.isFinite(amount)
        ) {
          return total;
        }

        return total + amount;
      },
      0
    );
  }, [paidPayments]);

  // ===================================
  // TABS
  // ===================================

  const tabs = [
    {
      id: "lawyers",
      label: "Lawyer Subscriptions",
    },
    {
      id: "plans",
      label: "Subscription Plans",
    },
    {
      id: "payments",
      label: "Payment History",
    },
  ];

  // ===================================
  // RENDER
  // ===================================

  return (
    <div className="asub-page">

      {/* PAGE HEADING */}

      <header className="asub-heading">
        <div>
          <h1>
            Subscriptions & Payments
          </h1>

          <p>
            Monitor lawyer subscriptions,
            plans and billing records.
          </p>
        </div>

        <button
          type="button"
          className="asub-refresh"
          onClick={() =>
            setRefreshKey((n) => n + 1)
          }
          disabled={loading}
        >
          <RefreshCw size={17} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

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
          <AlertCircle size={19} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setRefreshKey((n) => n + 1)
            }
          >
            Retry
          </button>
        </div>
      )}

      {/* SHOW ONLY REAL BACKEND DATA */}

      {!loading && !error && data && (
        <>

          {/* ==================================
              STATISTICS
          ================================== */}

          <section className="asub-stats">

            {/* REGISTERED LAWYERS */}

            <article className="asub-stat">
              <div className="asub-stat-icon">
                <Users size={23} />
              </div>

              <span>
                Registered Lawyers
              </span>

              <strong>
                {lawyers.length}
              </strong>
            </article>

            {/* ACTIVE SUBSCRIPTIONS */}

            <article className="asub-stat">
              <div className="asub-stat-icon">
                <Crown size={23} />
              </div>

              <span>
                Active Subscriptions
              </span>

              <strong>
                {activeSubscribers}
              </strong>
            </article>

            {/* ACTIVE PLANS */}

            <article className="asub-stat">
              <div className="asub-stat-icon">
                <CreditCard size={23} />
              </div>

              <span>
                Active Plans
              </span>

              <strong>
                {activePlans}
              </strong>
            </article>

            {/* RECORDED REVENUE */}

            <article className="asub-stat">
              <div className="asub-stat-icon">
                <Wallet size={23} />
              </div>

              <span>
                Recorded Paid Payments (LKR)
              </span>

              <strong>
                {formatMoney(
                  totalRevenue,
                  "LKR"
                )}
              </strong>
            </article>

          </section>

          {/* SANDBOX INFORMATION */}

          <div className="asub-notice">
            <ShieldCheck size={19} />

            <span>
              Recorded revenue is calculated from
              paid LKR payment records returned by
              the AdvocaNote backend. Sandbox payments
              do not represent real bank transfers.
            </span>
          </div>

          {/* ==================================
              MAIN PANEL
          ================================== */}

          <section className="asub-panel">

            {/* TABS */}

            <div className="asub-tabs">

              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={
                    activeTab === tab.id
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveTab(tab.id)
                  }
                >
                  {tab.label}
                </button>
              ))}

            </div>

            {/* ==================================
                LAWYERS TAB
            ================================== */}

            {activeTab === "lawyers" && (
              <>

                {/* SEARCH */}

                <div className="asub-toolbar">

                  <div className="asub-search">
                    <Search size={19} />

                    <input
                      type="search"
                      placeholder="Search lawyer name or email..."
                      value={search}
                      onChange={(e) =>
                        setSearch(e.target.value)
                      }
                    />
                  </div>

                </div>

                {/* LAWYERS TABLE */}

                <div className="asub-table-scroll">

                  <table className="asub-table">

                    <thead>
                      <tr>
                        <th>Lawyer</th>
                        <th>Email</th>
                        <th>Current Plan</th>
                        <th>Subscription Status</th>
                        <th>Expiry Date</th>
                      </tr>
                    </thead>

                    <tbody>

                      {filteredLawyers.length === 0 ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="asub-empty"
                          >
                            No matching lawyer records found.
                          </td>
                        </tr>
                      ) : (

                        filteredLawyers.map((lawyer) => {
                          const subscription =
                            getLawyerSubscription(lawyer);

                          const plan =
                            plans.find(
                              (item) =>
                                Number(item.id) ===
                                Number(subscription?.plan_id)
                            );

                          return (
                            <tr key={lawyer.id}>

                              <td>
                                <strong>
                                  {getLawyerName(lawyer)}
                                </strong>
                              </td>

                              <td>
                                {lawyer.email || "—"}
                              </td>

                              <td>
                                {subscription?.plan_name ||
                                  plan?.name ||
                                  "Not assigned"}
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
                        })

                      )}

                    </tbody>

                  </table>

                </div>
              </>
            )}


            {/* PLANS TAB */}

            {activeTab === "plans" && (
              <AdminPlanManager
                plans={plans}
                lawyers={lawyers}
                onChanged={() => setRefreshKey((n) => n + 1)}
              />
            )}




            {/* ==================================
                PAYMENTS TAB
            ================================== */}

            {activeTab === "payments" && (
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

                    {payments.length === 0 ? (
                      <tr>
                        <td
                          colSpan="6"
                          className="asub-empty"
                        >
                          No payment records found.
                        </td>
                      </tr>
                    ) : (

                      payments.map((payment) => {
                        const relatedPlan =
                          plans.find(
                            (plan) =>
                              Number(plan.id) ===
                              Number(payment.plan_id)
                          );

                        const relatedLawyer =
                          lawyers.find(
                            (lawyer) =>
                              Number(lawyer.id) ===
                              Number(payment.user_id)
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
                                getPaymentAmount(payment),
                                payment.currency
                              )}
                            </td>

                            <td>
                              <CalendarDays
                                size={13}
                                className="asub-date-icon"
                              />

                              {" "}

                              {formatDate(
                                payment.paid_at ||
                                payment.created_at
                              )}
                            </td>

                            <td>
                              <StatusBadge
                                status={payment.status}
                              />
                            </td>

                          </tr>
                        );
                      })

                    )}

                  </tbody>

                </table>

              </div>
            )}

          </section>

          {/* FOOTER INFORMATION */}

          <div className="asub-notice">
            <Receipt size={19} />

            <span>
              This page displays subscription and
              payment information provided by the
              AdvocaNote admin backend. Payment
              verification and subscription access
              are controlled by FastAPI.
            </span>
          </div>

        </>
      )}

    </div>
  );
}
