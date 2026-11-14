
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useLocation } from "react-router-dom";

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
} from "lucide-react";

import "./AccountPages.css";
import "./Subscription.css";

// ======================================
// BACKEND API CONFIGURATION
// ======================================

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ======================================
// AUTH TOKEN
// ======================================


function getAccessToken() {
  const token = sessionStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    return null;
  }

  return token.replace(/^Bearer\s+/i, "");
}
// ======================================
// API HELPER
// ======================================

async function apiRequest(
  endpoint,
  options = {}
) {
  const token = getAccessToken();

  const headers = {
    ...(options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(
    `${API_BASE}${endpoint}`,
    {
      ...options,
      headers,
      credentials: "include",
    }
  );

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    let message =
      "Unable to complete your request.";

    if (typeof result?.detail === "string") {
      message = result.detail;
    }

    if (response.status === 401) {
      message =
        "Your login session has expired. Please log in again.";
    }

    throw new Error(message);
  }

  return result;
}

// ======================================
// FORMAT HELPERS
// ======================================

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
  if (!value) {
    return "Not available";
  }

  const raw = String(value);

  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)
    ? raw
    : `${raw}Z`;

  const date = new Date(normalized);

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

function formatStatus(status) {
  const value = String(status || "unknown");

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getPlanFeatures(plan) {
  const features = plan?.features;

  if (Array.isArray(features)) {
    return features
      .map((feature) => {
        if (typeof feature === "string") {
          return feature;
        }

        return (
          feature?.name ||
          feature?.label ||
          feature?.feature_name ||
          ""
        );
      })
      .filter(Boolean);
  }

  if (
    features &&
    typeof features === "object"
  ) {
    return Object.entries(features)
      .filter(([, enabled]) => enabled === true)
      .map(([name]) =>
        formatStatus(name)
      );
  }

  return [];
}

function getPlanInterval(plan) {
  const interval =
    plan?.billing_interval ||
    plan?.interval ||
    plan?.billing_cycle;

  if (interval === "month" || interval === "monthly") {
    return "month";
  }

  if (interval === "year" || interval === "yearly") {
    return "year";
  }

  return "billing cycle";
}

// ======================================
// SUBSCRIPTION PAGE
// ======================================

export default function Subscription() {
  const location = useLocation();

  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] =
    useState(null);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [upgradePreview, setUpgradePreview] =
    useState(null);


  // ====================================
  // FETCH REAL BACKEND DATA
  // ====================================

  const loadSubscriptionData =
    useCallback(async () => {
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
    }, []);

  useEffect(() => {
    loadSubscriptionData();
  }, [loadSubscriptionData]);

  // ====================================
  // VERIFY STRIPE SUCCESS REDIRECT
  // ====================================

  useEffect(() => {
    if (
      location.pathname ===
      "/subscription/cancel"
    ) {
      setNotice(
        "Stripe Checkout was canceled. You can review your subscription below."
      );
      return;
    }

    if (
      location.pathname !==
      "/subscription/success"
    ) {
      return;
    }

    const params = new URLSearchParams(
      location.search
    );

    const sessionId = params.get("session_id");

    if (!sessionId) {
      setNotice(
        "Checking your subscription details. Please refresh if needed."
      );
      return;
    }

    let cancelled = false;

    async function verifyPayment() {
      setNotice(
        "Verifying your payment with AdvocaNote..."
      );

      try {
        const result = await apiRequest(
          `/subscriptions/checkout/status?session_id=${encodeURIComponent(
            sessionId
          )}`
        );

        if (cancelled) {
          return;
        }

        if (
          result?.payment_status === "paid" &&
          result?.subscription_status === "active"
        ) {
          setNotice(
            "Your payment has been verified and your subscription is active."
          );
        } else {
          setNotice(
            "Your payment is still being processed. Please refresh to check again."
          );
        }

        await loadSubscriptionData();
      } catch (err) {
        if (!cancelled) {
          setNotice(
            "Payment verification is pending. Please refresh shortly or contact support if it does not update."
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

  // ====================================
  // CURRENT PLAN
  // ====================================

  const currentPlan = useMemo(() => {
    if (!subscription?.plan_id) {
      return null;
    }

    return plans.find(
      (plan) =>
        Number(plan.id) ===
        Number(subscription.plan_id)
    ) || null;
  }, [plans, subscription]);

  const subscriptionStatus =
    subscription?.status || "not_subscribed";

  const hasSubscription =
    Boolean(subscription?.plan_id);

  const isActive =
    subscriptionStatus === "active";


  const canSubscribe =
    !hasSubscription ||
    subscriptionStatus === "canceled";


  // ====================================
  // STRIPE CHECKOUT
  // ====================================

  async function handleCheckout(planId) {
    if (!canSubscribe || actionLoading) {
      return;
    }

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

      window.location.assign(
        result.checkout_url
      );
    } catch (err) {
      setError(err.message);
      setActionLoading(null);
    }
  }

  // ====================================
  // STRIPE BILLING PORTAL
  // ====================================

  async function handleManageBilling() {
    if (actionLoading) {
      return;
    }

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

      window.location.assign(
        result.portal_url
      );
    } catch (err) {
      setError(err.message);
      setActionLoading(null);
    }
  }


  // ====================================
  // PLAN CHANGE PREVIEW
  // ====================================

  async function handlePreviewPlanChange(plan) {
    if (!isActive || !currentPlan || actionLoading) {
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
        `Plan change preview: ${result.current_plan} → ` +
        `${result.new_plan}. Estimated invoice: ` +
        `${formatMoney(
          result.estimated_invoice_total,
          result.currency
        )}. No payment has been made.`
      );


      if (
        isActive &&
        Number(plan.price) > Number(currentPlan.price)
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
        err.message || "Unable to preview plan change."
      );
    } finally {
      setActionLoading(null);
    }
  }


  async function handleConfirmUpgrade() {
    if (!upgradePreview || !isActive || actionLoading) {
      return;
    }

    const approved = window.confirm(
      `Confirm upgrade to ${upgradePreview.planName}?\n\n` +
      `Estimated payment: ${formatMoney(
        upgradePreview.amount,
        upgradePreview.currency
      )}\n\n` +
      "Stripe Sandbox will attempt payment. " +
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
          ? "Upgrade payment is pending. Your plan will update after payment confirmation."
          : "Upgrade submitted to Stripe. Refresh your subscription after payment verification."
      );

      await loadSubscriptionData();
    } catch (err) {
      setError(
        err.message || "Unable to upgrade subscription."
      );
    } finally {
      setActionLoading(null);
    }
  }


  async function handleScheduleDowngrade(plan) {
    if (!isActive || !currentPlan || actionLoading) return;

    const oldInterval = getPlanInterval(currentPlan);
    const newInterval = getPlanInterval(plan);

    const monthlyDowngrade =
      oldInterval === "month" &&
      newInterval === "month" &&
      Number(plan.price) < Number(currentPlan.price);

    const intervalChange =
      ["month", "year"].includes(oldInterval) &&
      ["month", "year"].includes(newInterval) &&
      oldInterval !== newInterval;

    if (!monthlyDowngrade && !intervalChange) {
      setError("Unsupported plan change.");
      return;
    }

    const approved = window.confirm(
      `Schedule change from ${currentPlan.name} to ${plan.name}?\n\n` +
      `Your current plan remains active until ${formatDate(
        subscription.current_period_end
      )}.\n\n` +
      "The new billing plan starts at renewal, subject to payment."
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
        `${result.current_plan} → ${result.next_plan} ` +
        `scheduled for ${formatDate(result.effective_at)}.`
      );

      await loadSubscriptionData();
    } catch (err) {
      setError(err.message || "Unable to schedule plan change.");
    } finally {
      setActionLoading(null);
    }
  }

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
        `Payment check completed. ` +
        `${result.expired} unused checkout(s) expired. ` +
        `${result.verification_pending} payment(s) need verification. ` +
        `${result.still_open} checkout(s) remain open.`
      );

    } catch (err) {
      setError(
        err.message || "Unable to clean pending payments."
      );
    } finally {
      setActionLoading(null);
    }
  }



  // ====================================
  // RENDER
  // ====================================

  return (
    <main className="anp-page">
      <div className="anp-container">

        {/* PAGE HEADER */}

        <div className="anp-page-header">
          <div>
            <div className="anp-eyebrow">
              ADVOCANOTE
            </div>

            <h1>Subscription & Billing</h1>

            <p>
              View your subscription, explore plans,
              and manage payments securely.
            </p>
          </div>

          <div className="anp-header-icon">
            <Crown size={28} />
          </div>
        </div>

        <div className="ans-page">

          {/* NOTIFICATIONS */}

          {notice && (
            <div className="ans-message ans-message-info">
              <CheckCircle2 size={19} />
              <span>{notice}</span>
            </div>
          )}


          {upgradePreview && (
            <div className="ans-plan-note">
              <div>
                <strong>
                  Confirm upgrade to {upgradePreview.planName}
                </strong>

                <p>
                  Estimated payment:{" "}
                  {formatMoney(
                    upgradePreview.amount,
                    upgradePreview.currency
                  )}
                </p>

                <p>
                  This is an estimate. Stripe may calculate
                  a different final amount.
                </p>
              </div>

              <button
                type="button"
                className="ans-button ans-button-primary"
                onClick={() =>
                  handleConfirmUpgrade()
                }
                disabled={actionLoading !== null}
              >
                {actionLoading === "upgrade"
                  ? "Processing..."
                  : "Confirm Upgrade"}
              </button>

              <button
                type="button"
                className="ans-button ans-button-outline"
                onClick={() => setUpgradePreview(null)}
                disabled={actionLoading !== null}
              >
                Cancel
              </button>
            </div>
          )}


          {error && (
            <div
              className="ans-message ans-message-error"
              role="alert"
            >
              <AlertCircle size={19} />
              <span>{error}</span>
            </div>
          )}

          {/* LOADING */}

          {loading ? (
            <div className="ans-loading">
              <LoaderCircle
                className="ans-spin"
                size={28}
              />
              <p>
                Loading your subscription details...
              </p>
            </div>
          ) : (
            <>

              {/* CURRENT SUBSCRIPTION */}

              <section className="ans-overview">

                <div className="ans-overview-main">

                  <div className="ans-section-eyebrow">
                    <Crown size={16} />
                    YOUR MEMBERSHIP
                  </div>

                  <div className="ans-overview-heading">
                    <div>

                      <p className="ans-overview-caption">
                        {subscriptionStatus === "canceled"
                          ? "Previous subscription"
                          : "Current subscription"}
                      </p>


                      <h2>
                        {subscription?.plan_name ||
                          currentPlan?.name ||
                          "No Active Plan"}
                      </h2>
                    </div>

                    <span
                      className={`ans-status ${isActive
                        ? "ans-status-active"
                        : "ans-status-neutral"
                        }`}
                    >
                      <span className="ans-status-dot" />
                      {formatStatus(
                        subscriptionStatus
                      )}
                    </span>
                  </div>

                  <p className="ans-overview-description">
                    {isActive
                      ? "Your subscription is active. Your available features depend on your current plan."
                      : hasSubscription
                        ? "Your subscription details are shown below. Manage billing or contact support if you need help."
                        : "Choose an available plan to start your AdvocaNote subscription."}
                  </p>

                  <div className="ans-overview-details">

                    <div className="ans-overview-detail">
                      <CalendarDays size={20} />

                      <div>
                        <span>
                          Current period ends
                        </span>

                        <strong>
                          {formatDate(
                            subscription?.current_period_end
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="ans-overview-detail">
                      <ShieldCheck size={20} />

                      <div>
                        <span>
                          Billing arrangement
                        </span>

                        <strong>
                          {subscription?.cancel_at_period_end
                            ? "Cancellation scheduled"
                            : isActive
                              ? "Active subscription"
                              : "Not active"}
                        </strong>
                      </div>
                    </div>

                  </div>

                  <div className="ans-overview-actions">

                    {hasSubscription && (
                      <button
                        type="button"
                        className="ans-button ans-button-primary"
                        onClick={handleManageBilling}
                        disabled={
                          actionLoading !== null
                        }
                      >
                        <CreditCard size={18} />

                        {actionLoading === "manage"
                          ? "Opening Billing..."
                          : "Manage Billing"}

                        <ArrowUpRight size={17} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="ans-button ans-button-outline"
                      onClick={loadSubscriptionData}
                      disabled={loading}
                    >
                      <RefreshCw size={17} />
                      Refresh Details
                    </button>

                  </div>

                </div>

                <div className="ans-overview-side">

                  <div className="ans-side-icon">
                    <Crown
                      size={31}
                      strokeWidth={1.5}
                    />
                  </div>

                  <span>
                    ADVOCANOTE MEMBERSHIP
                  </span>

                  <h3>
                    Your legal work,
                    <br />
                    better organized.
                  </h3>

                  <p>
                    Manage your legal activities
                    with the features available
                    in your subscription.
                  </p>

                </div>

              </section>

              {/* AVAILABLE PLANS */}

              <section className="ans-section">

                <div className="ans-section-header">
                  <div>
                    <span className="ans-small-label">
                      FLEXIBLE SUBSCRIPTIONS
                    </span>

                    <h2>Available Plans</h2>

                    <p>
                      Choose a plan that suits
                      your legal practice.
                    </p>
                  </div>

                  <div className="ans-header-icon">
                    <Wallet size={21} />
                  </div>
                </div>

                {hasSubscription && (
                  <div className="ans-plan-note">
                    <ShieldCheck size={18} />

                    <p>
                      You already have a subscription
                      record. Use Manage Billing for
                      billing changes. Starting another
                      Checkout is disabled to prevent
                      duplicate subscriptions.
                    </p>
                  </div>
                )}

                {plans.length === 0 ? (
                  <div className="ans-empty">
                    <Crown size={28} />

                    <h3>No plans available</h3>

                    <p>
                      Subscription plans will appear
                      here when the admin enables them.
                    </p>
                  </div>
                ) : (
                  <div className="ans-plans-grid">


                    {plans
                      .filter(
                        (plan) => plan.name !== "Basic Sandbox Test"
                      )
                      .map((plan) => {

                        const features =
                          getPlanFeatures(plan);


                        const selected =
                          ["active", "trialing"].includes(subscriptionStatus) &&
                          Number(subscription?.plan_id) ===
                          Number(plan.id);


                        const busy =
                          actionLoading ===
                          `checkout-${plan.id}`;

                        return (
                          <article
                            key={plan.id}
                            className={`ans-plan ${selected
                              ? "ans-plan-selected"
                              : ""
                              }`}
                          >

                            <div className="ans-plan-top">
                              <div className="ans-plan-icon">
                                <Crown size={21} />
                              </div>

                              {selected && (
                                <span className="ans-current-badge">
                                  <Check size={14} />
                                  Current Plan
                                </span>
                              )}
                            </div>

                            <h3>{plan.name}</h3>

                            {plan.description && (
                              <p className="ans-plan-description">
                                {plan.description}
                              </p>
                            )}

                            <div className="ans-plan-price">
                              <strong>
                                {formatMoney(
                                  plan.price,
                                  plan.currency
                                )}
                              </strong>

                              <span>
                                / {getPlanInterval(plan)}
                              </span>
                            </div>

                            {features.length > 0 && (
                              <div className="ans-plan-features">
                                {features.map(
                                  (feature, index) => (
                                    <div
                                      key={`${feature}-${index}`}
                                      className="ans-feature"
                                    >
                                      <CheckCircle2 size={17} />
                                      <span>{feature}</span>
                                    </div>
                                  )
                                )}
                              </div>
                            )}


                            <div className="ans-plan-bottom">


                              {isActive &&
                                !selected &&
                                currentPlan &&
                                (
                                  (
                                    getPlanInterval(currentPlan) === "month" &&
                                    getPlanInterval(plan) === "month"
                                  ) ||
                                  (
                                    ["month", "year"].includes(getPlanInterval(currentPlan)) &&
                                    ["month", "year"].includes(getPlanInterval(plan)) &&
                                    getPlanInterval(currentPlan) !== getPlanInterval(plan)
                                  )
                                ) ? (


                                <button
                                  type="button"
                                  className="ans-button ans-button-primary"
                                  disabled={actionLoading !== null}


                                  onClick={() => {
                                    const intervalChanged =
                                      getPlanInterval(currentPlan) !== getPlanInterval(plan);

                                    if (
                                      intervalChanged ||
                                      Number(plan.price) < Number(currentPlan.price)
                                    ) {
                                      handleScheduleDowngrade(plan);
                                    } else {
                                      handlePreviewPlanChange(plan);
                                    }
                                  }}


                                >


                                  {actionLoading === `preview-${plan.id}` ||
                                    actionLoading === `downgrade-${plan.id}`
                                    ? "Processing..."
                                    : getPlanInterval(currentPlan) !== getPlanInterval(plan)
                                      ? "Schedule Billing Change"
                                      : Number(plan.price) < Number(currentPlan.price)
                                        ? "Schedule Downgrade"
                                        : "Preview Plan Change"}



                                  <ArrowUpRight size={17} />
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
                                  onClick={() => handleCheckout(plan.id)}
                                >

                                  {selected
                                    ? "Current Plan"
                                    : !canSubscribe
                                      ? "Subscription Exists"
                                      : busy
                                        ? "Redirecting..."
                                        : subscriptionStatus === "canceled"
                                          ? "Subscribe Again"
                                          : "Choose Plan"}


                                  {!selected && canSubscribe && (
                                    <ArrowUpRight size={17} />
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

              {/* PAYMENT HISTORY */}

              <section className="ans-section">

                <div className="ans-section-header">
                  <div>
                    <span className="ans-small-label">
                      BILLING RECORDS
                    </span>

                    <h2>Payment History</h2>

                    <p>
                      View your previous subscription
                      payments and their status.
                    </p>
                  </div>

                  <div className="ans-header-icon">
                    <Receipt size={21} />
                  </div>
                </div>

                {payments.some(
                  (payment) => payment.status === "pending"
                ) && (
                    <button
                      type="button"
                      className="ans-button ans-button-outline"
                      onClick={handleCleanupPayments}
                      disabled={actionLoading !== null}
                    >
                      <RefreshCw size={17} />

                      {actionLoading === "cleanup"
                        ? "Checking Payments..."
                        : "Check Pending Payments"}
                    </button>
                  )}


                {payments.length === 0 ? (
                  <div className="ans-empty">
                    <Receipt size={28} />

                    <h3>No payments yet</h3>

                    <p>
                      Your payment history will
                      appear here after you
                      make a payment.
                    </p>
                  </div>
                ) : (
                  <div className="ans-table-wrapper">
                    <table className="ans-table">

                      <thead>
                        <tr>
                          <th>Payment</th>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>

                      <tbody>

                        {payments.map((payment) => {
                          const relatedPlan =
                            plans.find(
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

                                    <small>
                                      Payment #{payment.id}
                                    </small>
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
                                  {formatStatus(
                                    payment.status
                                  )}
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

              {/* SECURITY NOTE */}

              <div className="ans-security-note">
                <ShieldCheck size={19} />

                <p>
                  Subscription payments are
                  processed through Stripe.
                  AdvocaNote displays billing
                  information received from
                  your account's backend records.
                </p>
              </div>

            </>
          )}

        </div>
      </div>
    </main>
  );
}
