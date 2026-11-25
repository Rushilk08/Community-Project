from flask import Blueprint, request, jsonify, g
from services.auth import require_auth
from services.notifications import (
    get_user_notifications,
    mark_notification_read,
    mark_all_notifications_read
)

notifications_bp = Blueprint("notifications", __name__)

@notifications_bp.route("/notifications", methods=["GET"])
@require_auth()
def list_notifications():
    """
    Returns notifications for the current authenticated user.
    Supports query param ?unread_only=true
    """
    user_id = g.current_user["id"]
    unread_only = request.args.get("unread_only", "").lower() == "true"
    limit = int(request.args.get("limit", 50))

    notifications = get_user_notifications(user_id=user_id, unread_only=unread_only, limit=limit)
    unread_count = sum(1 for n in notifications if not n.get("is_read"))

    return jsonify({
        "success": True,
        "notifications": notifications,
        "unread_count": unread_count,
        "count": len(notifications)
    }), 200


@notifications_bp.route("/notifications/<notification_id>/read", methods=["PATCH"])
@require_auth()
def mark_single_notification_read(notification_id: str):
    """
    Marks a single notification as read.
    """
    user_id = g.current_user["id"]
    success = mark_notification_read(notification_id=notification_id, user_id=user_id)
    return jsonify({
        "success": success,
        "message": "Notification marked as read" if success else "Notification not found"
    }), 200 if success else 404


@notifications_bp.route("/notifications/mark-all-read", methods=["POST"])
@require_auth()
def mark_all_read():
    """
    Marks all notifications for the user as read.
    """
    user_id = g.current_user["id"]
    count = mark_all_notifications_read(user_id=user_id)
    return jsonify({
        "success": True,
        "message": f"Marked {count} notifications as read",
        "marked_count": count
    }), 200
