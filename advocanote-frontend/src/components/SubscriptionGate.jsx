
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Crown,
  CalendarDays,
  Check,
  X,
  Zap,
} from "lucide-react";

// ==========================================
// API CONFIGURATION
// ==========================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

// ==========================================
// ADVOCANOTE COLORS
// ==========================================

const COLORS = {
  green: "#004535",
  gold: "#b89046",
  cream: "#fffdf7",
  border: "#e7ddc9",
  muted: "#66716b",
};

// ==========================================
// SUBSCRIPTION PLAN DETAILS
// ==========================================


function getPlanDetails(plan) {
  const isUnlimited =
    plan.daily_action_limit == null;

  return {
    icon:
      plan.billing_interval === "year"
        ? CalendarDays
        : isUnlimited
          ? Crown
          : Zap,

    description: isUnlimited
      ? "Unlimited diary entries"
      : `${plan.daily_action_limit} diary entries per day`,
  };
}

// ==========================================
// GET AUTH TOKEN
// ==========================================

function getToken() {
  return localStorage.getItem(
    "advocanote_access_token"
  );
}

// ==========================================
// API REQUEST
// ==========================================

async function apiRequest(
  path,
  method = "GET",
  body = null
) {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Please log in again."
    );
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      method,

      headers: {
        Authorization: `Bearer ${token}`,

        ...(body !== null
          ? {
            "Content-Type":
              "application/json",
          }
          : {}),
      },

      ...(body !== null
        ? {
          body: JSON.stringify(body),
        }
        : {}),
    }
  );

  const result = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const detail = result?.detail;

    throw new Error(
      typeof detail === "string"
        ? detail
        : detail?.message ||
        "Subscription request failed."
    );
  }

  return result;
}

// ==========================================
// CHECK ACTIVE BASIC DAILY LIMIT
// ==========================================


function dailyLimitReached(data) {
  return (
    data?.status === "active" &&
    data?.has_access === true &&
    Number.isInteger(data?.daily_action_limit) &&
    data.daily_action_limit > 0 &&
    data?.remaining_today === 0
  );
}


// ==========================================
// CHECK IF PAYMENT POPUP IS NEEDED
// ==========================================

function requiresSubscription(data) {
  if (!data) {
    return false;
  }

  // Active trial or valid paid plan:
  // Never show expired subscription popup.

  if (data.has_access === true) {
    return false;
  }

  // Show only after backend confirms
  // the lawyer has no usable subscription.

  return (
    data.has_access === false &&
    [
      "expired",
      "not_subscribed",
      "canceled",
    ].includes(data.status)
  );
}

// ==========================================
// MAIN SUBSCRIPTION GATE
// ==========================================

export default function SubscriptionGate() {
  const navigate = useNavigate();
  const [access, setAccess] = useState(null);

  const [plans, setPlans] = useState([]);

  // Modal can only be:
  //
  // null         = no popup
  // "expired"    = choose paid plan
  // "daily_limit" = upgrade Basic plan

  const [modal, setModal] = useState(null);

  const [busyPlan, setBusyPlan] = useState(null);

  const [error, setError] = useState("");

  // ======================================
  // LOAD SUBSCRIPTION ON DASHBOARD
  // ======================================

  useEffect(() => {
    let mounted = true;

    async function loadSubscription() {
      if (!getToken()) {
        return;
      }

      try {
        const data = await apiRequest(
          "/subscriptions/access"
        );

        if (!mounted) {
          return;
        }

        setAccess(data);
        setPlans(data.plans || []);

        // ==================================
        // FREE TRIAL - UNLIMITED
        // ==================================
        //
        // New lawyer's automatic free trial:
        //
        // status = trialing
        // has_access = true
        //
        // Absolutely no paid popup.

        if (
          data.status === "trialing" &&
          data.has_access === true
        ) {
          setModal(null);
          setError("");
          return;
        }

        // ==================================
        // VALID PAID SUBSCRIPTION
        // ==================================
        //
        // Basic, Premium or Annual:
        // Do not show expired-trial popup.
        //
        // Retain daily-limit popup only
        // if Basic already exhausted 3 actions.


        if (data.has_access === true) {
          setModal((current) => {
            if (
              current === "daily_limit" &&
              dailyLimitReached(data)
            ) {
              return "daily_limit";
            }

            return null;
          });

          return;
        }

        // ==================================
        // TRIAL / SUBSCRIPTION EXPIRED
        // ==================================

        if (requiresSubscription(data)) {
          setModal("expired");
          setError("");
        } else {
          setModal(null);
        }
      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error(
          "Subscription access error:",
          err
        );

        // API error does NOT mean that
        // the lawyer's free trial expired.

        setModal(null);
      }
    }

    loadSubscription();

    // Refresh subscription information
    // when the lawyer returns to the tab.

    window.addEventListener(
      "focus",
      loadSubscription
    );
    window.addEventListener(
      "advocanote:subscription-refresh",
      loadSubscription
    );

    return () => {
      mounted = false;

      window.removeEventListener(
        "focus",
        loadSubscription
      );
      window.removeEventListener(
        "advocanote:subscription-refresh",
        loadSubscription
      );
    };
  }, []);

  // ======================================
  // DETECT DAILY LIMIT FROM API
  // ======================================

  useEffect(() => {
    const originalFetch = window.fetch;

    const wrappedFetch = async (...args) => {
      const response = await originalFetch(
        ...args
      );

      // Only react to the specific
      // Basic daily-action-limit error.
      //
      // Other 429 errors are ignored.

      if (response.status === 429) {
        try {
          const body = await response
            .clone()
            .json();

          if (
            body?.detail?.code ===
            "DAILY_ACTION_LIMIT_REACHED"
          ) {
            window.dispatchEvent(
              new Event(
                "advocanote:subscription-limit"
              )
            );
          }
        } catch {
          // Do not modify normal API errors.
        }
      }

      return response;
    };

    window.fetch = wrappedFetch;

    // ====================================
    // HANDLE DAILY LIMIT EVENT
    // ====================================

    let active = true;

    async function handleDailyLimit() {
      if (!getToken()) {
        return;
      }

      try {
        // Verify the current subscription
        // before opening the upgrade popup.

        const data = await apiRequest(
          "/subscriptions/access"
        );

        if (!active) {
          return;
        }

        setAccess(data);
        setPlans(data.plans || []);

        // Show upgrade popup only for
        // active Basic with 0 actions left.

        if (dailyLimitReached(data)) {
          setError("");
          setModal("daily_limit");
        } else if (
          data.status === "trialing" &&
          data.has_access === true
        ) {
          // Active free trial:
          // never open subscription popup.

          setModal(null);
        } else if (
          requiresSubscription(data)
        ) {
          setModal("expired");
        } else {
          setModal(null);
        }
      } catch (err) {
        console.error(
          "Daily usage check failed:",
          err
        );
      }
    }

    window.addEventListener(
      "advocanote:subscription-limit",
      handleDailyLimit
    );

    return () => {
      active = false;

      if (window.fetch === wrappedFetch) {
        window.fetch = originalFetch;
      }

      window.removeEventListener(
        "advocanote:subscription-limit",
        handleDailyLimit
      );
    };
  }, []);

  // ======================================
  // STRIPE CHECKOUT / PLAN UPGRADE
  // ======================================

  async function choosePlan(planKey) {
    if (busyPlan) {
      return;
    }

    setBusyPlan(planKey);
    setError("");

    try {
      const result = await apiRequest(
        "/subscriptions/select",
        "POST",
        {
          plan_key: planKey,
        }
      );

      if (!result.redirect_url) {
        throw new Error(
          "Stripe payment link was not returned."
        );
      }
      if (result.flow === "resume_before_upgrade") {
        const approved = window.confirm(
          "Your current subscription is scheduled to cancel.\n\n" +
          "Stripe will open so you can confirm recurring billing renewal.\n\n" +
          "After renewal, return to AdvocaNote and choose your upgrade again.\n\n" +
          "Do you want to continue?"
        );

        if (!approved) {
          setBusyPlan(null);
          return;
        }
      }

      // New paid subscription:
      // Stripe Checkout.
      //
      // Existing paid subscription:
      // Stripe plan-change flow.

      window.location.assign(
        result.redirect_url
      );
    } catch (err) {
      setError(err.message);
      setBusyPlan(null);
    }
  }

  // ======================================
  // NEVER DISPLAY UNVERIFIED POPUP
  // ======================================

  // Before the backend returns access,
  // nothing is displayed.

  if (!access || !modal) {
    return null;
  }

  // ======================================
  // ABSOLUTE FREE TRIAL PROTECTION
  // ======================================

  if (
    access.status === "trialing" &&
    access.has_access === true
  ) {
    return null;
  }

  // ======================================
  // VALIDATE EXPIRED POPUP
  // ======================================

  if (
    modal === "expired" &&
    !requiresSubscription(access)
  ) {
    return null;
  }

  // ======================================
  // VALIDATE BASIC UPGRADE POPUP
  // ======================================

  if (
    modal === "daily_limit" &&
    !dailyLimitReached(access)
  ) {
    return null;
  }

  // ======================================
  // FILTER AVAILABLE PLANS
  // ======================================

  const isLimit = modal === "daily_limit";


  // ======================================
  // SUBSCRIPTION MODAL
  // ======================================

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background:
          "rgba(10, 24, 20, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        overflowY: "auto",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-title"
        style={{
          width: "100%",
          maxWidth: 880,
          maxHeight: "94vh",
          overflowY: "auto",
          background: COLORS.cream,
          border:
            `1px solid ${COLORS.border}`,
          borderRadius: 18,
          padding: 24,
          boxShadow:
            "0 24px 70px rgba(0,0,0,0.18)",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                color: COLORS.gold,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              ADVOCANOTE SUBSCRIPTIONS
            </div>

            <h2
              id="subscription-title"
              style={{
                margin: 0,
                color: COLORS.green,
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {isLimit
                ? "Daily Limit Reached"
                : "Choose Your Subscription"}
            </h2>

            <p
              style={{
                color: COLORS.muted,
                fontSize: 14,
                lineHeight: 1.7,
                marginTop: 10,
              }}
            >

              {isLimit
                ? (
                  `You have reached your daily limit of ${access.daily_action_limit} diary entries. Upgrade your plan or continue tomorrow.`
                )
                : access.status === "not_subscribed"
                  ? (
                    "Choose a subscription " +
                    "to continue using " +
                    "AdvocaNote."
                  )
                  : (
                    "Your subscription or " +
                    "free trial has ended. " +
                    "Select a plan to continue " +
                    "using AdvocaNote."
                  )}

            </p>
          </div>

          <button
            type="button"
            onClick={() => setModal(null)}
            aria-label="Close subscription dialog"
            style={{
              border: 0,
              background: "transparent",
              cursor: "pointer",
              color: COLORS.muted,
              padding: 5,
            }}
          >
            <X size={21} />
          </button>
        </div>

        {isLimit ? (
          <button
            type="button"
            onClick={() => navigate("/subscription")}
            style={{
              marginTop: 24,
              minHeight: 42,
              padding: "0 20px",
              borderRadius: 9,
              border: "none",
              background: COLORS.green,
              color: "#ffffff",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Upgrade Plan
          </button>
        ) : (
        <>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 14,
            marginTop: 24,
          }}

        >
          {plans.map((plan) => {
            const config = getPlanDetails(plan);

            const Icon = config.icon;

            const isPremium =
              plan.daily_action_limit == null;

            return (
              <div
                key={plan.key}
                style={{
                  border: isPremium
                    ? `2px solid ${COLORS.gold}`
                    : `1px solid ${COLORS.border}`,
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 13,
                }}
              >
                <Icon
                  size={25}
                  color={
                    isPremium
                      ? COLORS.gold
                      : COLORS.green
                  }
                />

                <h3
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 600,
                    color: COLORS.green,
                  }}
                >
                  {plan.name}
                </h3>

                <div>
                  <strong
                    style={{
                      fontSize: 25,
                      color: COLORS.green,
                    }}
                  >
                    Rs.{" "}
                    {Number(
                      plan.price
                    ).toLocaleString("en-LK")}
                  </strong>

                  <div
                    style={{
                      fontSize: 12,
                      color: COLORS.muted,
                      marginTop: 3,
                    }}
                  >
                    {plan.billing_interval === "year"
                      ? "Per year"
                      : "Per month"}
                  </div>
                </div>

                <p
                  style={{
                    fontSize: 13,
                    color: COLORS.muted,
                    lineHeight: 1.6,
                    minHeight: 42,
                    margin: 0,
                  }}
                >
                  {config.description}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 7,
                    alignItems: "center",
                    fontSize: 12,
                    color: COLORS.green,
                  }}
                >
                  <Check size={15} />
                  All AdvocaNote features
                </div>

                <button
                  type="button"
                  disabled={
                    busyPlan !== null ||
                    !plan.stripe_ready
                  }
                  onClick={() =>
                    choosePlan(plan.key)
                  }
                  style={{
                    marginTop: "auto",
                    minHeight: 42,
                    borderRadius: 9,
                    border: "none",
                    background: COLORS.green,
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    opacity:
                      busyPlan !== null ||
                        !plan.stripe_ready
                        ? 0.55
                        : 1,
                  }}
                >
                  {busyPlan === plan.key
                    ? "Opening Stripe..."
                    : plan.stripe_ready
                      ? `Choose ${plan.name}`
                      : "Payment Not Configured"}
                </button>
              </div>
            );
          })}

          {/* NO AVAILABLE UPGRADE PLANS */}

          {plans.length === 0 && (
            <p
              style={{
                color: COLORS.muted,
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "20px 10px",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              No subscription plans are currently available. Please contact support.
            </p>
          )}
        </div>

        {/* ERROR MESSAGE */}

        {error && (
          <p
            role="alert"
            style={{
              color: "#aa3131",
              marginTop: 16,
              fontSize: 13,
            }}
          >
            {error}
          </p>
        )}

        </>
        )}

        {/* FOOTER */}

        <p
          style={{
            marginTop: 20,
            marginBottom: 0,
            fontSize: 12,
            color: COLORS.muted,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Payments are processed through Stripe.
          Paid access is updated after
          payment verification.

          {isLimit &&
            " Your daily diary entry allowance resets the next day, Sri Lanka time."}
        </p>
      </div>
    </div>
  );
}
