import math
from datetime import datetime, timezone

from flask import Blueprint, current_app, g, jsonify, request

from config import Config
from database.supabase_client import get_service_client
from services.auth import require_auth
from services.validation import is_valid_uuid

worker_requests_bp = Blueprint("worker_requests", __name__)


def _database_unavailable():
    return jsonify({
        "success": False,
        "message": "Worker requests require a configured Supabase database.",
        "error_code": "DATABASE_NOT_CONFIGURED"
    }), 503


def _database_error(message):
    current_app.logger.exception(message)
    return jsonify({
        "success": False,
        "message": message,
        "error_code": "DATABASE_ERROR"
    }), 500


@worker_requests_bp.route("/bookings/<booking_id>/requests", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def create_worker_request(booking_id: str):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({
            "success": False,
            "message": "A JSON object with a request type and reason is required.",
            "error_code": "VALIDATION_ERROR"
        }), 400

    request_type = str(payload.get("request_type") or "").strip()
    reason = str(payload.get("reason") or "").strip()
    if request_type not in ("overtime_pay", "leave"):
        return jsonify({
            "success": False,
            "message": "Request type must be overtime_pay or leave.",
            "error_code": "VALIDATION_ERROR"
        }), 400
    if len(reason) < 5 or len(reason) > 500:
        return jsonify({
            "success": False,
            "message": "Please provide a reason between 5 and 500 characters.",
            "error_code": "VALIDATION_ERROR"
        }), 400

    requested_extra_pay = None
    if request_type == "overtime_pay":
        try:
            requested_extra_pay = float(payload.get("requested_extra_pay"))
        except (TypeError, ValueError):
            requested_extra_pay = 0
        if not math.isfinite(requested_extra_pay) or requested_extra_pay <= 0:
            return jsonify({
                "success": False,
                "message": "Overtime requests must include a positive extra payment amount.",
                "error_code": "VALIDATION_ERROR"
            }), 400
    elif payload.get("requested_extra_pay") not in (None, ""):
        return jsonify({
            "success": False,
            "message": "Leave requests cannot include an overtime payment amount.",
            "error_code": "VALIDATION_ERROR"
        }), 400

    if not Config.is_supabase_configured():
        return _database_unavailable()

    worker_id = g.current_user["id"]
    try:
        client = get_service_client()
        booking_res = (
            client.table("bookings")
            .select("id, job_id, worker_id, status")
            .eq("id", booking_id)
            .maybe_single()
            .execute()
        )
        booking = booking_res.data if booking_res else None
        if not booking:
            return jsonify({
                "success": False,
                "message": "Booking not found.",
                "error_code": "NOT_FOUND"
            }), 404
        if booking.get("worker_id") != worker_id:
            return jsonify({
                "success": False,
                "message": "Only the worker assigned to this booking can request a change.",
                "error_code": "FORBIDDEN"
            }), 403
        if booking.get("status") not in ("confirmed", "in_progress"):
            return jsonify({
                "success": False,
                "message": "Requests are only available for confirmed or in-progress bookings.",
                "error_code": "BOOKING_NOT_ACTIVE"
            }), 409

        job_res = (
            client.table("jobs")
            .select("id, customer_id, job_date, date")
            .eq("id", booking["job_id"])
            .maybe_single()
            .execute()
        )
        job = job_res.data if job_res else None
        if not job:
            return jsonify({
                "success": False,
                "message": "The job associated with this booking was not found.",
                "error_code": "NOT_FOUND"
            }), 404

        pending_res = (
            client.table("worker_requests")
            .select("id")
            .eq("booking_id", booking_id)
            .eq("request_type", request_type)
            .eq("status", "pending")
            .limit(1)
            .execute()
        )
        if pending_res and pending_res.data:
            return jsonify({
                "success": False,
                "message": "A request of this type is already waiting for the customer.",
                "error_code": "DUPLICATE_PENDING_REQUEST"
            }), 409

        now = datetime.now(timezone.utc).isoformat()
        request_record = {
            "booking_id": booking_id,
            "job_id": job["id"],
            "worker_id": worker_id,
            "customer_id": job["customer_id"],
            "request_type": request_type,
            "requested_extra_pay": requested_extra_pay,
            "leave_date": (job.get("job_date") or job.get("date")) if request_type == "leave" else None,
            "reason": reason,
            "status": "pending",
            "created_at": now,
            "updated_at": now
        }
        created_res = client.table("worker_requests").insert(request_record).execute()
        if not created_res or not created_res.data:
            return jsonify({
                "success": False,
                "message": "The request could not be saved.",
                "error_code": "DATABASE_ERROR"
            }), 500

        return jsonify({
            "success": True,
            "request": created_res.data[0]
        }), 201
    except Exception:
        return _database_error("Could not create the worker request.")


@worker_requests_bp.route("/bookings/<booking_id>/requests", methods=["GET"])
@require_auth()
def get_booking_requests(booking_id: str):
    if not Config.is_supabase_configured():
        return _database_unavailable()

    user_id = g.current_user["id"]
    try:
        client = get_service_client()
        booking_res = (
            client.table("bookings")
            .select("id, job_id, worker_id")
            .eq("id", booking_id)
            .maybe_single()
            .execute()
        )
        booking = booking_res.data if booking_res else None
        if not booking:
            return jsonify({
                "success": False,
                "message": "Booking not found.",
                "error_code": "NOT_FOUND"
            }), 404

        job_res = (
            client.table("jobs")
            .select("customer_id")
            .eq("id", booking["job_id"])
            .maybe_single()
            .execute()
        )
        job = job_res.data if job_res else None
        if not job:
            return jsonify({
                "success": False,
                "message": "The job associated with this booking was not found.",
                "error_code": "NOT_FOUND"
            }), 404
        if user_id not in (booking.get("worker_id"), job.get("customer_id")):
            return jsonify({
                "success": False,
                "message": "Only booking participants can view these requests.",
                "error_code": "FORBIDDEN"
            }), 403

        result = (
            client.table("worker_requests")
            .select("*")
            .eq("booking_id", booking_id)
            .order("created_at", desc=True)
            .execute()
        )
        records = result.data if result and result.data else []
        return jsonify({"success": True, "requests": records}), 200
    except Exception as e:
        err_str = str(e)
        if "PGRST205" in err_str or "schema cache" in err_str or "42501" in err_str:
            return jsonify({"success": True, "requests": []}), 200
        return _database_error("Could not load requests for this booking.")


@worker_requests_bp.route("/jobs/<job_id>/worker-requests", methods=["GET"])
@require_auth(allowed_roles=["customer"])
def get_job_worker_requests(job_id: str):
    if not is_valid_uuid(job_id):
        return jsonify({
            "success": True,
            "requests": [],
            "data": []
        }), 200

    if not Config.is_supabase_configured():
        return _database_unavailable()

    customer_id = g.current_user["id"]
    try:
        client = get_service_client()
        job_res = (
            client.table("jobs")
            .select("id")
            .eq("id", job_id)
            .eq("customer_id", customer_id)
            .maybe_single()
            .execute()
        )
        if not job_res or not job_res.data:
            return jsonify({
                "success": False,
                "message": "Job not found or you do not have access to it.",
                "error_code": "NOT_FOUND"
            }), 404

        bookings_res = (
            client.table("bookings")
            .select("id, worker_id")
            .eq("job_id", job_id)
            .execute()
        )
        bookings = bookings_res.data if bookings_res and bookings_res.data else []
        if not bookings:
            return jsonify({"success": True, "requests": []}), 200

        booking_ids = [booking["id"] for booking in bookings]
        worker_ids = list({booking["worker_id"] for booking in bookings})
        requests_res = (
            client.table("worker_requests")
            .select("*")
            .in_("booking_id", booking_ids)
            .order("created_at", desc=True)
            .execute()
        )
        records = requests_res.data if requests_res and requests_res.data else []
        profiles_res = (
            client.table("profiles")
            .select("id, full_name")
            .in_("id", worker_ids)
            .execute()
        )
        names = {
            profile["id"]: profile.get("full_name", "Worker")
            for profile in (profiles_res.data if profiles_res and profiles_res.data else [])
        }
        for record in records:
            record["worker_name"] = names.get(record.get("worker_id"), "Worker")
        return jsonify({"success": True, "requests": records}), 200
    except Exception as e:
        err_str = str(e)
        if "PGRST205" in err_str or "schema cache" in err_str or "42501" in err_str:
            return jsonify({"success": True, "requests": []}), 200
        return _database_error("Could not load worker requests for this job.")


@worker_requests_bp.route("/worker-requests/<request_id>", methods=["PATCH"])
@require_auth(allowed_roles=["customer"])
def resolve_worker_request(request_id: str):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or payload.get("decision") not in ("approve", "decline"):
        return jsonify({
            "success": False,
            "message": "Decision must be approve or decline.",
            "error_code": "VALIDATION_ERROR"
        }), 400
    if not Config.is_supabase_configured():
        return _database_unavailable()

    customer_id = g.current_user["id"]
    status = "approved" if payload["decision"] == "approve" else "declined"
    now = datetime.now(timezone.utc).isoformat()
    try:
        client = get_service_client()
        current_res = (
            client.table("worker_requests")
            .select("id, status")
            .eq("id", request_id)
            .eq("customer_id", customer_id)
            .maybe_single()
            .execute()
        )
        current = current_res.data if current_res else None
        if not current:
            return jsonify({
                "success": False,
                "message": "Worker request not found.",
                "error_code": "NOT_FOUND"
            }), 404
        if current.get("status") != "pending":
            return jsonify({
                "success": False,
                "message": "This request has already been resolved.",
                "error_code": "REQUEST_ALREADY_RESOLVED"
            }), 409

        update_res = (
            client.table("worker_requests")
            .update({"status": status, "resolved_at": now, "updated_at": now})
            .eq("id", request_id)
            .eq("customer_id", customer_id)
            .eq("status", "pending")
            .execute()
        )
        if not update_res or not update_res.data:
            return jsonify({
                "success": False,
                "message": "This request was already resolved by another action. Refresh and try again.",
                "error_code": "REQUEST_ALREADY_RESOLVED"
            }), 409
        return jsonify({"success": True, "request": update_res.data[0]}), 200
    except Exception:
        return _database_error("Could not update the worker request.")
