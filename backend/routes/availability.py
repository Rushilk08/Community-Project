from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from services.auth import require_auth
from services.availability import check_worker_conflict, get_worker_calendar_data

availability_bp = Blueprint("availability", __name__)

@availability_bp.route("/workers/availability-calendar", methods=["GET"])
@require_auth(allowed_roles=["worker"])
def get_my_availability_calendar():
    """
    Returns the monthly availability calendar data for the logged in worker.
    Status colors:
    - green: Available
    - red: Booked
    - yellow: Pending Commitment / Cancellation
    - grey: Leave / Unavailable
    """
    worker_id = g.current_user["id"]
    now = datetime.now(timezone.utc)

    try:
        year = int(request.args.get("year", now.year))
        month = int(request.args.get("month", now.month))
    except (TypeError, ValueError):
        year, month = now.year, now.month

    calendar_days = get_worker_calendar_data(worker_id, year, month)
    return jsonify({
        "success": True,
        "worker_id": worker_id,
        "year": year,
        "month": month,
        "days": calendar_days
    }), 200


@availability_bp.route("/workers/check-conflict", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def check_job_conflict():
    """
    Validates whether the worker can accept a job without schedule collisions.
    Accepts:
    - job_date (YYYY-MM-DD)
    - start_time (HH:MM, default 09:00)
    - duration_hours (float, default 8.0)
    - job_id (optional)
    """
    payload = request.get_json(silent=True) or {}
    job_date = payload.get("job_date")
    start_time = payload.get("start_time", "09:00")
    duration_hours = payload.get("duration_hours", 8.0)
    exclude_job_id = payload.get("job_id")

    if not job_date:
        return jsonify({"success": False, "message": "job_date is required", "error_code": "VALIDATION_ERROR"}), 400

    worker_id = g.current_user["id"]
    result = check_worker_conflict(
        worker_id=worker_id,
        job_date_str=job_date,
        start_time_str=start_time,
        duration_hours=float(duration_hours or 8.0),
        exclude_job_id=exclude_job_id
    )

    return jsonify({
        "success": True,
        "can_accept": not result["conflict"],
        **result
    }), 200
