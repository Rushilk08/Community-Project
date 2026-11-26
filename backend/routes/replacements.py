import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from services.auth import require_auth
from services.availability import check_worker_conflict
from services.notifications import create_notification
from database.supabase_client import get_service_client
from config import Config

replacements_bp = Blueprint("replacements", __name__)

_demo_replacements_store = []
_demo_replacement_invitations_store = []

@replacements_bp.route("/replacements", methods=["POST"])
@require_auth(allowed_roles=["customer"])
def create_replacement_request():
    """
    Customer initiates an emergency replacement workflow for an unavailable/leave/cancelled worker.
    """
    payload = request.get_json(silent=True) or {}
    job_id = str(payload.get("job_id") or "").strip()
    raw_worker_id = str(payload.get("original_worker_id") or "").strip()
    if raw_worker_id in ("", "None", "null", "00000000-0000-0000-0000-000000000000"):
        original_worker_id = None
    else:
        original_worker_id = raw_worker_id
    original_booking_id = str(payload.get("original_booking_id") or "").strip()
    trigger_reason = str(payload.get("trigger_reason") or "emergency_unavailability").strip()
    replacement_date = str(payload.get("replacement_date") or "").strip()
    start_time = str(payload.get("start_time") or "09:00").strip()
    duration_hours = float(payload.get("duration_hours") or 8.0)
    required_skill = str(payload.get("required_skill") or "").strip()
    workers_needed = int(payload.get("workers_needed") or 1)
    notes = str(payload.get("additional_notes") or "").strip()

    if not job_id:
        return jsonify({"success": False, "message": "job_id is required", "error_code": "VALIDATION_ERROR"}), 400
    if not replacement_date:
        return jsonify({"success": False, "message": "replacement_date is required", "error_code": "VALIDATION_ERROR"}), 400

    customer_id = g.current_user["id"]
    replacement_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            job_res = client.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
            job = job_res.data if job_res else None
            if not job:
                return jsonify({"success": False, "message": "Job not found", "error_code": "NOT_FOUND"}), 404

            if job.get("customer_id") != customer_id:
                return jsonify({"success": False, "message": "Unauthorized for this job", "error_code": "FORBIDDEN"}), 403

            if not required_skill:
                required_skill = job.get("required_skill") or job.get("skill") or "General Labour"

            # If original_worker_id was omitted, try to infer from a cancelled or recent booking for this job
            if not original_worker_id:
                bk_res = (
                    client.table("bookings")
                    .select("id, worker_id")
                    .eq("job_id", job_id)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if bk_res and bk_res.data:
                    original_worker_id = bk_res.data[0].get("worker_id")
                    if not original_booking_id:
                        original_booking_id = bk_res.data[0].get("id")

            replacement_record = {
                "id": replacement_id,
                "job_id": job_id,
                "customer_id": customer_id,
                "original_worker_id": original_worker_id,
                "original_booking_id": original_booking_id or None,
                "trigger_reason": trigger_reason,
                "replacement_date": replacement_date,
                "start_time": start_time,
                "duration_hours": duration_hours,
                "required_skill": required_skill,
                "workers_needed": workers_needed,
                "additional_notes": notes,
                "status": "searching",
                "created_at": now_iso,
                "updated_at": now_iso
            }
            insert_res = client.table("emergency_replacements").insert(replacement_record).execute()
            created_record = insert_res.data[0] if insert_res and insert_res.data else replacement_record

            return jsonify({
                "success": True,
                "message": "Emergency replacement initialized. You can now select and invite suitable workers.",
                "replacement": created_record
            }), 201

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback
    replacement_record = {
        "id": replacement_id,
        "job_id": job_id,
        "customer_id": customer_id,
        "original_worker_id": original_worker_id,
        "original_booking_id": original_booking_id or "booking-demo",
        "trigger_reason": trigger_reason,
        "replacement_date": replacement_date,
        "start_time": start_time,
        "duration_hours": duration_hours,
        "required_skill": required_skill or "Mason",
        "workers_needed": workers_needed,
        "additional_notes": notes,
        "status": "searching",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    _demo_replacements_store.insert(0, replacement_record)
    return jsonify({
        "success": True,
        "message": "Emergency replacement initialized (Demo Mode)",
        "replacement": replacement_record
    }), 201


@replacements_bp.route("/replacements/candidates", methods=["GET"])
@require_auth(allowed_roles=["customer"])
def get_replacement_candidates():
    """
    Identifies available and eligible workers based on:
    - Skill match
    - Genuine availability (no overlapping commitments or approved leaves)
    - Rating & completed jobs
    """
    skill = request.args.get("skill", "").strip()
    job_date = request.args.get("date", "").strip()
    start_time = request.args.get("start_time", "09:00").strip()
    duration = float(request.args.get("duration", 8.0))
    job_id = request.args.get("job_id", "").strip()

    candidates = []

    if Config.is_supabase_configured():
        try:
            client = get_service_client()

            active_worker_ids = set()
            if job_id:
                try:
                    active_bookings = client.table("bookings").select("worker_id").eq("job_id", job_id).eq("status", "confirmed").execute()
                    active_worker_ids = {b["worker_id"] for b in (active_bookings.data or [])}
                except Exception:
                    active_worker_ids = set()

            query = client.table("profiles").select("id, full_name, phone, skill, location, is_available").eq("role", "worker")
            if skill:
                query = query.ilike("skill", f"%{skill}%")
            workers_res = query.limit(20).execute()
            workers = workers_res.data or []

            for w in workers:
                wid = w["id"]
                if wid in active_worker_ids:
                    continue  # Worker is already actively confirmed on this job
                # Conflict detection
                if job_date:
                    conflict_check = check_worker_conflict(
                        worker_id=wid,
                        job_date_str=job_date,
                        start_time_str=start_time,
                        duration_hours=duration
                    )
                    if conflict_check.get("conflict"):
                        continue  # Skip worker with conflicts or approved leave

                # Fetch rating
                rev_res = client.table("worker_reviews").select("overall_rating").eq("worker_id", wid).execute()
                revs = rev_res.data or []
                avg_rating = round(sum(float(r["overall_rating"]) for r in revs) / len(revs), 1) if revs else 4.8

                candidates.append({
                    "worker_id": wid,
                    "id": wid,
                    "full_name": w.get("full_name"),
                    "phone": w.get("phone"),
                    "skill": w.get("skill"),
                    "location": w.get("location"),
                    "rating": avg_rating,
                    "reviews_count": len(revs),
                    "is_available": True
                })

            candidates.sort(key=lambda c: c["rating"], reverse=True)
            return jsonify({"success": True, "candidates": candidates}), 200

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback candidates
    demo_candidates = [
        {"worker_id": "worker-demo-1", "id": "worker-demo-1", "full_name": "Suresh Gowda", "phone": "+91 98860 11223", "skill": skill or "Mason", "location": "Koramangala, Bengaluru", "rating": 4.9, "reviews_count": 18, "is_available": True},
        {"worker_id": "worker-demo-2", "id": "worker-demo-2", "full_name": "Manjunath K", "phone": "+91 98860 33445", "skill": skill or "Mason", "location": "HSR Layout, Bengaluru", "rating": 4.8, "reviews_count": 14, "is_available": True},
        {"worker_id": "worker-demo-3", "id": "worker-demo-3", "full_name": "Ravi Kumar", "phone": "+91 98860 55667", "skill": skill or "Mason", "location": "BTM Layout, Bengaluru", "rating": 4.7, "reviews_count": 9, "is_available": True}
    ]
    return jsonify({"success": True, "candidates": demo_candidates}), 200


@replacements_bp.route("/replacements/<replacement_id>/invite", methods=["POST"])
@require_auth(allowed_roles=["customer"])
def send_replacement_invitations(replacement_id: str):
    """
    Customer invites selected available replacement workers.
    """
    payload = request.get_json(silent=True) or {}
    worker_ids = payload.get("worker_ids", [])
    if not isinstance(worker_ids, list) or not worker_ids:
        return jsonify({"success": False, "message": "worker_ids must be a non-empty array", "error_code": "VALIDATION_ERROR"}), 400

    customer_id = g.current_user["id"]
    customer_name = g.current_profile.get("full_name", "Customer")
    now_iso = datetime.now(timezone.utc).isoformat()

    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            rep_res = client.table("emergency_replacements").select("*, jobs(*)").eq("id", replacement_id).maybe_single().execute()
            rep = rep_res.data if rep_res else None
            if not rep:
                return jsonify({"success": False, "message": "Replacement record not found", "error_code": "NOT_FOUND"}), 404

            if rep.get("customer_id") != customer_id:
                return jsonify({"success": False, "message": "Unauthorized", "error_code": "FORBIDDEN"}), 403

            job = rep.get("jobs") or {}
            job_id = rep.get("job_id")
            invited = []

            for wid in worker_ids:
                inv_id = str(uuid.uuid4())
                inv_record = {
                    "id": inv_id,
                    "replacement_id": replacement_id,
                    "job_id": job_id,
                    "worker_id": wid,
                    "status": "pending",
                    "created_at": now_iso,
                    "updated_at": now_iso
                }
                client.table("replacement_invitations").insert(inv_record).execute()
                invited.append(inv_record)

                create_notification(
                    user_id=wid,
                    title="🚨 Urgent Replacement Job Opportunity",
                    message=f"{customer_name} invited you for emergency replacement on '{job.get('title')}' on {rep.get('replacement_date')}.",
                    notif_type="replacement_invitation",
                    data={"replacement_id": replacement_id, "invitation_id": inv_id, "job_id": job_id}
                )

            client.table("emergency_replacements").update({
                "status": "invitations_sent",
                "updated_at": now_iso
            }).eq("id", replacement_id).execute()

            return jsonify({
                "success": True,
                "message": f"Invitations sent to {len(invited)} workers.",
                "invitations": invited
            }), 200

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback
    for wid in worker_ids:
        inv = {
            "id": str(uuid.uuid4()),
            "replacement_id": replacement_id,
            "job_id": "job-101",
            "worker_id": wid,
            "status": "pending",
            "created_at": now_iso
        }
        _demo_replacement_invitations_store.insert(0, inv)
        create_notification(
            user_id=wid,
            title="Urgent Replacement Job Opportunity",
            message=f"You received an emergency replacement invitation for {wid}.",
            notif_type="replacement_invitation",
            data={"replacement_id": replacement_id}
        )

    return jsonify({"success": True, "message": f"Invitations sent to {len(worker_ids)} candidates (Demo Mode)."}), 200


@replacements_bp.route("/replacements/worker-invitations", methods=["GET"])
@require_auth(allowed_roles=["worker"])
def get_worker_replacement_invitations():
    """
    Worker views urgent replacement opportunities sent to them.
    """
    worker_id = g.current_user["id"]
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            res = (
                client.table("replacement_invitations")
                .select("*, jobs(id, title, wage_per_worker, location, worksite_address, job_date, start_time, duration_hours), emergency_replacements(replacement_date, start_time, duration_hours, required_skill, additional_notes, status)")
                .eq("worker_id", worker_id)
                .order("created_at", desc=True)
                .execute()
            )
            return jsonify({"success": True, "invitations": res.data or []}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    user_invs = [inv for inv in _demo_replacement_invitations_store if inv.get("worker_id") == worker_id]
    return jsonify({"success": True, "invitations": user_invs}), 200


@replacements_bp.route("/replacements/invitations/<invitation_id>/respond", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def respond_replacement_invitation(invitation_id: str):
    """
    Worker accepts or declines an emergency replacement invitation.
    """
    payload = request.get_json(silent=True) or {}
    decision = str(payload.get("decision") or "").strip().lower()
    if decision not in ["accepted", "rejected"]:
        return jsonify({"success": False, "message": "Decision must be 'accepted' or 'rejected'", "error_code": "VALIDATION_ERROR"}), 400

    worker_id = g.current_user["id"]
    worker_name = g.current_profile.get("full_name", "A worker")
    now_iso = datetime.now(timezone.utc).isoformat()

    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            inv_res = client.table("replacement_invitations").select("*, emergency_replacements(*), jobs(*)").eq("id", invitation_id).maybe_single().execute()
            inv = inv_res.data if inv_res else None
            if not inv:
                return jsonify({"success": False, "message": "Invitation not found", "error_code": "NOT_FOUND"}), 404

            if inv.get("worker_id") != worker_id:
                return jsonify({"success": False, "message": "Unauthorized", "error_code": "FORBIDDEN"}), 403

            rep = inv.get("emergency_replacements") or {}
            job = inv.get("jobs") or {}

            # Conflict detection if accepted
            if decision == "accepted":
                rep_date = rep.get("replacement_date") or job.get("job_date")
                st = rep.get("start_time") or "09:00"
                dur = float(rep.get("duration_hours") or 8.0)
                conflict = check_worker_conflict(worker_id, rep_date, st, dur)
                if conflict.get("conflict"):
                    return jsonify({
                        "success": False,
                        "message": f"Cannot accept: {conflict.get('reason')}",
                        "error_code": "CONFLICT_DETECTED"
                    }), 400

            client.table("replacement_invitations").update({
                "status": decision,
                "updated_at": now_iso
            }).eq("id", invitation_id).execute()

            # Update replacement status
            if decision == "accepted":
                client.table("emergency_replacements").update({
                    "status": "worker_interested",
                    "updated_at": now_iso
                }).eq("id", rep.get("id")).execute()

            # Notify customer
            status_text = "is interested and available" if decision == "accepted" else "declined"
            create_notification(
                user_id=rep.get("customer_id"),
                title="Replacement Invitation Response",
                message=f"{worker_name} {status_text} for '{job.get('title')}'.",
                notif_type="replacement_response",
                data={"replacement_id": rep.get("id"), "worker_id": worker_id, "decision": decision}
            )

            return jsonify({"success": True, "message": f"Invitation {decision} successfully."}), 200

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback
    for inv in _demo_replacement_invitations_store:
        if inv.get("id") == invitation_id:
            inv["status"] = decision
            return jsonify({"success": True, "message": f"Invitation {decision} (Demo Mode)"}), 200

    return jsonify({"success": False, "message": "Invitation not found", "error_code": "NOT_FOUND"}), 404


@replacements_bp.route("/replacements/<replacement_id>/confirm", methods=["POST"])
@require_auth(allowed_roles=["customer"])
def confirm_replacement_selection(replacement_id: str):
    """
    Customer confirms an interested replacement worker.
    Creates booking, fills vacancy, updates replacement status to 'confirmed'.
    """
    payload = request.get_json(silent=True) or {}
    worker_id = str(payload.get("worker_id") or "").strip()
    if not worker_id:
        return jsonify({"success": False, "message": "worker_id is required", "error_code": "VALIDATION_ERROR"}), 400

    customer_id = g.current_user["id"]
    customer_name = g.current_profile.get("full_name", "Customer")
    now_iso = datetime.now(timezone.utc).isoformat()

    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            rep_res = client.table("emergency_replacements").select("*, jobs(*)").eq("id", replacement_id).maybe_single().execute()
            rep = rep_res.data if rep_res else None
            if not rep:
                return jsonify({"success": False, "message": "Replacement not found", "error_code": "NOT_FOUND"}), 404

            if rep.get("customer_id") != customer_id:
                return jsonify({"success": False, "message": "Unauthorized", "error_code": "FORBIDDEN"}), 403

            job = rep.get("jobs") or {}
            job_id = job.get("id")

            # Check for conflict one final time before atomic booking
            conflict = check_worker_conflict(
                worker_id,
                rep.get("replacement_date") or job.get("job_date"),
                rep.get("start_time") or "09:00",
                float(rep.get("duration_hours") or 8.0)
            )
            if conflict.get("conflict"):
                return jsonify({
                    "success": False,
                    "message": f"Worker can no longer be confirmed: {conflict.get('reason')}",
                    "error_code": "WORKER_UNAVAILABLE"
                }), 400

            # Create or reinstate confirmed booking
            wage = float(job.get("wage_per_worker") or job.get("wage") or 800)
            existing_booking_res = client.table("bookings").select("id, status").eq("job_id", job_id).eq("worker_id", worker_id).execute()
            existing_booking = existing_booking_res.data[0] if (existing_booking_res and existing_booking_res.data) else None

            if existing_booking:
                if existing_booking.get("status") == "confirmed":
                    return jsonify({
                        "success": False,
                        "message": "This worker is already active and confirmed on this job.",
                        "error_code": "WORKER_ALREADY_CONFIRMED"
                    }), 400
                # Re-instate previously cancelled booking
                booking_id = existing_booking["id"]
                client.table("bookings").update({
                    "status": "confirmed",
                    "agreed_wage": wage,
                    "confirmed_at": now_iso,
                    "updated_at": now_iso
                }).eq("id", booking_id).execute()
            else:
                booking_id = str(uuid.uuid4())
                booking_data = {
                    "id": booking_id,
                    "job_id": job_id,
                    "worker_id": worker_id,
                    "agreed_wage": wage,
                    "status": "confirmed",
                    "confirmed_at": now_iso,
                    "created_at": now_iso
                }
                client.table("bookings").insert(booking_data).execute()

            # Update vacancy
            confirmed = int(job.get("confirmed_workers") or 0) + 1
            client.table("jobs").update({
                "confirmed_workers": confirmed,
                "updated_at": now_iso
            }).eq("id", job_id).execute()

            # Update replacement status
            client.table("emergency_replacements").update({
                "status": "confirmed",
                "confirmed_worker_id": worker_id,
                "updated_at": now_iso
            }).eq("id", replacement_id).execute()

            # Notify worker of confirmation
            create_notification(
                user_id=worker_id,
                title="✅ Emergency Replacement Confirmed!",
                message=f"You have been confirmed as the replacement worker for '{job.get('title')}' on {rep.get('replacement_date')}.",
                notif_type="replacement_confirmed",
                data={"job_id": job_id, "booking_id": booking_id, "replacement_id": replacement_id}
            )

            return jsonify({
                "success": True,
                "message": "Replacement confirmed. Worker assigned and booking created successfully.",
                "booking_id": booking_id
            }), 200

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback
    return jsonify({
        "success": True,
        "message": "Replacement confirmed (Demo Mode)",
        "booking_id": "booking-rep-demo"
    }), 200
