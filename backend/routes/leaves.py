import uuid
from datetime import datetime, timezone, date
from flask import Blueprint, request, jsonify, g
from services.auth import require_auth
from services.validation import is_valid_uuid
from services.notifications import create_notification
from database.supabase_client import get_service_client
from config import Config

leaves_bp = Blueprint("leaves", __name__)

_demo_leaves_store = []

@leaves_bp.route("/leaves", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def apply_for_leave():
    """
    Worker applies for single or multi-day leave on an accepted job.
    """
    payload = request.get_json(silent=True) or {}
    job_id = str(payload.get("job_id") or "").strip()
    booking_id = str(payload.get("booking_id") or "").strip()
    start_date_str = str(payload.get("start_date") or "").strip()
    end_date_str = str(payload.get("end_date") or start_date_str).strip()
    reason = str(payload.get("reason") or "").strip()
    description = str(payload.get("description") or "").strip()
    is_emergency = bool(payload.get("is_emergency", False))

    if not job_id:
        return jsonify({"success": False, "message": "job_id is required", "error_code": "VALIDATION_ERROR"}), 400
    if not start_date_str:
        return jsonify({"success": False, "message": "start_date is required", "error_code": "VALIDATION_ERROR"}), 400
    if len(reason) < 3:
        return jsonify({"success": False, "message": "Please provide a valid reason for leave", "error_code": "VALIDATION_ERROR"}), 400

    try:
        start_d = datetime.strptime(start_date_str.split("T")[0], "%Y-%m-%d").date()
        end_d = datetime.strptime(end_date_str.split("T")[0], "%Y-%m-%d").date()
        if end_d < start_d:
            return jsonify({"success": False, "message": "End date cannot be earlier than start date", "error_code": "VALIDATION_ERROR"}), 400
    except Exception:
        return jsonify({"success": False, "message": "Invalid date format. Use YYYY-MM-DD", "error_code": "VALIDATION_ERROR"}), 400

    worker_id = g.current_user["id"]
    worker_name = g.current_profile.get("full_name", "Assigned Worker")
    leave_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    if Config.is_supabase_configured():
        try:
            client = get_service_client()

            # Find active booking if booking_id not provided
            if not booking_id:
                b_res = (
                    client.table("bookings")
                    .select("id, status")
                    .eq("job_id", job_id)
                    .eq("worker_id", worker_id)
                    .in_("status", ["confirmed", "in_progress"])
                    .maybe_single()
                    .execute()
                )
                if not b_res or not b_res.data:
                    return jsonify({"success": False, "message": "No active booking found for this job", "error_code": "NOT_FOUND"}), 404
                booking_id = b_res.data["id"]

            job_res = client.table("jobs").select("id, title, customer_id, status").eq("id", job_id).maybe_single().execute()
            job = job_res.data if job_res else None
            if not job:
                return jsonify({"success": False, "message": "Job not found", "error_code": "NOT_FOUND"}), 404

            customer_id = job.get("customer_id")

            # Check if pending leave already exists for overlapping dates
            existing_leaves = (
                client.table("leave_applications")
                .select("id, status")
                .eq("booking_id", booking_id)
                .eq("status", "pending")
                .execute()
            )
            if existing_leaves and existing_leaves.data:
                return jsonify({
                    "success": False,
                    "message": "You already have a pending leave request for this job.",
                    "error_code": "PENDING_REQUEST_EXISTS"
                }), 400

            leave_data = {
                "id": leave_id,
                "job_id": job_id,
                "booking_id": booking_id,
                "worker_id": worker_id,
                "customer_id": customer_id,
                "start_date": start_d.isoformat(),
                "end_date": end_d.isoformat(),
                "reason": reason,
                "description": description,
                "is_emergency": is_emergency,
                "status": "pending",
                "created_at": now_iso,
                "updated_at": now_iso
            }
            insert_res = client.table("leave_applications").insert(leave_data).execute()
            created_leave = insert_res.data[0] if insert_res and insert_res.data else leave_data

            # Notify customer immediately
            urgency_prefix = "🚨 EMERGENCY: " if is_emergency else ""
            date_label = start_d.isoformat() if start_d == end_d else f"{start_d.isoformat()} to {end_d.isoformat()}"
            create_notification(
                user_id=customer_id,
                title=f"{urgency_prefix}Leave Request Received",
                message=f"{worker_name} applied for leave on '{job.get('title')}' for {date_label}. Reason: {reason}",
                notif_type="leave",
                data={"leave_id": leave_id, "job_id": job_id, "is_emergency": is_emergency}
            )

            return jsonify({
                "success": True,
                "message": "Leave application submitted successfully. Customer notified.",
                "leave": created_leave
            }), 201

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo Fallback
    leave_data = {
        "id": leave_id,
        "job_id": job_id,
        "booking_id": booking_id or "demo-booking-1",
        "worker_id": worker_id,
        "customer_id": "customer-demo-1",
        "start_date": start_d.isoformat(),
        "end_date": end_d.isoformat(),
        "reason": reason,
        "description": description,
        "is_emergency": is_emergency,
        "status": "pending",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    _demo_leaves_store.insert(0, leave_data)
    from services.availability import _demo_availability_store
    _demo_availability_store["leaves"].append(leave_data)

    create_notification(
        user_id="customer-demo-1",
        title="Leave Request Received",
        message=f"{worker_name} applied for leave. Reason: {reason}",
        notif_type="leave",
        data={"leave_id": leave_id, "job_id": job_id}
    )

    return jsonify({
        "success": True,
        "message": "Leave application submitted successfully (Demo Mode)",
        "leave": leave_data
    }), 201


@leaves_bp.route("/leaves/my-leaves", methods=["GET"])
@require_auth(allowed_roles=["worker"])
def get_my_leaves():
    """
    Returns all leave requests submitted by the worker.
    """
    worker_id = g.current_user["id"]
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            res = (
                client.table("leave_applications")
                .select("*, jobs(id, title, worksite_address, location)")
                .eq("worker_id", worker_id)
                .order("created_at", desc=True)
                .execute()
            )
            return jsonify({"success": True, "leaves": res.data or []}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    user_leaves = [l for l in _demo_leaves_store if l.get("worker_id") == worker_id]
    return jsonify({"success": True, "leaves": user_leaves}), 200


@leaves_bp.route("/leaves/customer", methods=["GET"])
@require_auth(allowed_roles=["customer"])
def get_customer_leave_requests():
    """
    Customer views all leave requests for their jobs.
    """
    customer_id = g.current_user["id"]
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            res = (
                client.table("leave_applications")
                .select("*, jobs(id, title, worksite_address, location), profiles:worker_id(full_name, phone, skill)")
                .eq("customer_id", customer_id)
                .order("created_at", desc=True)
                .execute()
            )
            return jsonify({"success": True, "leaves": res.data or []}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    return jsonify({"success": True, "leaves": _demo_leaves_store}), 200


@leaves_bp.route("/leaves/<leave_id>/decision", methods=["PATCH"])
@require_auth(allowed_roles=["customer"])
def decide_leave_request(leave_id: str):
    """
    Customer approves or rejects a worker leave request.
    If approved:
    - Worker availability calendar reflects leave on those dates
    - Notifies worker
    - Customer is offered Find Replacement option
    If rejected:
    - Worker remains assigned
    - Notifies worker
    """
    payload = request.get_json(silent=True) or {}
    decision = str(payload.get("decision") or "").strip().lower()
    review_notes = str(payload.get("review_notes") or "").strip()

    if decision not in ["approved", "rejected"]:
        return jsonify({"success": False, "message": "Decision must be 'approved' or 'rejected'", "error_code": "VALIDATION_ERROR"}), 400

    customer_id = g.current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            leave_res = client.table("leave_applications").select("*, jobs(*)").eq("id", leave_id).maybe_single().execute()
            leave = leave_res.data if leave_res else None
            if not leave:
                return jsonify({"success": False, "message": "Leave application not found", "error_code": "NOT_FOUND"}), 404

            if leave.get("customer_id") != customer_id:
                return jsonify({"success": False, "message": "Unauthorized to decide on this leave request", "error_code": "FORBIDDEN"}), 403

            if leave.get("status") != "pending":
                return jsonify({"success": False, "message": f"Leave request is already {leave.get('status')}", "error_code": "ALREADY_DECIDED"}), 400

            updated = (
                client.table("leave_applications")
                .update({
                    "status": decision,
                    "review_notes": review_notes,
                    "reviewed_at": now_iso,
                    "updated_at": now_iso
                })
                .eq("id", leave_id)
                .execute()
            )

            job = leave.get("jobs") or {}
            job_title = job.get("title", "your job")

            # Notify Worker
            if decision == "approved":
                worker_msg = (
                    f"Your leave request for '{job_title}' ({leave.get('start_date')} to {leave.get('end_date')}) "
                    "has been APPROVED by the customer. Your schedule has been updated."
                )
            else:
                worker_msg = (
                    f"Your leave request for '{job_title}' was DECLINED by the customer. "
                    "You remain committed to this assignment."
                )

            create_notification(
                user_id=leave.get("worker_id"),
                title=f"Leave Request {decision.capitalize()}",
                message=worker_msg,
                notif_type="leave",
                data={"leave_id": leave_id, "status": decision}
            )

            # If approved, notify customer with Emergency Replacement reminder
            if decision == "approved":
                create_notification(
                    user_id=customer_id,
                    title="Worker Replacement Available",
                    message=f"Leave approved for worker. You can find an emergency replacement worker for '{job_title}' in Manage Workers.",
                    notif_type="replacement_opportunity",
                    data={"job_id": job.get("id"), "leave_id": leave_id, "replacement_date": leave.get("start_date")}
                )

            return jsonify({
                "success": True,
                "message": f"Leave request {decision} successfully.",
                "leave": updated.data[0] if updated and updated.data else None
            }), 200

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo Fallback
    for l in _demo_leaves_store:
        if l.get("id") == leave_id:
            l["status"] = decision
            l["review_notes"] = review_notes
            l["reviewed_at"] = now_iso
            from services.availability import _demo_availability_store
            for al in _demo_availability_store["leaves"]:
                if al.get("id") == leave_id:
                    al["status"] = decision
            create_notification(
                user_id=l.get("worker_id"),
                title=f"Leave Request {decision.capitalize()}",
                message=f"Your leave request was {decision}.",
                notif_type="leave",
                data={"leave_id": leave_id, "status": decision}
            )
            return jsonify({"success": True, "message": f"Leave request {decision} (Demo Mode)", "leave": l}), 200

    return jsonify({"success": False, "message": "Leave request not found", "error_code": "NOT_FOUND"}), 404


@leaves_bp.route("/leaves/<leave_id>/cancel", methods=["PATCH", "POST"])
@require_auth(allowed_roles=["worker"])
def cancel_own_leave(leave_id: str):
    """
    Worker cancels their own pending or approved leave request.
    Restores worker availability if approved leave is cancelled.
    """
    worker_id = g.current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    if not is_valid_uuid(leave_id):
        for l in _demo_leaves_store:
            if l.get("id") == leave_id and l.get("worker_id") == worker_id:
                l["status"] = "cancelled"
                return jsonify({"success": True, "message": "Leave request cancelled.", "status": "cancelled"}), 200
        return jsonify({"success": True, "message": "Demo leave cancelled.", "status": "cancelled"}), 200

    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            res = client.table("leave_applications").select("*").eq("id", leave_id).maybe_single().execute()
            if not res or not res.data:
                return jsonify({"success": False, "message": "Leave request not found", "error_code": "NOT_FOUND"}), 404
            leave = res.data
            if leave.get("worker_id") != worker_id:
                return jsonify({"success": False, "message": "Unauthorized", "error_code": "FORBIDDEN"}), 403
            if leave.get("status") not in ("pending", "approved"):
                return jsonify({"success": False, "message": "Can only cancel pending or approved leave requests", "error_code": "INVALID_STATE"}), 400

            client.table("leave_applications").update({
                "status": "cancelled",
                "updated_at": now_iso
            }).eq("id", leave_id).execute()

            # If worker was on approved leave, restore their online availability
            try:
                client.table("worker_profiles").update({
                    "is_available": True,
                    "updated_at": now_iso
                }).eq("user_id", worker_id).execute()
                client.table("profiles").update({
                    "is_available": True,
                    "updated_at": now_iso
                }).eq("id", worker_id).execute()
            except Exception as avail_err:
                print(f"[cancel_own_leave availability update warning] {avail_err}")

            return jsonify({
                "success": True,
                "message": "Leave request cancelled. You are now available for work.",
                "status": "cancelled"
            }), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    for l in _demo_leaves_store:
        if l.get("id") == leave_id and l.get("worker_id") == worker_id:
            l["status"] = "cancelled"
            return jsonify({"success": True, "message": "Leave request cancelled.", "status": "cancelled"}), 200

    return jsonify({"success": False, "message": "Leave request not found", "error_code": "NOT_FOUND"}), 404
