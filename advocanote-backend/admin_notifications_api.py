
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
# CREATE A REAL NOTIFICATION
# Call from existing backend events
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
                (type, title, message, details,
                 is_read, created_at)
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
