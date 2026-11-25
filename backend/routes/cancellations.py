import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from services.auth import require_auth
from services.notifications import create_notification
from database.supabase_client import get_service_client
from config import Config

cancellations_bp = Blueprint("cancellations", __name__)

_demo_cancellations_store = []

@cancellations_bp.route("/cancellations", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def request_job_cancellation():
    """
    Worker requests cancellation of an accepted job.
    Requires customer approval before any commitment is released.
    """
    payload = request.get_json(silent=True) or {}
    booking_id = str(payload.get("booking_id") or "").strip()
    reason = str(payload.get("reason") or "").strip()
    explanation = str(payload.get("explanation") or "").strip()
    acknowledge_approval = payload.get("acknowledged_approval_required")

    if not booking_id:
        return jsonify({"success": False, "message": "booking_id is required", "error_code": "VALIDATION_ERROR"}), 400
    if len(reason) < 3:
        return jsonify({"success": False, "message": "Reason for cancellation is required", "error_code": "VALIDATION_ERROR"}), 400
    if acknowledge_approval is not True:
        return jsonify({
            "success": False,
            "message": "You must confirm that you understand customer approval is required before cancellation is effective.",
            "error_code": "ACKNOWLEDGEMENT_REQUIRED"
        }), 400

    worker_id = g.current_user["id"]
    worker_name = g.current_profile.get("full_name", "Assigned Worker")
    now_iso = datetime.now(timezone.utc).isoformat()
    canc_id = str(uuid.uuid4())

    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            b_res = (
                client.table("bookings")
                .select("*, jobs(id, title, customer_id, status, job_date, start_time)")
                .eq("id", booking_id)
                .maybe_single()
                .execute()
            )
            booking = b_res.data if b_res else None
            if not booking:
                return jsonify({"success": False, "message": "Booking not found", "error_code": "NOT_FOUND"}), 404

            if booking.get("worker_id") != worker_id:
                return jsonify({"success": False, "message": "You are not the assigned worker for this booking.", "error_code": "FORBIDDEN"}), 403

            if booking.get("status") in ["cancelled", "completed"]:
                return jsonify({
                    "success": False,
                    "message": f"Cannot cancel a booking that is already {booking.get('status')}.",
                    "error_code": "INVALID_STATE"
                }), 400

            job = booking.get("jobs") or {}
            customer_id = job.get("customer_id")
            job_id = job.get("id")

            # Guard against duplicate pending requests
            pending_res = (
                client.table("job_cancellation_requests")
                .select("id, status")
                .eq("booking_id", booking_id)
                .eq("status", "pending")
                .execute()
            )
            if pending_res and pending_res.data:
                return jsonify({
                    "success": False,
                    "message": "A cancellation request for this job is already pending customer decision.",
                    "error_code": "DUPLICATE_REQUEST"
                }), 400

            canc_record = {
                "id": canc_id,
                "booking_id": booking_id,
                "job_id": job_id,
                "worker_id": worker_id,
                "customer_id": customer_id,
                "reason": reason,
                "explanation": explanation,
                "status": "pending",
                "created_at": now_iso,
                "updated_at": now_iso
            }
            insert_res = client.table("job_cancellation_requests").insert(canc_record).execute()
            created_record = insert_res.data[0] if insert_res and insert_res.data else canc_record

            # Notify customer
            create_notification(
                user_id=customer_id,
                title="Job Cancellation Request",
                message=f"Worker {worker_name} has requested cancellation for '{job.get('title')}'. Reason: {reason}. Your approval is required.",
                notif_type="cancellation_request",
                data={"cancellation_id": canc_id, "booking_id": booking_id, "job_id": job_id}
            )

            return jsonify({
                "success": True,
                "message": "Cancellation request submitted. The customer has been notified and must approve before your slot is released.",
                "cancellation": created_record
            }), 201

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback
    if any(c.get("booking_id") == booking_id and c.get("status") == "pending" for c in _demo_cancellations_store):
        return jsonify({
            "success": False,
            "message": "A cancellation request for this job is already pending customer decision.",
            "error_code": "DUPLICATE_REQUEST"
        }), 400

    canc_record = {
        "id": canc_id,
        "booking_id": booking_id,
        "job_id": "job-demo-1",
        "worker_id": worker_id,
        "customer_id": "customer-demo-1",
        "reason": reason,
        "explanation": explanation,
        "status": "pending",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    _demo_cancellations_store.insert(0, canc_record)
    from services.availability import _demo_availability_store
    _demo_availability_store["cancellations"].append(canc_record)

    create_notification(
        user_id="customer-demo-1",
        title="Job Cancellation Request",
        message=f"{worker_name} requested cancellation for an accepted job. Reason: {reason}",
        notif_type="cancellation_request",
        data={"cancellation_id": canc_id}
    )

    return jsonify({
        "success": True,
        "message": "Cancellation request submitted (Demo Mode). Customer confirmation pending.",
        "cancellation": canc_record
    }), 201


@cancellations_bp.route("/cancellations/my", methods=["GET"])
@require_auth(allowed_roles=["worker"])
def get_my_cancellations():
    """
    Worker views their submitted cancellation requests and statuses.
    """
    worker_id = g.current_user["id"]
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            res = (
                client.table("job_cancellation_requests")
                .select("*, jobs(id, title, worksite_address, location, job_date)")
                .eq("worker_id", worker_id)
                .order("created_at", desc=True)
                .execute()
            )
            return jsonify({"success": True, "cancellations": res.data or []}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    user_canc = [c for c in _demo_cancellations_store if c.get("worker_id") == worker_id]
    return jsonify({"success": True, "cancellations": user_canc}), 200


@cancellations_bp.route("/cancellations/customer", methods=["GET"])
@require_auth(allowed_roles=["customer"])
def get_customer_cancellations():
    """
    Customer views cancellation requests for their jobs.
    """
    customer_id = g.current_user["id"]
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            res = (
                client.table("job_cancellation_requests")
                .select("*, jobs(id, title, worksite_address, location, job_date, wage_per_worker), profiles:worker_id(full_name, phone, skill)")
                .eq("customer_id", customer_id)
                .order("created_at", desc=True)
                .execute()
            )
            return jsonify({"success": True, "cancellations": res.data or []}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    return jsonify({"success": True, "cancellations": _demo_cancellations_store}), 200


@cancellations_bp.route("/cancellations/<cancellation_id>/decision", methods=["PATCH"])
@require_auth(allowed_roles=["customer"])
def decide_cancellation_request(cancellation_id: str):
    """
    Customer approves or rejects cancellation.
    If approved:
    - Booking status becomes 'cancelled'
    - Vacancy reopened (confirmed_workers decremented)
    - Worker time slot released
    - Customer notified with Emergency Replacement option
    If rejected:
    - Worker remains assigned
    - Commitment maintained
    """
    payload = request.get_json(silent=True) or {}
    decision = str(payload.get("decision") or "").strip().lower()
    if decision not in ["approved", "rejected"]:
        return jsonify({"success": False, "message": "Decision must be 'approved' or 'rejected'", "error_code": "VALIDATION_ERROR"}), 400

    customer_id = g.current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            canc_res = (
                client.table("job_cancellation_requests")
                .select("*, jobs(*), bookings(*)")
                .eq("id", cancellation_id)
                .maybe_single()
                .execute()
            )
            canc = canc_res.data if canc_res else None
            if not canc:
                return jsonify({"success": False, "message": "Cancellation request not found", "error_code": "NOT_FOUND"}), 404

            if canc.get("customer_id") != customer_id:
                return jsonify({"success": False, "message": "Unauthorized to decide on this cancellation request", "error_code": "FORBIDDEN"}), 403

            if canc.get("status") != "pending":
                return jsonify({"success": False, "message": f"Cancellation request already {canc.get('status')}", "error_code": "ALREADY_DECIDED"}), 400

            job = canc.get("jobs") or {}
            job_title = job.get("title", "the job")
            worker_id = canc.get("worker_id")
            booking_id = canc.get("booking_id")

            if decision == "approved":
                # 1. Update booking status to cancelled
                client.table("bookings").update({
                    "status": "cancelled"
                }).eq("id", booking_id).execute()

                # 2. Release vacancy on job
                confirmed = int(job.get("confirmed_workers") or 1)
                new_confirmed = max(0, confirmed - 1)
                client.table("jobs").update({
                    "confirmed_workers": new_confirmed,
                    "status": "open",
                    "updated_at": now_iso
                }).eq("id", job.get("id")).execute()

                # 3. Update cancellation record
                updated_res = (
                    client.table("job_cancellation_requests")
                    .update({
                        "status": "approved",
                        "resolved_at": now_iso,
                        "updated_at": now_iso
                    })
                    .eq("id", cancellation_id)
                    .execute()
                )

                # 4. Notify worker that cancellation was approved
                create_notification(
                    user_id=worker_id,
                    title="Cancellation Request Approved",
                    message=f"Your cancellation request for '{job_title}' was approved by the customer. Your schedule has been released.",
                    notif_type="cancellation_decision",
                    data={"cancellation_id": cancellation_id, "status": "approved"}
                )

                # 5. Notify customer with Find Replacement option
                create_notification(
                    user_id=customer_id,
                    title="Vacancy Reopened - Find Replacement",
                    message=f"Cancellation confirmed. '{job_title}' now has an open vacancy. Use 'Find Replacement' to fill it quickly.",
                    notif_type="replacement_opportunity",
                    data={"job_id": job.get("id"), "booking_id": booking_id}
                )

            else:
                # Rejected
                updated_res = (
                    client.table("job_cancellation_requests")
                    .update({
                        "status": "rejected",
                        "resolved_at": now_iso,
                        "updated_at": now_iso
                    })
                    .eq("id", cancellation_id)
                    .execute()
                )

                # Notify worker that cancellation was rejected
                create_notification(
                    user_id=worker_id,
                    title="Cancellation Request Declined",
                    message=f"Your cancellation request for '{job_title}' was declined by the customer. You remain committed to this assignment.",
                    notif_type="cancellation_decision",
                    data={"cancellation_id": cancellation_id, "status": "rejected"}
                )

            return jsonify({
                "success": True,
                "message": f"Cancellation request {decision} successfully.",
                "cancellation": updated_res.data[0] if updated_res and updated_res.data else None
            }), 200

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback
    for c in _demo_cancellations_store:
        if c.get("id") == cancellation_id:
            c["status"] = decision
            c["resolved_at"] = now_iso
            from services.availability import _demo_availability_store
            for ac in _demo_availability_store["cancellations"]:
                if ac.get("id") == cancellation_id:
                    ac["status"] = decision
            if decision == "approved":
                for ab in _demo_availability_store["bookings"]:
                    if ab.get("id") == c.get("booking_id"):
                        ab["status"] = "cancelled"
            create_notification(
                user_id=c.get("worker_id"),
                title=f"Cancellation Request {decision.capitalize()}",
                message=f"Your cancellation request was {decision}.",
                notif_type="cancellation_decision",
                data={"cancellation_id": cancellation_id, "status": decision}
            )
            return jsonify({"success": True, "message": f"Cancellation request {decision} (Demo Mode)", "cancellation": c}), 200

    return jsonify({"success": False, "message": "Cancellation request not found", "error_code": "NOT_FOUND"}), 404
