
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Crown,
  CreditCard,
  CalendarDays,
  ShieldCheck,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Receipt,
  RefreshCw,
  Wallet,
  LoaderCircle,
  Check,
  Menu,
  Search,
  ChevronDown,
  UserRound,
  LogOut,
} from "lucide-react";

import {
  LawyerTopbarPortal,
  LawyerTopbarAvatar,
  useLawyerLayout,
} from "../components/LawyerLayout";

import { logoutUser } from "../services/auth";

import "./MyLegalDiary.css";
import "./AccountPages.css";
import "./Subscription.css";

// =====================================
// API CONFIGURATION
// =====================================

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

function getAccessToken() {
  return (
    sessionStorage
      .getItem("advocanote_access_token")
      ?.replace(/^Bearer\s+/i, "") || null
  );
}

async function apiRequest(endpoint, options = {}) {
  const token = getAccessToken();

  const response = await fetch(
    `${API_BASE}${endpoint}`,
    {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),

        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),

        ...(options.headers || {}),
      },
    }
  );

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const detail =
      typeof result?.detail === "string"
        ? result.detail
        : "Unable to complete your request.";

    throw new Error(
      response.status === 401
        ? "Your login session has expired. Please log in again."
        : detail
    );
  }

  return result;
}

// =====================================
// FORMAT HELPERS
// =====================================

function formatMoney(amount, currency = "LKR") {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: currency || "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value) {
  if (!value) return "Not available";

  const raw = String(value);

  const date = new Date(
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)
      ? raw
      : `${raw}Z`
  );

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).format(date);
}

function formatStatus(value) {
  return String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getPlanFeatures(plan) {
  const features = plan?.features;

  if (Array.isArray(features)) {
    return features
      .map((item) =>
        typeof item === "string"
          ? item
          : item?.name ||
          item?.label ||
          item?.feature_name ||
          ""
      )
      .filter(Boolean);
  }

  if (features && typeof features === "object") {
    return Object.entries(features)
      .filter(([, enabled]) => enabled === true)
      .map(([name]) => formatStatus(name));
  }

  return [];
}

function getPlanInterval(plan) {
  const interval =
    plan?.billing_interval ||
    plan?.interval ||
    plan?.billing_cycle;

  if (
    interval === "month" ||
    interval === "monthly"
  ) {
    return "month";
  }

  if (
    interval === "year" ||
    interval === "yearly"
  ) {
    return "year";
  }

  return "billing cycle";
}

// =====================================
// SUBSCRIPTION PAGE
// =====================================

export default function Subscription() {
  const location = useLocation();
  const navigate = useNavigate();

  // EXISTING COMMON LAWYER LAYOUT

  const { user, openSidebar } = useLawyerLayout();

  // TOPBAR STATE

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [search, setSearch] = useState("");

  // SUBSCRIPTION STATE

  const [plans, setPlans] = useState([]);

  const [subscription, setSubscription] =
    useState(null);

  const [payments, setPayments] =
    useState([]);

  const [showAllPayments, setShowAllPayments] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [upgradePreview, setUpgradePreview] =
    useState(null);

  const displayName =
    user?.full_name ||
    user?.name ||
    [user?.first_name, user?.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Lawyer";

  // =====================================
  // FETCH SUBSCRIPTION DATA
  // =====================================

  const loadSubscriptionData = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const [
          plansData,
          subscriptionData,
          paymentsData,
        ] = await Promise.all([
          apiRequest("/subscriptions/plans"),
          apiRequest("/subscriptions/me"),
          apiRequest("/subscriptions/payments"),
        ]);

        setPlans(
          Array.isArray(plansData)
            ? plansData
            : []
        );

        setSubscription(
          subscriptionData || null
        );

        setPayments(
          Array.isArray(paymentsData)
            ? paymentsData
            : []
        );
      } catch (err) {
        setError(
          err.message ||
          "Failed to load subscription details."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadSubscriptionData();
  }, [loadSubscriptionData]);

  // =====================================
  // VERIFY STRIPE PAYMENT
  // =====================================

  useEffect(() => {
    if (
      location.pathname ===
      "/subscription/cancel"
    ) {
      setNotice(
        "Payment checkout was canceled."
      );
      return;
    }

    if (
      location.pathname !==
      "/subscription/success"
    ) {
      return;
    }

    const sessionId = new URLSearchParams(
      location.search
    ).get("session_id");

    if (!sessionId) {
      setNotice(
        "Checking subscription status. Refresh if needed."
      );
      return;
    }

    let cancelled = false;

    async function verifyPayment() {
      setNotice("Verifying payment...");

      try {
        const result = await apiRequest(
          `/subscriptions/checkout/status?session_id=${encodeURIComponent(
            sessionId
          )}`
        );

        if (cancelled) return;

        setNotice(
          result?.payment_status === "paid" &&
            result?.subscription_status === "active"
            ? "Payment verified. Your plan is active."
            : "Payment processing. Refresh to check the status."
        );

        await loadSubscriptionData();
      } catch {
        if (!cancelled) {
          setNotice(
            "Payment verification pending. Please check again later."
          );
        }
      }
    }

    verifyPayment();

    return () => {
      cancelled = true;
    };
  }, [
    location.pathname,
    location.search,
    loadSubscriptionData,
  ]);

  // =====================================
  // CURRENT PLAN
  // =====================================

  const currentPlan = useMemo(
    () =>
      plans.find(
        (plan) =>
          Number(plan.id) ===
          Number(subscription?.plan_id)
      ) || null,
    [plans, subscription]
  );

  const subscriptionStatus =
    subscription?.status || "not_subscribed";

  const hasSubscription = Boolean(
    subscription?.plan_id
  );

  const isActive =
    subscriptionStatus === "active";


  const canSubscribe =
    !hasSubscription ||
    subscriptionStatus === "canceled" ||
    (
      subscriptionStatus === "expired" &&
      Boolean(subscription?.trial_ends_at)
    );


  // =====================================
  // SEARCH PLANS AND PAYMENTS
  // =====================================

  const searchTerm =
    search.trim().toLowerCase();



  const visiblePlans = plans.filter((plan) => {
    // Only show active subscription plans.
    if (plan.is_active !== true) {
      return false;
    }

    return `${plan.name} ${plan.description || ""}`
      .toLowerCase()
      .includes(searchTerm);
  });


  const visiblePayments = payments.filter(
    (payment) => {
      const relatedPlan = plans.find(
        (plan) =>
          Number(plan.id) ===
          Number(payment.plan_id)
      );

      return `${relatedPlan?.name || ""
        } ${payment.status || ""} ${payment.amount || ""
        }`
        .toLowerCase()
        .includes(searchTerm);
    }
  );


  const sortedPayments = [...visiblePayments].sort((a, b) => {
    const aTime = Date.parse(
      a.paid_at || a.created_at || ""
    );

    const bTime = Date.parse(
      b.paid_at || b.created_at || ""
    );

    return (
      (Number.isFinite(bTime) ? bTime : 0) -
      (Number.isFinite(aTime) ? aTime : 0)
    );
  });

  const displayedPayments = showAllPayments
    ? sortedPayments
    : sortedPayments.slice(0, 3);


  // =====================================
  // STRIPE CHECKOUT
  // =====================================

  async function handleCheckout(planId) {
    if (!canSubscribe || actionLoading) return;

    setActionLoading(`checkout-${planId}`);
    setError("");

    try {
      const result = await apiRequest(
        "/subscriptions/checkout",
        {
          method: "POST",
          body: JSON.stringify({
            plan_id: planId,
          }),
        }
      );

      if (!result?.checkout_url) {
        throw new Error(
          "Stripe Checkout URL was not returned."
        );
      }

      window.location.assign(result.checkout_url);
    } catch (err) {
      setError(err.message);
      setActionLoading(null);
    }
  }

  // =====================================
  // MANAGE BILLING
  // =====================================

  async function handleManageBilling() {
    if (actionLoading) return;

    setActionLoading("manage");
    setError("");

    try {
      const result = await apiRequest(
        "/subscriptions/manage",
        {
          method: "POST",
        }
      );

      if (!result?.portal_url) {
        throw new Error(
          "Billing Portal URL was not returned."
        );
      }

      window.location.assign(result.portal_url);
    } catch (err) {
      setError(err.message);
      setActionLoading(null);
    }
  }

  // =====================================
  // PLAN CHANGE PREVIEW
  // =====================================

  async function handlePreviewPlanChange(plan) {
    if (
      !isActive ||
      !currentPlan ||
      actionLoading
    ) {
      return;
    }

    if (
      getPlanInterval(currentPlan) !== "month" ||
      getPlanInterval(plan) !== "month"
    ) {
      setError(
        "Only monthly plan changes are supported."
      );
      return;
    }

    setActionLoading(`preview-${plan.id}`);
    setError("");
    setNotice("");

    try {
      const result = await apiRequest(
        "/subscriptions/change-plan/preview",
        {
          method: "POST",
          body: JSON.stringify({
            plan_id: plan.id,
          }),
        }
      );

      setNotice(
        `${result.current_plan} → ${result.new_plan}. Estimated charge: ` +
        `${formatMoney(
          result.estimated_invoice_total,
          result.currency
        )}. No payment has been made.`
      );

      if (
        Number(plan.price) >
        Number(currentPlan.price)
      ) {
        setUpgradePreview({
          planId: plan.id,
          planName: result.new_plan,
          amount: result.estimated_invoice_total,
          currency: result.currency,
        });
      } else {
        setUpgradePreview(null);
      }
    } catch (err) {
      setError(
        err.message ||
        "Unable to preview plan change."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =====================================
  // CONFIRM UPGRADE
  // =====================================

  async function handleConfirmUpgrade() {
    if (
      !upgradePreview ||
      !isActive ||
      actionLoading
    ) {
      return;
    }

    const approved = window.confirm(
      `Upgrade to ${upgradePreview.planName}?\n\n` +
      `Estimated payment: ${formatMoney(
        upgradePreview.amount,
        upgradePreview.currency
      )}\n\n` +
      "The final amount may differ."
    );

    if (!approved) return;

    setActionLoading("upgrade");
    setError("");

    try {
      const result = await apiRequest(
        "/subscriptions/change-plan/upgrade",
        {
          method: "POST",
          body: JSON.stringify({
            plan_id: upgradePreview.planId,
            confirm: true,
          }),
        }
      );

      setUpgradePreview(null);

      setNotice(
        result.payment_pending
          ? "Upgrade payment pending. Your plan will update after confirmation."
          : "Upgrade submitted. Refresh after payment verification."
      );

      await loadSubscriptionData();
    } catch (err) {
      setError(
        err.message ||
        "Unable to upgrade subscription."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =====================================
  // SCHEDULE DOWNGRADE
  // =====================================

  async function handleScheduleDowngrade(plan) {
    if (
      !isActive ||
      !currentPlan ||
      actionLoading
    ) {
      return;
    }

    const oldInterval =
      getPlanInterval(currentPlan);

    const newInterval =
      getPlanInterval(plan);

    const monthlyDowngrade =
      oldInterval === "month" &&
      newInterval === "month" &&
      Number(plan.price) <
      Number(currentPlan.price);

    const intervalChange =
      ["month", "year"].includes(oldInterval) &&
      ["month", "year"].includes(newInterval) &&
      oldInterval !== newInterval;

    if (!monthlyDowngrade && !intervalChange) {
      setError("Unsupported plan change.");
      return;
    }

    const approved = window.confirm(
      `Schedule ${currentPlan.name} → ${plan.name}?\n\n` +
      `Current plan ends: ${formatDate(
        subscription.current_period_end
      )}.\n` +
      "The new plan starts at renewal, subject to payment."
    );

    if (!approved) return;

    setActionLoading(`downgrade-${plan.id}`);
    setError("");
    setNotice("");

    try {
      const result = await apiRequest(
        "/subscriptions/change-plan/downgrade",
        {
          method: "POST",
          body: JSON.stringify({
            plan_id: plan.id,
            confirm: true,
          }),
        }
      );

      setNotice(
        `${result.current_plan} → ${result.next_plan} scheduled for ` +
        `${formatDate(result.effective_at)}.`
      );

      await loadSubscriptionData();
    } catch (err) {
      setError(
        err.message ||
        "Unable to schedule plan change."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =====================================
  // CHECK PENDING PAYMENTS
  // =====================================

  async function handleCleanupPayments() {
    if (actionLoading) return;

    setActionLoading("cleanup");
    setError("");
    setNotice("");

    try {
      const result = await apiRequest(
        "/subscriptions/payments/cleanup",
        {
          method: "POST",
        }
      );

      await loadSubscriptionData();

      setNotice(
        `Payment check completed. ${result.expired} expired, ` +
        `${result.verification_pending} pending verification, ` +
        `${result.still_open} still open.`
      );
    } catch (err) {
      setError(
        err.message ||
        "Unable to check pending payments."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =====================================
  // COMMON TOPBAR LOGOUT
  // =====================================

  async function signOut() {
    try {
      await logoutUser();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      sessionStorage.removeItem(
        "advocanote_access_token"
      );

      sessionStorage.removeItem(
        "advocanote_refresh_token"
      );

      sessionStorage.removeItem(
        "advocanote_auth_toast"
      );

      navigate("/login", {
        replace: true,
      });
    }
  }

  // =====================================
  // PAGE RENDER
  // =====================================

  return (
    <>
      {/* =====================================
          EXISTING COMMON LAWYER TOPBAR
      ===================================== */}

      <LawyerTopbarPortal>

        {/* MOBILE SIDEBAR */}

        <button
          type="button"
          className="ald-mobile-menu"
          aria-label="Open sidebar"
          onClick={openSidebar}
        >
          <Menu size={22} />
        </button>

        {/* SEARCH BAR */}

        <div className="ald-global-search">
          <Search size={20} />

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search plans or payments..."
            aria-label="Search plans or payments"
          />
        </div>

        {/* PROFILE SECTION */}

        <div className="ald-topbar-actions">
          <div className="ald-topbar-divider" />

          <div className="ald-dropdown-holder">

            <button
              type="button"
              className="ald-account"
              aria-label="Account menu"
              aria-expanded={profileOpen}
              onClick={() =>
                setProfileOpen(
                  (previous) => !previous
                )
              }
            >
              <LawyerTopbarAvatar />

              <span className="ald-account-text">
                <strong>{displayName}</strong>
                <small>Attorney-at-Law</small>
              </span>

              <ChevronDown size={18} />
            </button>

            {/* PROFILE DROPDOWN */}

            {profileOpen && (
              <div className="ald-top-popover ald-account-popover">

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/profile");
                  }}
                >
                  <UserRound size={16} />
                  My Profile
                </button>

                <button
                  type="button"
                  onClick={signOut}
                >
                  <LogOut size={16} />
                  Logout
                </button>

              </div>
            )}

          </div>
        </div>

      </LawyerTopbarPortal>

      {/* =====================================
          SUBSCRIPTION MAIN CONTENT
      ===================================== */}

      <main className="anp-page">

        <div className="anp-container">

          {/* PAGE HEADER */}

          <div className="anp-page-header">
            <div>
              <h1>Subscription & Billing</h1>
              <p>
                Manage your plan and payments.
              </p>
            </div>


          </div>

          <div className="ans-page">

            {/* PAYMENT NOTIFICATIONS */}

            {notice && (
              <div className="ans-message ans-message-info">
                <CheckCircle2 size={18} />
                <span>{notice}</span>
              </div>
            )}

            {/* UPGRADE CONFIRMATION */}

            {upgradePreview && (
              <div className="ans-plan-note">

                <div>
                  <strong>
                    Upgrade to {upgradePreview.planName}
                  </strong>

                  <p>
                    Estimated payment:{" "}
                    {formatMoney(
                      upgradePreview.amount,
                      upgradePreview.currency
                    )}
                  </p>

                  <p>
                    Final amount may differ.
                  </p>
                </div>

                <button
                  type="button"
                  className="ans-button ans-button-primary"
                  onClick={handleConfirmUpgrade}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "upgrade"
                    ? "Processing..."
                    : "Confirm Upgrade"}
                </button>

                <button
                  type="button"
                  className="ans-button ans-button-outline"
                  onClick={() =>
                    setUpgradePreview(null)
                  }
                  disabled={actionLoading !== null}
                >
                  Cancel
                </button>

              </div>
            )}

            {/* ERROR MESSAGE */}

            {error && (
              <div
                className="ans-message ans-message-error"
                role="alert"
              >
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* LOADING */}

            {loading ? (
              <div className="ans-loading">
                <LoaderCircle
                  className="ans-spin"
                  size={26}
                />
                <p>
                  Loading subscriptions...
                </p>
              </div>
            ) : (
              <>


                {/* =====================================
    CURRENT PLAN + PAYMENT HISTORY
===================================== */}

                <section className="ans-overview">

                  {/* CURRENT PLAN - LEFT SIDE */}

                  <div className="ans-overview-main">



                    <div className="ans-current-header">
                      <h2 className="ans-current-title">
                        <span className="ans-current-emoji" aria-hidden="true">
                          👑
                        </span>
                        Current Plan
                      </h2>
                    </div>


                    <div className="ans-overview-heading">

                      <h2>
                        {subscription?.plan_name ||
                          currentPlan?.name ||
                          "No Active Plan"}
                      </h2>

                      <span
                        className={`ans-status ${isActive
                          ? "ans-status-active"
                          : "ans-status-neutral"
                          }`}
                      >
                        <span className="ans-status-dot" />

                        {formatStatus(subscriptionStatus)}
                      </span>

                    </div>

                    {/* SUBSCRIPTION DETAILS */}

                    <div className="ans-overview-details">

                      <div className="ans-overview-detail">
                        <CalendarDays size={19} />

                        <div>
                          <span>Period ends</span>

                          <strong>
                            {formatDate(
                              subscription?.current_period_end
                            )}
                          </strong>
                        </div>
                      </div>

                      <div className="ans-overview-detail">
                        <ShieldCheck size={19} />

                        <div>
                          <span>Billing status</span>

                          <strong>
                            {subscription?.cancel_at_period_end
                              ? "Cancellation scheduled"
                              : isActive
                                ? "Active"
                                : "Not active"}
                          </strong>
                        </div>
                      </div>

                    </div>

                    {/* BILLING ACTIONS */}

                    <div className="ans-overview-actions">

                      {hasSubscription && (
                        <button
                          type="button"
                          className="ans-button ans-button-primary"
                          onClick={handleManageBilling}
                          disabled={actionLoading !== null}
                        >
                          <CreditCard size={17} />

                          {actionLoading === "manage"
                            ? "Opening..."
                            : "Manage Billing"}

                          <ArrowUpRight size={16} />
                        </button>
                      )}

                      <button
                        type="button"
                        className="ans-button ans-button-outline"
                        onClick={loadSubscriptionData}
                        disabled={
                          loading ||
                          actionLoading !== null
                        }
                      >
                        <RefreshCw size={16} />
                        Refresh
                      </button>

                    </div>

                  </div>

                  {/* PAYMENT HISTORY - RIGHT SIDE */}

                  <section className="ans-payment-card">

                    <div className="ans-payment-card-header">

                      <div className="ans-payment-card-title">

                        <span className="ans-payment-heading-icon">
                          <CreditCard size={19} strokeWidth={2} />
                        </span>


                        <h2>Payment History</h2>
                      </div>

                      {sortedPayments.length > 3 && (
                        <button
                          type="button"
                          className="ans-payment-view-all"
                          onClick={() =>
                            setShowAllPayments((previous) => !previous)
                          }
                        >
                          {showAllPayments ? "Show Less" : "View All"}

                          <ArrowUpRight size={15} />
                        </button>
                      )}

                    </div>

                    {/* CHECK PENDING PAYMENTS */}

                    {payments.some(
                      (payment) => payment.status === "pending"
                    ) && (
                        <button
                          type="button"
                          className="ans-button ans-button-outline ans-payment-check"
                          onClick={handleCleanupPayments}
                          disabled={actionLoading !== null}
                        >
                          <RefreshCw size={15} />

                          {actionLoading === "cleanup"
                            ? "Checking..."
                            : "Check Pending Payments"}
                        </button>
                      )}

                    {/* PAYMENT RECORDS */}

                    {visiblePayments.length === 0 ? (

                      <div className="ans-empty ans-payment-empty">
                        <Receipt size={25} />

                        <h3>No payments found</h3>
                      </div>

                    ) : (

                      <div className="ans-table-wrapper ans-payment-preview-table">

                        <table className="ans-table">

                          <thead>
                            <tr>
                              <th>Plan</th>
                              <th>Date</th>
                              <th>Amount</th>
                              <th>Status</th>
                            </tr>
                          </thead>

                          <tbody>

                            {displayedPayments.map((payment) => {

                              const relatedPlan = plans.find(
                                (plan) =>
                                  Number(plan.id) ===
                                  Number(payment.plan_id)
                              );

                              return (
                                <tr key={payment.id}>

                                  <td>
                                    <div className="ans-payment-name">

                                      <span className="ans-payment-icon">
                                        <CreditCard size={17} />
                                      </span>

                                      <div>
                                        <strong>
                                          {relatedPlan?.name ||
                                            `Plan #${payment.plan_id}`}
                                        </strong>
                                      </div>

                                    </div>
                                  </td>

                                  <td className="ans-date-cell">
                                    <Clock3 size={15} />

                                    {formatDate(
                                      payment.paid_at ||
                                      payment.created_at
                                    )}
                                  </td>

                                  <td className="ans-amount">
                                    {formatMoney(
                                      payment.amount,
                                      payment.currency
                                    )}
                                  </td>

                                  <td>
                                    <span
                                      className={`ans-payment-status ans-payment-${String(
                                        payment.status
                                      ).toLowerCase()}`}
                                    >
                                      {formatStatus(payment.status)}
                                    </span>
                                  </td>

                                </tr>
                              );
                            })}

                          </tbody>

                        </table>

                      </div>

                    )}

                  </section>

                </section>

                {/* =========================
                    AVAILABLE PLANS
                ========================= */}

                <section className="ans-section">


                  <div className="ans-section-header">
                    <h2>Available Plans</h2>
                  </div>


                  {visiblePlans.length === 0 ? (
                    <div className="ans-empty">
                      <Crown size={26} />
                      <h3>
                        No plans available
                      </h3>
                    </div>
                  ) : (
                    <div className="ans-plans-grid">

                      {visiblePlans.map((plan) => {


                        const entryLimitText =
                          plan.daily_action_limit === null
                            ? "Unlimited diary entries"
                            : Number.isInteger(plan.daily_action_limit)
                              ? `${plan.daily_action_limit} diary entries per day`
                              : null;

                        const features = [
                          ...(entryLimitText ? [entryLimitText] : []),
                          ...getPlanFeatures(plan),
                        ];


                        const selected =
                          ["active", "trialing"].includes(
                            subscriptionStatus
                          ) &&
                          Number(subscription?.plan_id) ===
                          Number(plan.id);

                        const busy =
                          actionLoading ===
                          `checkout-${plan.id}`;

                        const oldInterval =
                          getPlanInterval(currentPlan);

                        const nextInterval =
                          getPlanInterval(plan);

                        const canChangePlan =
                          isActive &&
                          !selected &&
                          Boolean(currentPlan) &&
                          (
                            (
                              oldInterval === "month" &&
                              nextInterval === "month" &&
                              Number(plan.price) !==
                              Number(currentPlan.price)
                            ) ||
                            (
                              ["month", "year"].includes(oldInterval) &&
                              ["month", "year"].includes(nextInterval) &&
                              oldInterval !== nextInterval
                            )
                          );


                        return (
                          <article
                            key={plan.id}
                            className={`ans-plan ${selected
                              ? "ans-plan-selected"
                              : ""
                              }`}
                          >

                            {/* PLAN ICON */}

                            <div className="ans-plan-top">

                              <div className="ans-plan-icon">
                                <Crown size={20} />
                              </div>

                              {selected && (
                                <span className="ans-current-badge">
                                  <Check size={14} />
                                  Current Plan
                                </span>
                              )}

                            </div>

                            {/* PLAN NAME */}

                            <h3>
                              {plan.name}
                            </h3>

                            {plan.description && (
                              <p className="ans-plan-description">
                                {plan.description}
                              </p>
                            )}

                            {/* PLAN PRICE */}

                            <div className="ans-plan-price">

                              <strong>
                                {formatMoney(
                                  plan.price,
                                  plan.currency
                                )}
                              </strong>

                              <span>
                                {" "}
                                / {nextInterval}
                              </span>

                            </div>

                            {/* FEATURES */}

                            {features.length > 0 && (
                              <div className="ans-plan-features">

                                {features.map(
                                  (feature, index) => (
                                    <div
                                      key={`${feature}-${index}`}
                                      className="ans-feature"
                                    >
                                      <CheckCircle2 size={16} />
                                      <span>
                                        {feature}
                                      </span>
                                    </div>
                                  )
                                )}

                              </div>
                            )}

                            {/* PLAN BUTTON */}

                            <div className="ans-plan-bottom">

                              {canChangePlan ? (
                                <button
                                  type="button"
                                  className="ans-button ans-button-primary"
                                  disabled={
                                    actionLoading !== null
                                  }
                                  onClick={() => {

                                    if (
                                      oldInterval !== nextInterval ||
                                      Number(plan.price) <
                                      Number(currentPlan.price)
                                    ) {
                                      handleScheduleDowngrade(
                                        plan
                                      );
                                    } else {
                                      handlePreviewPlanChange(
                                        plan
                                      );
                                    }

                                  }}
                                >

                                  {actionLoading ===
                                    `preview-${plan.id}` ||
                                    actionLoading ===
                                    `downgrade-${plan.id}`
                                    ? "Processing..."
                                    : oldInterval !== nextInterval
                                      ? "Schedule Billing Change"
                                      : Number(plan.price) <
                                        Number(currentPlan.price)
                                        ? "Schedule Downgrade"
                                        : "Preview Upgrade"}

                                  <ArrowUpRight size={16} />

                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={`ans-button ${selected
                                    ? "ans-button-current"
                                    : "ans-button-primary"
                                    }`}
                                  disabled={
                                    !canSubscribe ||
                                    actionLoading !== null
                                  }
                                  onClick={() =>
                                    handleCheckout(plan.id)
                                  }
                                >

                                  {selected
                                    ? "Current Plan"
                                    : !canSubscribe
                                      ? "Unavailable"
                                      : busy
                                        ? "Redirecting..."
                                        : subscriptionStatus ===
                                          "canceled"
                                          ? "Subscribe Again"
                                          : "Choose Plan"}

                                  {!selected &&
                                    canSubscribe && (
                                      <ArrowUpRight
                                        size={16}
                                      />
                                    )}

                                </button>
                              )}

                            </div>

                          </article>
                        );
                      })}

                    </div>
                  )}

                </section>

              </>
            )}

          </div>

        </div>

      </main>
    </>
  );
}
