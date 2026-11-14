
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
).replace(/\/$/, "");

function emptyForm() {
  return {
    name: "",
    description: "",
    price: "",
    billing_interval: "month",
    featuresText: "diary\ncases",
    trial_days: "0",
    is_active: false,
  };
}

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
      ...(body ? { body: JSON.stringify(body) } : {}),
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
  const [confirmPlan, setConfirmPlan] = useState(null);

  const [success, setSuccess] = useState("");

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

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

  function startCreate() {
    setMode("create");
    setEditingPlan(null);
    setForm(emptyForm());
    setError("");
    setSuccess("");
    setConfirmPlan(null);
  }

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
      trial_days: String(plan.trial_days ?? 0),
      is_active: Boolean(plan.is_active),
    });
  }

  function cancelEdit() {
    setMode(null);
    setEditingPlan(null);
    setError("");
  }

  async function submitForm(event) {
    event.preventDefault();

    if (saving) return;

    const name = form.name.trim();
    const description = form.description.trim();
    const features = parseFeatures(form.featuresText);
    const trialDays = Number(form.trial_days);

    if (name.length < 2 || name.length > 100) {
      setError("Plan name must contain 2–100 characters.");
      return;
    }

    if (description.length > 500) {
      setError("Description must not exceed 500 characters.");
      return;
    }

    if (features.length > 30) {
      setError("Maximum 30 features are allowed.");
      return;
    }

    if (
      !Number.isInteger(trialDays) ||
      trialDays < 0 ||
      trialDays > 30
    ) {
      setError("Trial days must be between 0 and 30.");
      return;
    }

    const isCreate = mode === "create";

    if (
      isCreate &&
      (
        !/^\d{1,8}(\.\d{1,2})?$/.test(form.price) ||
        Number(form.price) <= 0
      )
    ) {
      setError("Enter a valid LKR price, up to 2 decimal places.");
      return;
    }

    const hasSubscribers =
      !isCreate &&
      subscriberCount(editingPlan.id) > 0;

    const payload = {
      name,
      description: description || null,
      trial_days: trialDays,
    };

    // Existing subscribers must not receive
    // an unexpected feature change.
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

  return (
    <div className="apm-root">

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

      {error && (
        <div className="apm-alert apm-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="apm-alert apm-success" role="status">
          <CheckCircle2 size={17} />
          <span>{success}</span>
        </div>
      )}

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

            <label>
              Plan Name
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={form.name}
                onChange={(e) =>
                  updateField("name", e.target.value)
                }
                placeholder="e.g. Professional"
              />
            </label>

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
                  updateField("price", e.target.value)
                }
                placeholder="1000.00"
              />
            </label>

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
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </label>

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
                Enter one feature key per line, such
                as diary, cases, hearings, tasks or
                calendar.
              </small>
            </label>

          </div>

          {protectedFeatures && (
            <p className="apm-warning">
              This plan has active subscribers.
              Feature editing is locked to avoid
              unexpectedly changing their access.
            </p>
          )}

          {mode === "edit" && (
            <p className="apm-warning">
              Stripe billing terms cannot be edited
              here. Create another plan to use a
              different price or billing cycle.
            </p>
          )}

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

      <div className="asub-table-scroll">
        <table className="asub-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Price</th>
              <th>Billing</th>
              <th>Features</th>
              <th>Subscribers</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan="7" className="asub-empty">
                  No subscription plans found.
                </td>
              </tr>
            ) : (
              plans.map((plan) => {
                const count = subscriberCount(plan.id);

                return (
                  <tr key={plan.id}>

                    <td>
                      <strong>{plan.name}</strong>
                      <small className="apm-subtext">
                        Plan #{plan.id}
                      </small>
                    </td>

                    <td>
                      {money(
                        plan.price,
                        plan.currency || "LKR"
                      )}
                    </td>

                    <td>
                      {billingLabel(
                        plan.billing_interval
                      )}
                    </td>

                    <td>
                      {Array.isArray(plan.features)
                        ? plan.features.join(", ") || "—"
                        : "—"}
                    </td>

                    <td>{count}</td>

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

                    <td>
                      <div className="apm-table-actions">
                        <button
                          type="button"
                          className="apm-action"
                          disabled={saving}
                          onClick={() => startEdit(plan)}
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="apm-action"
                          disabled={
                            saving ||
                            (plan.is_active && count > 0)
                          }
                          title={
                            plan.is_active && count > 0
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
              onClick={() => setConfirmPlan(null)}
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
