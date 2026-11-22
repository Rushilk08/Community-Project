from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
from services.auth import require_auth
from database.supabase_client import get_service_client
from config import Config

reports_bp = Blueprint("reports", __name__)

@reports_bp.route("/reports", methods=["POST"])
@require_auth()
def create_report():
    """
    Allow authenticated users (workers or customers) to report suspicious jobs,
    unsafe working conditions, wage theft, or abusive behavior.
    """
    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason", "")).strip()

    if not reason:
        return jsonify({
            "success": False,
            "message": "Report reason category is required.",
            "error_code": "VALIDATION_ERROR"
        }), 400

    reporter_id = g.current_user["id"]
    job_id = data.get("job_id")
    reported_user_id = data.get("reported_user_id")
    description = str(data.get("description", "")).strip()

    now_iso = datetime.now(timezone.utc).isoformat()

    if not Config.is_supabase_configured():
        mock_report = {
            "id": f"rep-{int(datetime.now().timestamp())}",
            "reported_by": reporter_id,
            "reason": reason,
            "description": description,
            "status": "pending",
            "created_at": now_iso
        }
        return jsonify({
            "success": True,
            "message": "Report submitted successfully for safety review (Demo Mode).",
            "report": mock_report,
            "data": mock_report
        }), 201

    try:
        client = get_service_client()

        report_payload = {
            "reported_by": reporter_id,
            "job_id": job_id,
            "reported_user_id": reported_user_id,
            "reason": reason,
            "description": description,
            "status": "pending",
            "created_at": now_iso
        }

        res = client.table("reports").insert(report_payload).execute()
        if not res or not res.data:
            return jsonify({
                "success": False,
                "message": "Failed to record report.",
                "error_code": "DATABASE_ERROR"
            }), 500

        created_report = res.data[0]

        # Audit log for legal safety record
        client.table("audit_logs").insert({
            "actor_id": reporter_id,
            "action": "SAFETY_REPORT_FILED",
            "entity_type": "report",
            "entity_id": str(created_report["id"]),
            "metadata": {"reason": reason, "job_id": job_id}
        }).execute()

        return jsonify({
            "success": True,
            "message": "Report submitted successfully. Our safety team will review it.",
            "report": created_report,
            "data": created_report
        }), 201

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Server error filing report: {str(e)}",
            "error_code": "SERVER_ERROR"
        }), 500


@reports_bp.route("/reports/my", methods=["GET"])
@require_auth()
def get_my_reports():
    """
    Retrieve reports submitted by the authenticated user.
    """
    reporter_id = g.current_user["id"]

    if not Config.is_supabase_configured():
        return jsonify({
            "success": True,
            "reports": [],
            "data": []
        }), 200

    try:
        client = get_service_client()
        res = client.table("reports").select("*").eq("reported_by", reporter_id).order("created_at", desc=True).execute()

        return jsonify({
            "success": True,
            "reports": res.data if res else [],
            "data": res.data if res else []
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to retrieve reports: {str(e)}",
            "error_code": "SERVER_ERROR"
        }), 500
