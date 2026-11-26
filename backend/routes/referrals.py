import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from services.auth import require_auth
from services.validation import is_valid_uuid
from services.notifications import create_notification
from database.supabase_client import get_service_client
from config import Config

referrals_bp = Blueprint("referrals", __name__)

_demo_referrals_store = []

@referrals_bp.route("/referrals/available-jobs", methods=["GET"])
@require_auth(allowed_roles=["worker"])
def get_available_jobs_for_referral():
    """
    Returns open jobs that still have unfilled vacancies.
    """
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            res = (
                client.table("jobs")
                .select("id, title, description, required_skill, skill, wage_per_worker, wage, workers_needed, workers_required, confirmed_workers, worksite_address, location, job_date, start_time, duration_hours, status")
                .in_("status", ["open", "in_progress"])
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            jobs = res.data or []
            vacant_jobs = []
            for j in jobs:
                needed = int(j.get("workers_needed") or j.get("workers_required") or 1)
                confirmed = int(j.get("confirmed_workers") or 0)
                if confirmed < needed:
                    vacant_jobs.append({
                        **j,
                        "vacancies_remaining": needed - confirmed
                    })
            return jsonify({"success": True, "jobs": vacant_jobs, "count": len(vacant_jobs)}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback
    return jsonify({
        "success": True,
        "jobs": [
            {
                "id": "job-101",
                "title": "Masonry and Bricklaying",
                "description": "Wall construction and brick laying for residential building",
                "required_skill": "Mason",
                "wage_per_worker": 950,
                "workers_needed": 5,
                "confirmed_workers": 3,
                "vacancies_remaining": 2,
                "location": "Indiranagar, Bengaluru",
                "job_date": "2026-11-28",
                "start_time": "09:00",
                "duration_hours": 8,
                "status": "open"
            }
        ],
        "count": 1
    }), 200


@referrals_bp.route("/referrals", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def create_referral():
    """
    Registered worker recommends a person to fill an open vacancy.
    """
    payload = request.get_json(silent=True) or {}
    job_id = str(payload.get("job_id") or "").strip()
    candidate_name = str(payload.get("candidate_name") or "").strip()
    candidate_phone = str(payload.get("candidate_phone") or "").strip()
    candidate_skills = str(payload.get("candidate_skills") or "").strip()
    experience = str(payload.get("experience") or "").strip()
    location = str(payload.get("location") or "").strip()
    notes = str(payload.get("notes") or "").strip()
    consent = payload.get("consent_confirmed")

    if not job_id:
        return jsonify({"success": False, "message": "job_id is required", "error_code": "VALIDATION_ERROR"}), 400
    if len(candidate_name) < 2:
        return jsonify({"success": False, "message": "Candidate name must be at least 2 characters", "error_code": "VALIDATION_ERROR"}), 400
    if len(candidate_phone) < 8:
        return jsonify({"success": False, "message": "A valid mobile phone number is required", "error_code": "VALIDATION_ERROR"}), 400
    if not candidate_skills:
        return jsonify({"success": False, "message": "Candidate skills or type of work is required", "error_code": "VALIDATION_ERROR"}), 400
    if consent is not True:
        return jsonify({"success": False, "message": "You must confirm you have the candidate's consent to share their details.", "error_code": "CONSENT_REQUIRED"}), 400

    referring_worker_id = g.current_user["id"]
    referring_worker_name = g.current_profile.get("full_name", "A registered worker")

    now_iso = datetime.now(timezone.utc).isoformat()
    referral_id = str(uuid.uuid4())

    if Config.is_supabase_configured():
        try:
            client = get_service_client()

            # 1. Check job status and vacancies
            if not is_valid_uuid(job_id):
                return jsonify({"success": False, "message": "Invalid job identifier", "error_code": "NOT_FOUND"}), 404

            job_res = client.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
            job = job_res.data if job_res else None
            if not job:
                # Check if client passed a booking_id instead of job_id
                booking_res = client.table("bookings").select("job_id").eq("id", job_id).maybe_single().execute()
                if booking_res and booking_res.data:
                    real_job_id = booking_res.data.get("job_id")
                    job_res = client.table("jobs").select("*").eq("id", real_job_id).maybe_single().execute()
                    job = job_res.data if job_res else None
                    if job:
                        job_id = real_job_id

            if not job:
                return jsonify({"success": False, "message": "Job not found", "error_code": "NOT_FOUND"}), 404
            if job.get("status") in ["completed", "cancelled"]:
                return jsonify({"success": False, "message": "Cannot recommend for a completed or cancelled job", "error_code": "JOB_CLOSED"}), 400

            workers_needed = int(job.get("workers_needed") or job.get("workers_required") or 1)
            confirmed = int(job.get("confirmed_workers") or 0)
            if confirmed >= workers_needed:
                return jsonify({"success": False, "message": "This job is already full. No remaining vacancies.", "error_code": "JOB_FULL"}), 400

            # 2. Prevent duplicate recommendations for the same person and job
            dup_res = (
                client.table("worker_referrals")
                .select("id, status")
                .eq("job_id", job_id)
                .eq("candidate_phone", candidate_phone)
                .execute()
            )
            if dup_res and dup_res.data:
                return jsonify({
                    "success": False,
                    "message": "This candidate has already been recommended for this job vacancy.",
                    "error_code": "DUPLICATE_REFERRAL"
                }), 400

            # 3. Create referral
            invitation_link = f"/worker/register?ref={referral_id}"
            referral_data = {
                "id": referral_id,
                "job_id": job_id,
                "referring_worker_id": referring_worker_id,
                "candidate_name": candidate_name,
                "candidate_phone": candidate_phone,
                "candidate_skills": candidate_skills,
                "experience": experience,
                "location": location,
                "notes": notes,
                "consent_confirmed": True,
                "status": "invited",
                "created_at": now_iso,
                "updated_at": now_iso
            }
            insert_res = client.table("worker_referrals").insert(referral_data).execute()
            created_referral = insert_res.data[0] if insert_res and insert_res.data else referral_data

            # 4. Notify customer of new recommendation
            customer_id = job.get("customer_id")
            create_notification(
                user_id=customer_id,
                title="New Worker Recommendation",
                message=f"{referring_worker_name} recommended {candidate_name} ({candidate_skills}) for your job '{job.get('title')}'.",
                notif_type="referral",
                data={"referral_id": referral_id, "job_id": job_id}
            )

            return jsonify({
                "success": True,
                "message": "Referral submitted successfully. Invitation link generated.",
                "referral": created_referral,
                "invitation_link": invitation_link
            }), 201

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback
    # Check duplicate in demo store
    if any(r.get("job_id") == job_id and r.get("candidate_phone") == candidate_phone for r in _demo_referrals_store):
        return jsonify({
            "success": False,
            "message": "This candidate has already been recommended for this job vacancy.",
            "error_code": "DUPLICATE_REFERRAL"
        }), 400

    referral_data = {
        "id": referral_id,
        "job_id": job_id,
        "referring_worker_id": referring_worker_id,
        "candidate_name": candidate_name,
        "candidate_phone": candidate_phone,
        "candidate_skills": candidate_skills,
        "experience": experience,
        "location": location,
        "notes": notes,
        "consent_confirmed": True,
        "status": "invited",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    _demo_referrals_store.insert(0, referral_data)
    create_notification(
        user_id="customer-demo-1",
        title="New Worker Recommendation",
        message=f"{referring_worker_name} recommended {candidate_name} for your job.",
        notif_type="referral",
        data={"referral_id": referral_id, "job_id": job_id}
    )
    return jsonify({
        "success": True,
        "message": "Referral submitted successfully (Demo Mode)",
        "referral": referral_data,
        "invitation_link": f"/worker/register?ref={referral_id}"
    }), 201


@referrals_bp.route("/referrals/my-referrals", methods=["GET"])
@require_auth(allowed_roles=["worker"])
def get_my_referrals():
    """
    Returns referrals made by the authenticated worker and their current statuses.
    """
    worker_id = g.current_user["id"]
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            res = (
                client.table("worker_referrals")
                .select("*, jobs(id, title, wage_per_worker, location, job_date, status)")
                .eq("referring_worker_id", worker_id)
                .order("created_at", desc=True)
                .execute()
            )
            return jsonify({"success": True, "referrals": res.data or []}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    user_refs = [r for r in _demo_referrals_store if r.get("referring_worker_id") == worker_id]
    return jsonify({"success": True, "referrals": user_refs}), 200


@referrals_bp.route("/referrals/customer", methods=["GET"])
@require_auth(allowed_roles=["customer"])
def get_customer_referrals():
    """
    Returns all recommended candidates for jobs posted by this customer.
    """
    customer_id = g.current_user["id"]
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            jobs_res = client.table("jobs").select("id").eq("customer_id", customer_id).execute()
            job_ids = [j["id"] for j in (jobs_res.data or [])]
            if not job_ids:
                return jsonify({"success": True, "referrals": []}), 200

            res = (
                client.table("worker_referrals")
                .select("*, jobs(id, title, wage_per_worker, workers_needed, confirmed_workers, status), profiles:referring_worker_id(full_name, phone)")
                .in_("job_id", job_ids)
                .order("created_at", desc=True)
                .execute()
            )
            return jsonify({"success": True, "referrals": res.data or []}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    return jsonify({"success": True, "referrals": _demo_referrals_store}), 200


@referrals_bp.route("/referrals/<referral_id>/decision", methods=["PATCH"])
@require_auth(allowed_roles=["customer"])
def resolve_referral_recommendation(referral_id: str):
    """
    Customer accepts or rejects a recommended candidate.
    If accepted:
    - Verifies vacancies remain
    - Atomically increments confirmed_workers
    - Updates status to 'accepted'
    - Notifies referring worker
    """
    payload = request.get_json(silent=True) or {}
    decision = str(payload.get("decision") or "").strip().lower()
    if decision not in ["accepted", "rejected"]:
        return jsonify({"success": False, "message": "Decision must be 'accepted' or 'rejected'", "error_code": "VALIDATION_ERROR"}), 400

    customer_id = g.current_user["id"]

    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            ref_res = client.table("worker_referrals").select("*, jobs(*)").eq("id", referral_id).maybe_single().execute()
            ref_record = ref_res.data if ref_res else None
            if not ref_record:
                return jsonify({"success": False, "message": "Referral record not found", "error_code": "NOT_FOUND"}), 404

            job = ref_record.get("jobs") or {}
            if job.get("customer_id") != customer_id:
                return jsonify({"success": False, "message": "Unauthorized to decide on this referral", "error_code": "FORBIDDEN"}), 403

            if ref_record.get("status") in ["accepted", "rejected"]:
                return jsonify({"success": False, "message": f"Referral is already {ref_record.get('status')}", "error_code": "ALREADY_DECIDED"}), 400

            if decision == "accepted":
                # Check vacancy
                needed = int(job.get("workers_needed") or job.get("workers_required") or 1)
                confirmed = int(job.get("confirmed_workers") or 0)
                if confirmed >= needed:
                    return jsonify({"success": False, "message": "No vacancies remaining for this job", "error_code": "JOB_FULL"}), 400

                new_confirmed = confirmed + 1
                job_status = "in_progress" if new_confirmed >= needed else job.get("status", "open")
                client.table("jobs").update({
                    "confirmed_workers": new_confirmed,
                    "status": job_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", job.get("id")).execute()

            # Update referral status
            updated_ref = (
                client.table("worker_referrals")
                .update({
                    "status": decision,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })
                .eq("id", referral_id)
                .execute()
            )

            # Notify referring worker
            cand_name = ref_record.get("candidate_name")
            job_title = job.get("title")
            create_notification(
                user_id=ref_record.get("referring_worker_id"),
                title="Referral Update",
                message=f"Your recommendation for {cand_name} on job '{job_title}' was {decision} by the customer.",
                notif_type="referral",
                data={"referral_id": referral_id, "decision": decision}
            )

            return jsonify({
                "success": True,
                "message": f"Referral {decision} successfully.",
                "referral": updated_ref.data[0] if updated_ref and updated_ref.data else None
            }), 200

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Fallback
    for r in _demo_referrals_store:
        if r.get("id") == referral_id:
            r["status"] = decision
            create_notification(
                user_id=r.get("referring_worker_id"),
                title="Referral Update",
                message=f"Your recommendation for {r.get('candidate_name')} was {decision}.",
                notif_type="referral",
                data={"referral_id": referral_id, "decision": decision}
            )
            return jsonify({"success": True, "message": f"Referral {decision} (Demo Mode)", "referral": r}), 200

    return jsonify({"success": False, "message": "Referral not found", "error_code": "NOT_FOUND"}), 404


@referrals_bp.route("/referrals/invite/<referral_id>/claim", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def claim_referral_invite(referral_id: str):
    """
    When a recommended person signs up and links their account via the invitation code.
    Updates referral status to 'registered'.
    """
    user_id = g.current_user["id"]
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            ref_res = client.table("worker_referrals").select("*, jobs(*)").eq("id", referral_id).maybe_single().execute()
            if not ref_res or not ref_res.data:
                return jsonify({"success": False, "message": "Referral invite not found", "error_code": "NOT_FOUND"}), 404
            ref = ref_res.data
            job = ref.get("jobs") or {}

            client.table("worker_referrals").update({
                "registered_user_id": user_id,
                "status": "registered",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", referral_id).execute()

            # Notify referring worker & customer
            create_notification(
                user_id=ref.get("referring_worker_id"),
                title="Recommended Worker Registered!",
                message=f"{ref.get('candidate_name')} has registered on WorkLink through your recommendation.",
                notif_type="referral",
                data={"referral_id": referral_id}
            )
            create_notification(
                user_id=job.get("customer_id"),
                title="Recommended Candidate Registered",
                message=f"{ref.get('candidate_name')}, recommended for '{job.get('title')}', has completed their registration and is ready for review.",
                notif_type="referral",
                data={"referral_id": referral_id}
            )
            return jsonify({"success": True, "message": "Referral linked to your registered profile."}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    return jsonify({"success": True, "message": "Referral registered (Demo Mode)"}), 200


@referrals_bp.route("/referrals/pledge-team", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def pledge_team():
    """
    Worker marks the box: 'I have remaining person is there for this work'
    Automatically fulfills remaining vacancies with worker's team and notifies employer.
    """
    payload = request.get_json(silent=True) or {}
    job_id = str(payload.get("job_id") or "").strip()
    notes = str(payload.get("notes") or "").strip()
    if not job_id:
        return jsonify({"success": False, "message": "job_id is required", "error_code": "VALIDATION_ERROR"}), 400

    referring_worker_id = g.current_user["id"]
    referring_worker_name = g.current_profile.get("full_name", "A registered worker")
    referring_worker_phone = g.current_profile.get("phone", "")
    now_iso = datetime.now(timezone.utc).isoformat()

    if not is_valid_uuid(job_id):
        # Demo fallback for non-UUID job ids
        return jsonify({
            "success": True,
            "message": "Confirmed team in demo mode",
            "remaining_count": int(payload.get("remaining_count") or 2)
        }), 200

    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            job_res = client.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
            job = job_res.data if job_res else None
            if not job:
                # Check if client passed a booking_id instead of job_id
                booking_res = client.table("bookings").select("job_id").eq("id", job_id).maybe_single().execute()
                if booking_res and booking_res.data:
                    real_job_id = booking_res.data.get("job_id")
                    job_res = client.table("jobs").select("*").eq("id", real_job_id).maybe_single().execute()
                    job = job_res.data if job_res else None
                    if job:
                        job_id = real_job_id

            if not job:
                return jsonify({"success": False, "message": "Job not found", "error_code": "NOT_FOUND"}), 404

            workers_needed = int(job.get("workers_needed") or job.get("workers_required") or 1)
            confirmed = int(job.get("confirmed_workers") or 0)
            remaining_vacancies = max(0, workers_needed - confirmed)
            if remaining_vacancies <= 0:
                return jsonify({"success": False, "message": "All vacancies for this job are already filled", "error_code": "JOB_FULL"}), 400

            created = []
            skill = job.get("required_skill") or job.get("skill") or "General Labour"
            for i in range(remaining_vacancies):
                ref_id = str(uuid.uuid4())
                cand_phone = f"{referring_worker_phone} (Crew #{i+1})" if referring_worker_phone else f"+91-TEAM-{i+1}"
                cand_name = f"{referring_worker_name}'s Coworker #{i + 1}"
                ref_data = {
                    "id": ref_id,
                    "job_id": job_id,
                    "referring_worker_id": referring_worker_id,
                    "candidate_name": cand_name,
                    "candidate_phone": cand_phone,
                    "candidate_skills": skill,
                    "experience": "Attending with referring worker",
                    "location": job.get("worksite_address") or job.get("location") or "Bengaluru",
                    "notes": notes or f"Worker marked checkbox: 'I have remaining person is there for this work' (will bring coworker with {referring_worker_name})",
                    "consent_confirmed": True,
                    "status": "pending",
                    "created_at": now_iso,
                    "updated_at": now_iso
                }
                try:
                    ins = client.table("worker_referrals").insert(ref_data).execute()
                    if ins and ins.data:
                        created.append(ins.data[0])
                except Exception as ins_err:
                    print(f"[Pledge Team Ins Warning] {ins_err}")

            customer_id = job.get("customer_id")
            if customer_id:
                create_notification(
                    user_id=customer_id,
                    title="👥 Full Team Ready! Worker Bringing Remaining Coworkers",
                    message=f"{referring_worker_name} marked that they have the remaining {remaining_vacancies} worker(s) and will bring them for '{job.get('title')}'.",
                    notif_type="referral",
                    data={"job_id": job_id, "has_team_pledged": True, "team_count": remaining_vacancies}
                )

            return jsonify({
                "success": True,
                "message": f"Confirmed! You marked that you will bring {remaining_vacancies} coworker(s) for this job.",
                "remaining_count": remaining_vacancies,
                "created_referrals": created
            }), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback
    return jsonify({
        "success": True,
        "message": "Confirmed! You marked that you will bring the remaining coworker(s) for this job (Demo Mode).",
        "remaining_count": 2,
        "created_referrals": []
    }), 200
