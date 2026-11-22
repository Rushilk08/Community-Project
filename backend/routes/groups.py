from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
from services.auth import require_auth
from database.supabase_client import get_service_client
from config import Config

groups_bp = Blueprint("groups", __name__)

@groups_bp.route("/groups", methods=["POST"])
@groups_bp.route("/workers/groups", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def create_group():
    """
    Worker creates a worker group/community.
    Dual routes support specification and frontend api.js.
    """
    data = request.get_json(silent=True) or {}
    group_name = str(data.get("group_name") or data.get("name") or "").strip()

    if not group_name or len(group_name) < 2:
        return jsonify({
            "success": False,
            "message": "Group name is required (minimum 2 characters).",
            "error_code": "VALIDATION_ERROR"
        }), 400

    worker_id = g.current_user["id"]

    if not Config.is_supabase_configured():
        mock_group = {
            "id": f"grp-{int(datetime.now().timestamp())}",
            "group_name": group_name,
            "created_by": worker_id
        }
        return jsonify({
            "success": True,
            "message": "Worker group created successfully (Demo Mode)",
            "group": mock_group,
            "data": mock_group
        }), 201

    try:
        client = get_service_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Insert worker group
        res = client.table("worker_groups").insert({
            "group_name": group_name,
            "created_by": worker_id,
            "created_at": now_iso
        }).execute()

        if not res or not res.data:
            return jsonify({
                "success": False,
                "message": "Failed to create group in database.",
                "error_code": "DATABASE_ERROR"
            }), 500

        new_group = res.data[0]
        group_id = new_group["id"]

        # 2. Add creator as accepted member
        client.table("group_members").insert({
            "group_id": group_id,
            "worker_id": worker_id,
            "invitation_status": "accepted",
            "created_at": now_iso
        }).execute()

        return jsonify({
            "success": True,
            "message": "Worker group created successfully.",
            "group": new_group,
            "data": new_group
        }), 201

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Server error creating group: {str(e)}",
            "error_code": "SERVER_ERROR"
        }), 500


@groups_bp.route("/groups/<group_id>/invite", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def invite_to_group(group_id: str):
    """
    Invite another worker to join the group.
    """
    data = request.get_json(silent=True) or {}
    invited_worker_id = data.get("worker_id")

    if not invited_worker_id:
        return jsonify({
            "success": False,
            "message": "Invited worker_id is required.",
            "error_code": "VALIDATION_ERROR"
        }), 400

    if not Config.is_supabase_configured():
        return jsonify({
            "success": True,
            "message": "Invitation sent successfully (Demo Mode)"
        }), 200

    try:
        client = get_service_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        # Insert group member invitation
        res = client.table("group_members").insert({
            "group_id": group_id,
            "worker_id": invited_worker_id,
            "invitation_status": "pending",
            "created_at": now_iso
        }).execute()

        return jsonify({
            "success": True,
            "message": "Worker invitation sent successfully.",
            "data": res.data[0] if res and res.data else {}
        }), 201

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to send invitation: {str(e)}",
            "error_code": "SERVER_ERROR"
        }), 500


@groups_bp.route("/groups/my", methods=["GET"])
@require_auth(allowed_roles=["worker"])
def get_my_groups():
    """
    Retrieve groups the worker has created or joined.
    """
    worker_id = g.current_user["id"]

    if not Config.is_supabase_configured():
        return jsonify({
            "success": True,
            "groups": [],
            "data": []
        }), 200

    try:
        client = get_service_client()
        memberships = client.table("group_members").select("group_id, invitation_status").eq("worker_id", worker_id).execute()

        if not memberships or not memberships.data:
            return jsonify({"success": True, "groups": [], "data": []}), 200

        group_ids = [m["group_id"] for m in memberships.data]
        groups_res = client.table("worker_groups").select("*").in_("id", group_ids).execute()

        return jsonify({
            "success": True,
            "groups": groups_res.data if groups_res else [],
            "data": groups_res.data if groups_res else []
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to retrieve groups: {str(e)}",
            "error_code": "SERVER_ERROR"
        }), 500
