
import json
import os
import sqlite3

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


# ========================================
# DATABASE
# ========================================

DB_FILE = Path(
    os.environ.get(
        "ADMIN_NOTIFICATIONS_DB",
        str(
            Path(__file__).resolve().parent
            / "admin_notifications.sqlite3"
        ),
    )
)

DB_FILE.parent.mkdir(parents=True, exist_ok=True)


def get_connection():
    connection = sqlite3.connect(
        DB_FILE,
        timeout=15,
    )
    connection.row_factory = sqlite3.Row
    return connection


def init_notifications_db():
    conn = get_connection()

    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '{}',
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


init_notifications_db()


# ========================================
# CREATE ADMIN NOTIFICATION
# ========================================

def create_admin_notification(
    type: str,
    title: str,
    message: str,
    details: dict | None = None,
):
    created_at = datetime.now(
        timezone.utc
    ).isoformat()

    conn = get_connection()

    try:
        cursor = conn.execute(
            """
            INSERT INTO admin_notifications
            (
                type,
                title,
                message,
                details,
                is_read,
                created_at
            )
            VALUES (?, ?, ?, ?, 0, ?)
            """,
            (
                type,
                title,
                message,
                json.dumps(details or {}),
                created_at,
            ),
        )

        conn.commit()
        return cursor.lastrowid

    finally:
        conn.close()

def create_admin_notification_once(
    type: str,
    title: str,
    message: str,
    details: dict,
    unique_detail_key: str,
):
    unique_value = details.get(unique_detail_key)

    if unique_value is None or unique_value == "":
        raise ValueError("Missing notification unique key")

    conn = get_connection()

    try:
        conn.execute("BEGIN IMMEDIATE")

        rows = conn.execute(
            """
            SELECT details
            FROM admin_notifications
            WHERE type = ? AND title = ?
            """,
            (type, title),
        ).fetchall()

        for row in rows:
            try:
                saved_details = json.loads(
                    row["details"] or "{}"
                )
            except (ValueError, TypeError):
                continue

            if (
                saved_details.get(unique_detail_key)
                == unique_value
            ):
                conn.commit()
                return None

        cursor = conn.execute(
            """
            INSERT INTO admin_notifications
            (
                type, title, message, details,
                is_read, created_at
            )
            VALUES (?, ?, ?, ?, 0, ?)
            """,
            (
                type,
                title,
                message,
                json.dumps(details),
                datetime.now(timezone.utc).isoformat(),
            ),
        )

        conn.commit()
        return cursor.lastrowid

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


# ==========================================
# ADMIN NOTIFICATION - FREE TRIAL STARTED
# ==========================================

def notify_free_trial_started(user, subscription):

    if (
        subscription.status != "trialing"
        or subscription.trial_ends_at is None
    ):
        return

    lawyer_name = (
        getattr(user, "full_name", None)
        or f"Lawyer #{user.id}"
    )

    create_admin_notification_once(
        type="trial",
        title="Free Trial Started",
        message=(
            f"{lawyer_name} has started "
            "a 1-month free trial."
        ),
        details={
            "lawyer_id": user.id,
            "lawyer_name": lawyer_name,
            "email": user.email,
            "plan": "Free Trial",
            "trial_status": "Active",
            "trial_end_date": (
                subscription.trial_ends_at.isoformat()
            ),
            "subscription_id": subscription.id,
            "activity": "Free Trial Started",
        },
        unique_detail_key="subscription_id",
    )


def format_notification(row):
    return {
        "id": row["id"],
        "type": row["type"],
        "title": row["title"],
        "message": row["message"],
        "details": json.loads(row["details"] or "{}"),
        "is_read": bool(row["is_read"]),
        "created_at": row["created_at"],
    }


# ========================================
# DELETE REQUEST MODEL
# ========================================

class DeleteSelectedRequest(BaseModel):
    ids: list[int] = Field(
        default_factory=list,
        max_length=500,
    )


# ========================================
# ADMIN PROTECTION
# Uses your existing FastAPI auth dependency
# ========================================

def create_notifications_router(get_current_user):

    router = APIRouter(
        prefix="/admin/notifications",
        tags=["Admin Notifications"],
    )

    def require_admin(
        current_user=Depends(get_current_user),
    ):
        if isinstance(current_user, dict):
            role = current_user.get("role", "")
            is_admin = current_user.get(
                "is_admin", False
            )
        else:
            role = getattr(
                current_user, "role", ""
            )
            is_admin = getattr(
                current_user, "is_admin", False
            )

        role = str(role or "").strip().lower()

        if (
            role not in {
                "admin",
                "superadmin",
                "super_admin",
            }
            and is_admin is not True
        ):
            raise HTTPException(
                status_code=403,
                detail="Admin access required.",
            )

        return current_user

    # ====================================
    # GET REAL NOTIFICATIONS
    # ====================================

    @router.get("")
    def get_notifications(
        admin=Depends(require_admin),
    ):
        conn = get_connection()

        try:
            rows = conn.execute(
                """
                SELECT *
                FROM admin_notifications
                ORDER BY id DESC
                """
            ).fetchall()

            return {
                "items": [
                    format_notification(row)
                    for row in rows
                ]
            }
        finally:
            conn.close()

    # ====================================
    # MARK ALL AS READ
    # ====================================

    @router.patch("/read-all")
    def mark_all_read(
        admin=Depends(require_admin),
    ):
        conn = get_connection()

        try:
            conn.execute(
                """
                UPDATE admin_notifications
                SET is_read = 1
                WHERE is_read = 0
                """
            )
            conn.commit()

            return {"success": True}
        finally:
            conn.close()

    # ====================================
    # MARK ONE AS READ
    # ====================================

    @router.patch("/{notification_id}/read")
    def mark_one_read(
        notification_id: int,
        admin=Depends(require_admin),
    ):
        conn = get_connection()

        try:
            cursor = conn.execute(
                """
                UPDATE admin_notifications
                SET is_read = 1
                WHERE id = ?
                """,
                (notification_id,),
            )

            conn.commit()

            if cursor.rowcount == 0:
                raise HTTPException(
                    status_code=404,
                    detail="Notification not found.",
                )

            return {"success": True}
        finally:
            conn.close()

    # ====================================
    # DELETE SELECTED
    # ====================================

    @router.post("/delete-selected")
    def delete_selected(
        payload: DeleteSelectedRequest,
        admin=Depends(require_admin),
    ):
        if not payload.ids:
            return {"success": True, "deleted": 0}

        placeholders = ",".join(
            "?" for _ in payload.ids
        )

        conn = get_connection()

        try:
            cursor = conn.execute(
                f"""
                DELETE FROM admin_notifications
                WHERE id IN ({placeholders})
                """,
                payload.ids,
            )

            conn.commit()

            return {
                "success": True,
                "deleted": cursor.rowcount,
            }
        finally:
            conn.close()

    # ====================================
    # DELETE ONE
    # ====================================

    @router.delete("/{notification_id}")
    def delete_one(
        notification_id: int,
        admin=Depends(require_admin),
    ):
        conn = get_connection()

        try:
            cursor = conn.execute(
                """
                DELETE FROM admin_notifications
                WHERE id = ?
                """,
                (notification_id,),
            )

            conn.commit()

            if cursor.rowcount == 0:
                raise HTTPException(
                    status_code=404,
                    detail="Notification not found.",
                )

            return {"success": True}
        finally:
            conn.close()

    return router

# ==========================================
# ADMIN - LAWYER ACCOUNT STATUS NOTIFICATION
# ==========================================

def notify_lawyer_status_changed(
    lawyer,
    previous_is_active: bool,
):
    current_is_active = bool(lawyer.is_active)

    # No notification if status has not changed
    if previous_is_active == current_is_active:
        return None

    action = (
        "Reactivated"
        if current_is_active
        else "Suspended"
    )

    lawyer_name = (
        lawyer.full_name
        or f"Lawyer #{lawyer.id}"
    )

    return create_admin_notification(
        type="account",
        title=f"Lawyer {action}",
        message=(
            f"{lawyer_name}'s account "
            f"has been {action.lower()}."
        ),
        details={
            "lawyer_id": lawyer.id,
            "lawyer_name": lawyer_name,
            "email": lawyer.email,
            "account_status": (
                "Active"
                if current_is_active
                else "Suspended"
            ),
            "activity": f"Lawyer {action}",
        },
    )
