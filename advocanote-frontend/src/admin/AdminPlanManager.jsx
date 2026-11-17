
import { useState } from "react";

import {
  Plus,
  Pencil,
  Power,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import "./AdminPlanManager.css";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

// ==========================================
// DEFAULT FORM
// ==========================================

function emptyForm() {
  return {
    name: "",
    description: "",
    price: "",
    billing_interval: "month",
    featuresText: "diary\ncases",
    trial_days: "0",

    // Empty = Unlimited diary entries.
    daily_action_limit: "",

    is_active: false,
  };
}

// ==========================================
// FORMAT HELPERS
// ==========================================

function money(value, currency = "LKR") {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency,
  }).format(amount);
}

function billingLabel(interval) {
  if (interval === "month") return "Monthly";
  if (interval === "year") return "Yearly";
  return interval || "—";
}

function dailyLimitLabel(limit) {
  if (limit == null) {
    return "Unlimited";
  }

  return `${limit} entries/day`;
}

function parseFeatures(text) {
  return [
    ...new Set(
      text
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

// ==========================================
// API ERROR HANDLING
// ==========================================

function errorText(data, status) {
  const detail = data?.detail;

  if (
    (status === 502 || status === 503) &&
    detail?.plan_id
  ) {
    return (
      `${detail.message || "Stripe synchronization failed"}. ` +
      `Plan #${detail.plan_id} may already exist ` +
      "in an inactive state. Do not create it again " +
      "until the Stripe link is checked."
    );
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (typeof detail?.message === "string") {
    return detail.message;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(", ");
  }

  return `Request failed (${status}).`;
}

async function adminRequest(path, method, body) {
  const token = sessionStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error(
      "Admin login is required."
    );
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization:
          `Bearer ${token.replace(/^Bearer\s+/i, "")}`,
        Accept: "application/json",
        ...(body
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(body
        ? { body: JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new Error(
      "Unable to connect to the FastAPI backend."
    );
  }

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      errorText(result, response.status)
    );
  }

  return result;
}

// ==========================================
// ADMIN PLAN MANAGER
// ==========================================

export default function AdminPlanManager({
  plans = [],
  lawyers = [],
  onChanged,
}) {
  const [mode, setMode] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmPlan, setConfirmPlan] = useState(null);

  // ========================================
  // UPDATE FORM FIELD
  // ========================================

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  // ========================================
  // COUNT EXISTING SUBSCRIBERS
  // ========================================

  function subscriberCount(planId) {
    return lawyers.filter((lawyer) => {
      const sub = lawyer.subscription;

      return (
        Number(sub?.plan_id) === Number(planId) &&
        ["active", "trialing", "past_due"].includes(
          String(sub?.status || "").toLowerCase()
        )
      );
    }).length;
  }

  // ========================================
  // START CREATE
  // ========================================

  function startCreate() {
    setMode("create");
    setEditingPlan(null);
    setForm(emptyForm());
    setError("");
    setSuccess("");
    setConfirmPlan(null);
  }

  // ========================================
  // START EDIT
  // ========================================

  function startEdit(plan) {
    setMode("edit");
    setEditingPlan(plan);
    setError("");
    setSuccess("");
    setConfirmPlan(null);

    setForm({
      name: plan.name || "",
      description: plan.description || "",
      price: String(plan.price ?? ""),
      billing_interval: plan.billing_interval,

      featuresText: Array.isArray(plan.features)
        ? plan.features.join("\n")
        : "",

      trial_days: String(
        plan.trial_days ?? 0
      ),

      daily_action_limit:
        plan.daily_action_limit == null
          ? ""
          : String(plan.daily_action_limit),

      is_active: Boolean(plan.is_active),
    });
  }

  // ========================================
  // CLOSE FORM
  // ========================================

  function cancelEdit() {
    setMode(null);
    setEditingPlan(null);
    setError("");
  }

  // ========================================
  // CREATE / UPDATE PLAN
  // ========================================

  async function submitForm(event) {
    event.preventDefault();

    if (saving) return;

    const name = form.name.trim();
    const description = form.description.trim();
    const features = parseFeatures(form.featuresText);
    const trialDays = Number(form.trial_days);

    const limitInput = String(
      form.daily_action_limit
    ).trim();

    const dailyLimit =
      limitInput === ""
        ? null
        : Number(limitInput);

    // --------------------------------------
    // VALIDATE PLAN NAME
    // --------------------------------------

    if (name.length < 2 || name.length > 100) {
      setError(
        "Plan name must contain 2–100 characters."
      );
      return;
    }

    // --------------------------------------
    // VALIDATE DESCRIPTION
    // --------------------------------------

    if (description.length > 500) {
      setError(
        "Description must not exceed 500 characters."
      );
      return;
    }

    // --------------------------------------
    // VALIDATE FEATURES
    // --------------------------------------

    if (features.length > 30) {
      setError(
        "Maximum 30 features are allowed."
      );
      return;
    }

    // --------------------------------------
    // VALIDATE TRIAL DAYS
    // --------------------------------------

    if (
      !Number.isInteger(trialDays) ||
      trialDays < 0 ||
      trialDays > 30
    ) {
      setError(
        "Trial days must be between 0 and 30."
      );
      return;
    }

    // --------------------------------------
    // VALIDATE DAILY DIARY ENTRY LIMIT
    // --------------------------------------

    if (
      dailyLimit !== null &&
      (
        !Number.isSafeInteger(dailyLimit) ||
        dailyLimit < 1
      )
    ) {
      setError(
        "Daily diary entry limit must be a positive whole number, or leave it empty for Unlimited."
      );
      return;
    }

    const isCreate = mode === "create";

    // --------------------------------------
    // VALIDATE PRICE
    // --------------------------------------

    if (
      isCreate &&
      (
        !/^\d{1,8}(\.\d{1,2})?$/.test(
          form.price
        ) ||
        Number(form.price) <= 0
      )
    ) {
      setError(
        "Enter a valid LKR price, up to 2 decimal places."
      );
      return;
    }

    // --------------------------------------
    // EXISTING SUBSCRIBERS
    // --------------------------------------

    const hasSubscribers =
      !isCreate &&
      subscriberCount(editingPlan.id) > 0;

    const previousLimit =
      editingPlan?.daily_action_limit ?? null;

    // Confirm a limit change that affects
    // lawyers already subscribed to the plan.

    if (
      hasSubscribers &&
      previousLimit !== dailyLimit
    ) {
      const approved = window.confirm(
        `Change the daily diary entry limit for ${editingPlan.name}?\n\n` +
        `Current: ${dailyLimitLabel(previousLimit)}\n` +
        `New: ${dailyLimitLabel(dailyLimit)}\n\n` +
        "This change will also affect existing subscribers on this plan."
      );

      if (!approved) return;
    }

    // --------------------------------------
    // API PAYLOAD
    // --------------------------------------

    const payload = {
      name,
      description: description || null,
      trial_days: trialDays,

      // Actual value saved in MySQL.
      // null = Unlimited.
      daily_action_limit: dailyLimit,
    };

    // Existing subscribers must not receive
    // unexpected feature changes.

    if (!hasSubscribers) {
      payload.features = features;
    }

    if (isCreate) {
      payload.price = form.price;
      payload.currency = "LKR";
      payload.billing_interval =
        form.billing_interval;
      payload.is_active = form.is_active;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (isCreate) {
        await adminRequest(
          "/admin/subscriptions/plans",
          "POST",
          payload
        );
      } else {
        await adminRequest(
          `/admin/subscriptions/plans/${editingPlan.id}`,
          "PATCH",
          payload
        );
      }

      setSuccess(
        isCreate
          ? "Plan created and linked to Stripe."
          : "Plan details updated."
      );

      setMode(null);
      setEditingPlan(null);

      onChanged?.();

    } catch (err) {
      setError(err.message);

    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // ACTIVATE / DEACTIVATE PLAN
  // ========================================

  async function toggleActive(plan) {
    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await adminRequest(
        `/admin/subscriptions/plans/${plan.id}`,
        "PATCH",
        {
          is_active: !plan.is_active,
        }
      );

      setConfirmPlan(null);

      setSuccess(
        plan.is_active
          ? "Plan deactivated."
          : "Plan activated."
      );

      onChanged?.();

    } catch (err) {
      setError(err.message);

    } finally {
      setSaving(false);
    }
  }

  const protectedFeatures =
    editingPlan &&
    subscriberCount(editingPlan.id) > 0;

  // ========================================
  // PAGE UI
  // ========================================

  return (
    <div className="apm-root">

      {/* HEADER */}

      <div className="apm-heading">
        <div>
          <h3>Manage Subscription Plans</h3>
          <p>
            Create Stripe plans and control which
            subscriptions are offered to lawyers.
          </p>
        </div>

        <button
          type="button"
          className="apm-button apm-primary"
          onClick={startCreate}
          disabled={saving}
        >
          <Plus size={17} />
          Create Plan
        </button>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div
          className="apm-alert apm-error"
          role="alert"
        >
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* SUCCESS MESSAGE */}

      {success && (
        <div
          className="apm-alert apm-success"
          role="status"
        >
          <CheckCircle2 size={17} />
          <span>{success}</span>
        </div>
      )}

      {/* CREATE / EDIT FORM */}

      {mode && (
        <form
          className="apm-form"
          onSubmit={submitForm}
        >
          <div className="apm-form-heading">
            <h3>
              {mode === "create"
                ? "Create Subscription Plan"
                : `Edit ${editingPlan?.name}`}
            </h3>

            <button
              type="button"
              className="apm-close"
              onClick={cancelEdit}
              disabled={saving}
              aria-label="Close form"
            >
              <X size={19} />
            </button>
          </div>

          <div className="apm-fields">

            {/* PLAN NAME */}

            <label>
              Plan Name

              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={form.name}
                onChange={(e) =>
                  updateField(
                    "name",
                    e.target.value
                  )
                }
                placeholder="e.g. Professional"
              />
            </label>

            {/* DESCRIPTION */}

            <label>
              Description

              <input
                type="text"
                maxLength={500}
                value={form.description}
                onChange={(e) =>
                  updateField(
                    "description",
                    e.target.value
                  )
                }
                placeholder="Who is this plan for?"
              />
            </label>

            {/* PRICE */}

            <label>
              Price (LKR)

              <input
                type="number"
                required
                min="0.01"
                max="99999999.99"
                step="0.01"
                value={form.price}
                disabled={mode === "edit"}
                onChange={(e) =>
                  updateField(
                    "price",
                    e.target.value
                  )
                }
                placeholder="1000.00"
              />
            </label>

            {/* BILLING CYCLE */}

            <label>
              Billing Cycle

              <select
                value={form.billing_interval}
                disabled={mode === "edit"}
                onChange={(e) =>
                  updateField(
                    "billing_interval",
                    e.target.value
                  )
                }
              >
                <option value="month">
                  Monthly
                </option>

                <option value="year">
                  Yearly
                </option>
              </select>
            </label>

            {/* DAILY DIARY ENTRY LIMIT */}

            <label>
              Daily Diary Entry Limit

              <input
                type="number"
                min="1"
                step="1"
                value={form.daily_action_limit}
                onChange={(e) =>
                  updateField(
                    "daily_action_limit",
                    e.target.value
                  )
                }
                placeholder="Empty = Unlimited"
              />

              <small>
                Leave empty for Unlimited,
                or enter 3, 5, 10, etc.
              </small>
            </label>

            {/* TRIAL DAYS */}

            <label>
              Trial Days

              <input
                type="number"
                min="0"
                max="30"
                step="1"
                value={form.trial_days}
                onChange={(e) =>
                  updateField(
                    "trial_days",
                    e.target.value
                  )
                }
              />
            </label>

            {/* ENABLED FEATURES */}

            <label className="apm-wide">
              Enabled Features

              <textarea
                rows={4}
                value={form.featuresText}
                disabled={Boolean(protectedFeatures)}
                onChange={(e) =>
                  updateField(
                    "featuresText",
                    e.target.value
                  )
                }
                placeholder={
                  "diary\ncases\nhearings\ntasks\ncalendar"
                }
              />

              <small>
                Enter one feature key per line,
                such as diary, cases, hearings,
                tasks or calendar.
              </small>
            </label>
          </div>

          {/* SUBSCRIBER WARNING */}

          {protectedFeatures && (
            <p className="apm-warning">
              This plan has active subscribers.
              Feature editing is locked to avoid
              unexpectedly changing their access.
              Changing the daily diary entry limit
              will affect existing subscribers.
            </p>
          )}

          {/* BILLING TERMS WARNING */}

          {mode === "edit" && (
            <p className="apm-warning">
              Stripe billing terms cannot be edited
              here. Create another plan to use a
              different price or billing cycle.
            </p>
          )}

          {/* CREATE PLAN ACTIVE STATUS */}

          {mode === "create" && (
            <label className="apm-checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  updateField(
                    "is_active",
                    e.target.checked
                  )
                }
              />

              Activate this plan after successful
              Stripe creation
            </label>
          )}

          {/* FORM BUTTONS */}

          <div className="apm-form-actions">

            <button
              type="button"
              className="apm-button apm-outline"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="apm-button apm-primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : mode === "create"
                  ? "Create Stripe Plan"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* =====================================
          PLANS TABLE
      ===================================== */}

      <div className="asub-table-scroll">
        <table className="asub-table">

          <thead>
            <tr>
              <th>Plan</th>
              <th>Price</th>
              <th>Billing</th>
              <th>Daily Entries</th>
              <th>Features</th>
              <th>Subscribers</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td
                  colSpan="8"
                  className="asub-empty"
                >
                  No subscription plans found.
                </td>
              </tr>
            ) : (
              plans.map((plan) => {
                const count = subscriberCount(
                  plan.id
                );

                return (
                  <tr key={plan.id}>

                    {/* PLAN */}

                    <td>
                      <strong>
                        {plan.name}
                      </strong>

                      <small className="apm-subtext">
                        Plan #{plan.id}
                      </small>
                    </td>

                    {/* PRICE */}

                    <td>
                      {money(
                        plan.price,
                        plan.currency || "LKR"
                      )}
                    </td>

                    {/* BILLING */}

                    <td>
                      {billingLabel(
                        plan.billing_interval
                      )}
                    </td>

                    {/* DAILY ENTRY LIMIT */}

                    <td>
                      {dailyLimitLabel(
                        plan.daily_action_limit
                      )}
                    </td>

                    {/* FEATURES */}

                    <td>
                      {Array.isArray(plan.features)
                        ? plan.features.join(", ") || "—"
                        : "—"}
                    </td>

                    {/* SUBSCRIBERS */}

                    <td>
                      {count}
                    </td>

                    {/* STATUS */}

                    <td>
                      <span
                        className={
                          `asub-status asub-status-${
                            plan.is_active
                              ? "active"
                              : "inactive"
                          }`
                        }
                      >
                        {plan.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    {/* ACTIONS */}

                    <td>
                      <div className="apm-table-actions">

                        <button
                          type="button"
                          className="apm-action"
                          disabled={saving}
                          onClick={() =>
                            startEdit(plan)
                          }
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="apm-action"
                          disabled={
                            saving ||
                            (
                              plan.is_active &&
                              count > 0
                            )
                          }
                          title={
                            plan.is_active &&
                            count > 0
                              ? "Active subscribers use this plan."
                              : ""
                          }
                          onClick={() =>
                            setConfirmPlan(plan)
                          }
                        >
                          <Power size={14} />

                          {plan.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* =====================================
          ACTIVATE / DEACTIVATE CONFIRMATION
      ===================================== */}

      {confirmPlan && (
        <div className="apm-confirm">

          <strong>
            {confirmPlan.is_active
              ? "Deactivate"
              : "Activate"}{" "}
            {confirmPlan.name}?
          </strong>

          <p>
            This changes the plan availability
            in AdvocaNote.
          </p>

          <div className="apm-form-actions">

            <button
              type="button"
              className="apm-button apm-outline"
              onClick={() =>
                setConfirmPlan(null)
              }
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="button"
              className="apm-button apm-primary"
              disabled={saving}
              onClick={() =>
                toggleActive(confirmPlan)
              }
            >
              {saving
                ? "Updating..."
                : "Confirm"}
            </button>

          </div>
        </div>
      )}
    </div>
  );
}
