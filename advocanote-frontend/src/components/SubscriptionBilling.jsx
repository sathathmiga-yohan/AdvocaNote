
import { useEffect, useState } from "react";
import "./SubscriptionBilling.css";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function billingRequest(path, options = {}) {
  const token = sessionStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error("Please log in again.");
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    }
  );

  const data = await response.json().catch(
    () => ({})
  );

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Subscription request failed."
    );
  }

  return data;
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPrice(subscription) {
  if (
    subscription?.price == null ||
    !subscription?.currency
  ) {
    return "Not available";
  }

  const amount = Number(subscription.price);

  if (!Number.isFinite(amount)) {
    return "Not available";
  }

  return (
    subscription.currency.toUpperCase() +
    " " +
    amount.toLocaleString("en-LK", {
      maximumFractionDigits: 2,
    })
  );
}

function getStatusLabel(subscription) {
  if (!subscription) return "No active plan";

  if (subscription.cancel_at_period_end) {
    return "Cancellation Scheduled";
  }

  const labels = {
    active: "Active",
    trialing: "Trial",
    canceled: "Cancelled",
    expired: "Expired",
    pending: "Pending",
    past_due: "Payment Due",
  };

  return (
    labels[subscription.status] ||
    subscription.status
  );
}

export default function SubscriptionBilling() {
  const [subscription, setSubscription] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] =
    useState(false);
  const [cancelling, setCancelling] =
    useState(false);

  async function loadSubscription() {
    setLoading(true);
    setError("");

    try {
      const data = await billingRequest(
        "/subscriptions/me"
      );

      // Existing backend returns flat JSON,
      // not { subscription: ... }
      setSubscription(
        data.status === "not_subscribed"
          ? null
          : data
      );

      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscription();
  }, []);

  async function handleCancel() {
    setCancelling(true);
    setError("");
    setMessage("");

    try {
      await billingRequest(
        "/subscriptions/cancel",
        { method: "POST" }
      );

      setShowConfirm(false);

      const refreshed = await loadSubscription();

      if (refreshed) {
        setMessage(
          "Cancellation scheduled successfully. " +
          "Your subscription will not renew."
        );
      }
    } catch (err) {
      setError(err.message);
      setShowConfirm(false);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="anb-loading">
        Loading your subscription...
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <div className="anb-error">
        <p>{error}</p>
        <button onClick={loadSubscription}>
          Try Again
        </button>
      </div>
    );
  }

  const scheduled =
    subscription?.cancel_at_period_end === true;

  const canCancel =
    subscription?.can_cancel === true;

  return (
    <div className="anb-container">

      {message && (
        <div className="anb-success">
          {message}
        </div>
      )}

      {error && (
        <div className="anb-error">
          {error}
        </div>
      )}

      <div className="anb-card">

        <div className="anb-card-header">
          <div>
            <span className="anb-small-label">
              CURRENT SUBSCRIPTION
            </span>

            <h3>
              {subscription?.plan_name ||
                "No subscription"}
            </h3>
          </div>

          <span
            className={
              "anb-status " +
              (scheduled
                ? "anb-status-pending"
                : subscription?.status === "active"
                ? "anb-status-active"
                : "anb-status-neutral")
            }
          >
            {getStatusLabel(subscription)}
          </span>
        </div>

        <div className="anb-details">

          <div className="anb-detail">
            <span>Plan Price</span>
            <strong>
              {formatPrice(subscription)}
            </strong>
          </div>

          <div className="anb-detail">
            <span>Billing Cycle</span>
            <strong>
              {subscription?.billing_cycle === "month"
                ? "Monthly"
                : subscription?.billing_cycle === "year"
                ? "Yearly"
                : "Not available"}
            </strong>
          </div>

          <div className="anb-detail">
            <span>
              {scheduled
                ? "Access Until"
                : subscription?.status === "trialing"
                ? "Trial Ends"
                : "Current Period Ends"}
            </span>

            <strong>
              {formatDate(
                subscription?.status === "trialing" &&
                !scheduled
                  ? subscription?.trial_ends_at
                  : subscription?.current_period_end
              )}
            </strong>
          </div>

        </div>

        {scheduled && (
          <div className="anb-notice">
            Your subscription will not renew.
            Your current access continues until
            the end of the billing period.
          </div>
        )}

        {canCancel && (
          <div className="anb-actions">
            <div>
              <strong>
                Cancel Subscription
              </strong>
              <p>
                Stop automatic renewal of
                your current plan.
              </p>
            </div>

            <button
              type="button"
              className="anb-cancel-button"
              onClick={() => setShowConfirm(true)}
            >
              Cancel Subscription
            </button>
          </div>
        )}

      </div>

      {showConfirm && (
        <div
          className="anb-overlay"
          role="presentation"
        >
          <div
            className="anb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="anb-dialog-title"
          >
            <h3 id="anb-dialog-title">
              Cancel Subscription?
            </h3>

            <p>
              Are you sure you want to cancel
              your AdvocaNote subscription?
            </p>

            <p>
              Your current subscription will
              remain available until the end
              of its billing period.
            </p>

            <div className="anb-modal-actions">

              <button
                type="button"
                className="anb-keep-button"
                disabled={cancelling}
                onClick={() =>
                  setShowConfirm(false)
                }
              >
                Keep Subscription
              </button>

              <button
                type="button"
                className="anb-confirm-button"
                disabled={cancelling}
                onClick={handleCancel}
              >
                {cancelling
                  ? "Cancelling..."
                  : "Confirm Cancellation"}
              </button>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
