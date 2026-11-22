
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ArrowDownUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import "./CaseTasks.css";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const PAGE_SIZE = 5;

const emptyForm = () => ({
  title: "",
  deadline: "",
  priority: "Medium",
});

async function request(path, options = {}) {
  const token = localStorage.getItem(
    "advocanote_access_token"
  );

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Request failed (${response.status})`
    );
  }

  return data;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(
    `${String(value).slice(0, 10)}T12:00:00`
  );

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
}

function todayLocal() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function displayStatus(task) {
  if (
    String(task.status || "").toLowerCase() === "completed"
  ) {
    return "Completed";
  }

  if (
    task.deadline &&
    String(task.deadline).slice(0, 10) < todayLocal()
  ) {
    return "Overdue";
  }

  return "Pending";
}

export default function CaseTasks({ caseId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [reverseSort, setReverseSort] = useState(false);
  const [page, setPage] = useState(1);

  const [dialog, setDialog] = useState(null);
  const [chosen, setChosen] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Load tasks belonging to this case only

  const loadTasks = useCallback(async () => {
    if (caseId == null) return;

    setLoading(true);

    try {
      const result = await request(
        `/tasks/case/${encodeURIComponent(caseId)}`      
      );

      setTasks(Array.isArray(result) ? result : []);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Search and sort

  const filtered = useMemo(() => {
    const searchText = query.trim().toLowerCase();

    const list = tasks.filter(
      (task) =>
        !searchText ||
        [
          task.title,
          task.status,
          task.priority,
          task.deadline,
          displayStatus(task),
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(searchText)
        )
    );

    list.sort((a, b) => {
      const dateA = a.deadline
        ? String(a.deadline).slice(0, 10)
        : "9999-12-31";

      const dateB = b.deadline
        ? String(b.deadline).slice(0, 10)
        : "9999-12-31";

      const order = dateA.localeCompare(dateB);

      return reverseSort ? -order : order;
    });

    return list;
  }, [tasks, query, reverseSort]);

  // Pagination

  const pages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * PAGE_SIZE;

  const visible = filtered.slice(
    start,
    start + PAGE_SIZE
  );

  // Add task popup

  const openAdd = () => {
    setChosen(null);
    setForm(emptyForm());
    setFormError("");
    setDialog("form");
  };

  // Edit task popup

  const openEdit = (task) => {
    setChosen(task);

    setForm({
      title: task.title || "",
      deadline: String(task.deadline || "").slice(0, 10),
      priority: task.priority || "Medium",
    });

    setFormError("");
    setDialog("form");
  };

  // Save new or edited task

  const save = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setFormError("Task title is required.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        title: form.title.trim(),
        deadline: form.deadline || null,
        priority: form.priority,
      };

      if (chosen) {
        await request(`/tasks/${chosen.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await request(
          `/tasks/case/${encodeURIComponent(caseId)}`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
      }

      setDialog(null);
      setPage(1);

      await loadTasks();
    } catch (err) {
      setFormError(err.message || "Could not save task.");
    } finally {
      setSaving(false);
    }
  };

  // Checkbox: Pending / Completed

  const toggleCompleted = async (task) => {
    setBusyId(task.id);
    setError("");

    try {
      const next =
        displayStatus(task) === "Completed"
          ? "Pending"
          : "Completed";

      await request(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });

      setTasks((old) =>
        old.map((item) =>
          item.id === task.id
            ? { ...item, status: next }
            : item
        )
      );

      setChosen((old) =>
        old?.id === task.id
          ? { ...old, status: next }
          : old
      );
    } catch (err) {
      setError(err.message || "Could not update status.");
    } finally {
      setBusyId(null);
    }
  };

  // Delete task

  const removeTask = async (task) => {
    if (
      !window.confirm(
        `Delete task "${task.title}"?`
      )
    ) {
      return;
    }

    setBusyId(task.id);
    setError("");

    try {
      await request(`/tasks/${task.id}`, {
        method: "DELETE",
      });

      setDialog(null);

      setTasks((old) =>
        old.filter((item) => item.id !== task.id)
      );
    } catch (err) {
      setError(err.message || "Could not delete task.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      className="cd-panel ct-panel"
      aria-label="Tasks for this case"
    >

{/* =====================================
    TASKS HEADER - DIARY HISTORY STYLE
===================================== */}

<div className="ct-heading ct-unified-header">

  {/* LEFT SIDE TITLE */}

  <div className="ct-title">
    <ClipboardList size={23} />

    <div>
      <h2>Tasks</h2>

      <p>
        All tasks and deadlines for this case.
      </p>
    </div>
  </div>

  {/* RIGHT SIDE CONTROLS */}

  <div className="ct-unified-actions">

    {/* SEARCH */}

    <label className="ct-search">
      <Search size={18} />

      <input
        aria-label="Search tasks"
        value={query}
        placeholder="Search tasks..."
        onChange={(event) => {
          setQuery(event.target.value);
          setPage(1);
        }}
      />
    </label>

    {/* SORT */}

    <button
      type="button"
      className="ct-sort"
      onClick={() => {
        setReverseSort((value) => !value);
        setPage(1);
      }}
    >
      <ArrowDownUp size={17} />
      Sort (Due Date)
    </button>

    {/* ADD TASK */}

    <button
      type="button"
      className="ct-primary"
      onClick={openAdd}
    >
      <Plus size={17} />
      Add Task
    </button>

  </div>

</div>


      {error && (
        <p className="ct-error" role="alert">
          {error}
        </p>
      )}

      {/* TASK TABLE */}

      {loading ? (
        <p className="ct-empty">
          Loading tasks...
        </p>
      ) : filtered.length === 0 ? (
        <p className="ct-empty">
          {query
            ? "No matching tasks found."
            : "No tasks for this case yet. Click Add Task to create one."}
        </p>
      ) : (
        <div className="ct-table-wrap">
          <table className="ct-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Task</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((task, index) => {
                const taskStatus = displayStatus(task);

                return (
                  <tr key={task.id}>
                    {/* COMPLETION CHECKBOX */}

                    <td>
                      <label
                        className="ct-check-row"
                        title="Mark task completed or pending"
                      >
                        <input
                          type="checkbox"
                          checked={
                            taskStatus === "Completed"
                          }
                          aria-label={`Mark ${task.title} ${
                            taskStatus === "Completed"
                              ? "pending"
                              : "completed"
                          }`}
                          disabled={
                            busyId === task.id
                          }
                          onChange={() =>
                            toggleCompleted(task)
                          }
                        />

                        <span>
                          {start + index + 1}
                        </span>
                      </label>
                    </td>

                    {/* TITLE */}

                    <td
                      className={
                        taskStatus === "Completed"
                          ? "ct-done-title"
                          : "ct-task-title"
                      }
                    >
                      {task.title}
                    </td>

                    {/* DUE DATE */}

                    <td>
                      {formatDate(task.deadline)}
                    </td>

                    {/* STATUS */}

                    <td>
                      <span
                        className={`ct-badge ct-${taskStatus.toLowerCase()}`}
                      >
                        {taskStatus}
                      </span>
                    </td>

                    {/* PRIORITY */}

                    <td>
                      <span
                        className={`ct-badge ct-priority-${String(
                          task.priority || "Medium"
                        ).toLowerCase()}`}
                      >
                        {task.priority || "Medium"}
                      </span>
                    </td>

                    {/* ACTIONS */}

                    <td>
                      <div className="ct-actions">
                        <button
                          type="button"
                          title="View Task"
                          aria-label={`View ${task.title}`}
                          onClick={() => {
                            setChosen(task);
                            setDialog("view");
                          }}
                        >
                          <Eye size={18} />
                        </button>

                        <button
                          type="button"
                          title="Edit Task"
                          aria-label={`Edit ${task.title}`}
                          onClick={() =>
                            openEdit(task)
                          }
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          className="ct-delete"
                          title="Delete Task"
                          aria-label={`Delete ${task.title}`}
                          disabled={
                            busyId === task.id
                          }
                          onClick={() =>
                            removeTask(task)
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PAGINATION */}

      <div className="ct-footer">
        <span>
          Showing{" "}
          {filtered.length ? start + 1 : 0} to{" "}
          {Math.min(
            start + PAGE_SIZE,
            filtered.length
          )}{" "}
          of {filtered.length} tasks
        </span>

        <div className="ct-pages">
          <button
            type="button"
            aria-label="Previous tasks page"
            disabled={currentPage <= 1}
            onClick={() =>
              setPage((value) =>
                Math.max(1, value - 1)
              )
            }
          >
            <ChevronLeft size={18} />
          </button>

          <span>{currentPage}</span>

          <button
            type="button"
            aria-label="Next tasks page"
            disabled={currentPage >= pages}
            onClick={() =>
              setPage((value) =>
                Math.min(pages, value + 1)
              )
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* TASK POPUPS */}

      {dialog && (
        <div
          className="ct-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setDialog(null);
            }
          }}
        >
          <section
            className="ct-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={
              dialog === "view"
                ? "Task details"
                : chosen
                ? "Edit task"
                : "Add task"
            }
          >
            <div className="ct-dialog-head">
              <h2>
                {dialog === "view"
                  ? "Task Details"
                  : chosen
                  ? "Edit Task"
                  : "Add Task"}
              </h2>

              <button
                type="button"
                aria-label="Close"
                disabled={saving}
                onClick={() =>
                  setDialog(null)
                }
              >
                <X size={18} />
              </button>
            </div>

            {/* VIEW TASK */}

            {dialog === "view" ? (
              <div className="ct-view">
                <h3>{chosen.title}</h3>

                <p>
                  <strong>Due Date:</strong>{" "}
                  {formatDate(chosen.deadline)}
                </p>

                <p>
                  <strong>Priority:</strong>{" "}
                  {chosen.priority || "Medium"}
                </p>

                <p>
                  <strong>Status:</strong>{" "}
                  {displayStatus(chosen)}
                </p>

                <button
                  type="button"
                  className="ct-primary"
                  disabled={busyId === chosen.id}
                  onClick={() =>
                    toggleCompleted(chosen)
                  }
                >
                  <Check size={16} />

                  {displayStatus(chosen) ===
                  "Completed"
                    ? "Mark as Pending"
                    : "Mark as Completed"}
                </button>
              </div>
            ) : (
              /* ADD / EDIT TASK */

              <form
                onSubmit={save}
                className="ct-form"
              >
                <label>
                  Task Title *

                  <input
                    required
                    maxLength={255}
                    value={form.title}
                    placeholder="e.g. Prepare written submissions"
                    onChange={(event) =>
                      setForm((old) => ({
                        ...old,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Due Date

                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(event) =>
                      setForm((old) => ({
                        ...old,
                        deadline: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Priority

                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((old) => ({
                        ...old,
                        priority: event.target.value,
                      }))
                    }
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>

                {formError && (
                  <p
                    className="ct-error"
                    role="alert"
                  >
                    {formError}
                  </p>
                )}

                <div className="ct-dialog-footer">
                  <button
                    type="button"
                    className="ct-secondary"
                    disabled={saving}
                    onClick={() =>
                      setDialog(null)
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="ct-primary"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Task"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
