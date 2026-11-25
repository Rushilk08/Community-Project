from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid
from config import Config
from database.supabase_client import get_service_client

_demo_notifications_store: List[Dict[str, Any]] = []

def create_notification(
    user_id: str,
    title: str,
    message: str,
    notif_type: str = "general",
    data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Creates an in-app notification record and returns it.
    Works with live Supabase database or in-memory fallback.
    """
    notif_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    record = {
        "id": notif_id,
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "data": data or {},
        "is_read": False,
        "created_at": now_iso
    }

    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            res = client.table("notifications").insert(record).execute()
            if res and res.data:
                return res.data[0]
        except Exception as e:
            print(f"[Notifications] Error inserting notification: {e}")

    # Fallback store
    _demo_notifications_store.insert(0, record)
    return record


def get_user_notifications(user_id: str, unread_only: bool = False, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Retrieves notifications for a specific user.
    """
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            query = (
                client.table("notifications")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(limit)
            )
            if unread_only:
                query = query.eq("is_read", False)
            res = query.execute()
            if res and res.data is not None:
                return res.data
        except Exception as e:
            print(f"[Notifications] Error fetching notifications: {e}")

    # Fallback
    results = [
        n for n in _demo_notifications_store
        if n.get("user_id") == user_id and (not unread_only or not n.get("is_read"))
    ]
    return results[:limit]


def mark_notification_read(notification_id: str, user_id: str) -> bool:
    """
    Marks a notification as read.
    """
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            res = (
                client.table("notifications")
                .update({"is_read": True})
                .eq("id", notification_id)
                .eq("user_id", user_id)
                .execute()
            )
            return bool(res and res.data)
        except Exception as e:
            print(f"[Notifications] Error marking read: {e}")

    for n in _demo_notifications_store:
        if n.get("id") == notification_id and n.get("user_id") == user_id:
            n["is_read"] = True
            return True
    return False


def mark_all_notifications_read(user_id: str) -> int:
    """
    Marks all notifications for a user as read.
    """
    count = 0
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            res = (
                client.table("notifications")
                .update({"is_read": True})
                .eq("user_id", user_id)
                .eq("is_read", False)
                .execute()
            )
            if res and res.data:
                return len(res.data)
        except Exception as e:
            print(f"[Notifications] Error marking all read: {e}")

    for n in _demo_notifications_store:
        if n.get("user_id") == user_id and not n.get("is_read"):
            n["is_read"] = True
            count += 1
    return count
