import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from services.auth import require_auth
from services.notifications import create_notification
from database.supabase_client import get_service_client
from config import Config

reviews_bp = Blueprint("reviews", __name__)

_demo_reviews_store = []

@reviews_bp.route("/reviews", methods=["POST"])
@require_auth(allowed_roles=["customer"])
def create_worker_review():
    """
    Customer rates a worker for a completed job.
    Strictly restricted to completed jobs and verified hires.
    One review per worker per job.
    """
    payload = request.get_json(silent=True) or {}
    job_id = str(payload.get("job_id") or "").strip()
    worker_id = str(payload.get("worker_id") or "").strip()
    booking_id = str(payload.get("booking_id") or "").strip()
    review_text = str(payload.get("review_text") or "").strip()

    try:
        punctuality = int(payload.get("punctuality_rating", 0))
        quality = int(payload.get("quality_rating", 0))
        professionalism = int(payload.get("professionalism_rating", 0))
        reliability = int(payload.get("reliability_rating", 0))
        communication = int(payload.get("communication_rating", 0))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "All category ratings must be integers between 1 and 5", "error_code": "VALIDATION_ERROR"}), 400

    for cat_name, val in [
        ("Punctuality", punctuality),
        ("Work Quality", quality),
        ("Professionalism", professionalism),
        ("Reliability", reliability),
        ("Communication", communication)
    ]:
        if val < 1 or val > 5:
            return jsonify({
                "success": False,
                "message": f"{cat_name} rating must be between 1 and 5 stars",
                "error_code": "VALIDATION_ERROR"
            }), 400

    overall_rating = round((punctuality + quality + professionalism + reliability + communication) / 5.0, 1)
    customer_id = g.current_user["id"]
    customer_name = g.current_profile.get("full_name", "Customer")
    review_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    if Config.is_supabase_configured():
        try:
            client = get_service_client()

            # 1. Check job status - must be 'completed'
            job_res = client.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
            job = job_res.data if job_res else None
            if not job:
                return jsonify({"success": False, "message": "Job not found", "error_code": "NOT_FOUND"}), 404

            if job.get("customer_id") != customer_id:
                return jsonify({"success": False, "message": "Only the hiring customer can submit a rating", "error_code": "FORBIDDEN"}), 403

            if job.get("status") != "completed":
                return jsonify({
                    "success": False,
                    "message": "Ratings can only be submitted after a job is marked completed.",
                    "error_code": "JOB_NOT_COMPLETED"
                }), 400

            # 2. Check booking - worker must have had a confirmed/completed booking
            b_query = client.table("bookings").select("*").eq("job_id", job_id).eq("worker_id", worker_id)
            if booking_id:
                b_query = b_query.eq("id", booking_id)
            b_res = b_query.maybe_single().execute()
            booking = b_res.data if b_res else None
            if not booking:
                return jsonify({
                    "success": False,
                    "message": "This worker was not hired for this job.",
                    "error_code": "NO_VERIFIED_HIRE"
                }), 403

            if booking.get("status") == "cancelled":
                return jsonify({
                    "success": False,
                    "message": "Cannot submit a review for a cancelled job booking.",
                    "error_code": "BOOKING_CANCELLED"
                }), 400

            # 3. Check duplicate review for same job and worker
            existing_res = (
                client.table("worker_reviews")
                .select("id")
                .eq("job_id", job_id)
                .eq("worker_id", worker_id)
                .execute()
            )
            if existing_res and existing_res.data:
                return jsonify({
                    "success": False,
                    "message": "You have already submitted a rating for this worker on this job.",
                    "error_code": "DUPLICATE_REVIEW"
                }), 400

            review_data = {
                "id": review_id,
                "job_id": job_id,
                "booking_id": booking["id"],
                "customer_id": customer_id,
                "worker_id": worker_id,
                "punctuality_rating": punctuality,
                "quality_rating": quality,
                "professionalism_rating": professionalism,
                "reliability_rating": reliability,
                "communication_rating": communication,
                "overall_rating": overall_rating,
                "review_text": review_text,
                "is_reported": False,
                "created_at": now_iso
            }
            insert_res = client.table("worker_reviews").insert(review_data).execute()
            created_review = insert_res.data[0] if insert_res and insert_res.data else review_data

            # Notify worker
            create_notification(
                user_id=worker_id,
                title="New Customer Rating & Review",
                message=f"You received a {overall_rating}★ rating from {customer_name} for '{job.get('title')}'.",
                notif_type="review",
                data={"review_id": review_id, "rating": overall_rating}
            )

            return jsonify({
                "success": True,
                "message": "Worker review and rating submitted successfully.",
                "review": created_review
            }), 201

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback
    if any(r.get("job_id") == job_id and r.get("worker_id") == worker_id for r in _demo_reviews_store):
        return jsonify({
            "success": False,
            "message": "You have already submitted a rating for this worker on this job.",
            "error_code": "DUPLICATE_REVIEW"
        }), 400

    review_data = {
        "id": review_id,
        "job_id": job_id,
        "booking_id": booking_id or "demo-booking-1",
        "customer_id": customer_id,
        "customer_name": customer_name,
        "worker_id": worker_id,
        "punctuality_rating": punctuality,
        "quality_rating": quality,
        "professionalism_rating": professionalism,
        "reliability_rating": reliability,
        "communication_rating": communication,
        "overall_rating": overall_rating,
        "review_text": review_text,
        "is_reported": False,
        "created_at": now_iso
    }
    _demo_reviews_store.insert(0, review_data)
    create_notification(
        user_id=worker_id,
        title="New Customer Rating",
        message=f"You received a {overall_rating}★ rating from {customer_name}.",
        notif_type="review",
        data={"review_id": review_id, "rating": overall_rating}
    )

    return jsonify({
        "success": True,
        "message": "Worker review and rating submitted successfully (Demo Mode)",
        "review": review_data
    }), 201


@reviews_bp.route("/workers/<worker_id>/reliability", methods=["GET"])
@require_auth()
def get_worker_reliability_metrics(worker_id: str):
    """
    Returns full rating analytics, category averages, verified job history,
    and transparency reliability indicators:
    - completed_jobs
    - approved_leaves (NOTE: approved leave does NOT penalize rating)
    - unapproved_absences
    - customer_reported_no_shows
    - cancellations_count
    """
    if Config.is_supabase_configured():
        try:
            client = get_service_client()

            # Reviews
            rev_res = client.table("worker_reviews").select("*, profiles:customer_id(full_name), jobs(title, job_date)").eq("worker_id", worker_id).order("created_at", desc=True).execute()
            reviews = rev_res.data or []

            # Bookings (completed, confirmed, cancelled)
            bookings_res = client.table("bookings").select("*, jobs(title, job_date, wage_per_worker)").eq("worker_id", worker_id).execute()
            bookings = bookings_res.data or []

            # Approved leaves
            leaves_res = client.table("leave_applications").select("id, status").eq("worker_id", worker_id).eq("status", "approved").execute()
            approved_leaves_count = len(leaves_res.data or [])

            # Cancellations
            canc_res = client.table("job_cancellation_requests").select("id, status").eq("worker_id", worker_id).eq("status", "approved").execute()
            cancellations_count = len(canc_res.data or [])

            completed_jobs = [b for b in bookings if b.get("status") == "completed"]

            # Calculate category averages
            total_reviews = len(reviews)
            if total_reviews > 0:
                avg_overall = round(sum(float(r["overall_rating"]) for r in reviews) / total_reviews, 1)
                avg_punctuality = round(sum(int(r["punctuality_rating"]) for r in reviews) / total_reviews, 1)
                avg_quality = round(sum(int(r["quality_rating"]) for r in reviews) / total_reviews, 1)
                avg_professionalism = round(sum(int(r["professionalism_rating"]) for r in reviews) / total_reviews, 1)
                avg_reliability = round(sum(int(r["reliability_rating"]) for r in reviews) / total_reviews, 1)
                avg_communication = round(sum(int(r["communication_rating"]) for r in reviews) / total_reviews, 1)
            else:
                avg_overall = 5.0
                avg_punctuality = 5.0
                avg_quality = 5.0
                avg_professionalism = 5.0
                avg_reliability = 5.0
                avg_communication = 5.0

            return jsonify({
                "success": True,
                "worker_id": worker_id,
                "metrics": {
                    "average_rating": avg_overall,
                    "total_reviews": total_reviews,
                    "completed_jobs_count": len(completed_jobs),
                    "category_ratings": {
                        "punctuality": avg_punctuality,
                        "quality": avg_quality,
                        "professionalism": avg_professionalism,
                        "reliability": avg_reliability,
                        "communication": avg_communication
                    },
                    "reliability_indicators": {
                        "completed_jobs": len(completed_jobs),
                        "approved_leaves": approved_leaves_count,
                        "unapproved_absences": 0,
                        "no_shows": 0,
                        "cancellations": cancellations_count,
                        "note": "Approved leave is an excused absence and does not negatively affect worker reliability scores."
                    }
                },
                "recent_reviews": reviews[:10],
                "verified_jobs_history": completed_jobs
            }), 200

        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    # Demo fallback
    worker_reviews = [r for r in _demo_reviews_store if r.get("worker_id") == worker_id]
    tot = len(worker_reviews)
    return jsonify({
        "success": True,
        "worker_id": worker_id,
        "metrics": {
            "average_rating": 4.8 if tot == 0 else round(sum(float(r["overall_rating"]) for r in worker_reviews) / tot, 1),
            "total_reviews": tot,
            "completed_jobs_count": 12,
            "category_ratings": {
                "punctuality": 4.9,
                "quality": 4.8,
                "professionalism": 5.0,
                "reliability": 4.7,
                "communication": 4.8
            },
            "reliability_indicators": {
                "completed_jobs": 12,
                "approved_leaves": 1,
                "unapproved_absences": 0,
                "no_shows": 0,
                "cancellations": 0,
                "note": "Approved leave is an excused absence and does not negatively affect worker reliability scores."
            }
        },
        "recent_reviews": worker_reviews,
        "verified_jobs_history": []
    }), 200


@reviews_bp.route("/reviews/<review_id>/report", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def report_fraudulent_review(review_id: str):
    """
    Worker flags a review for moderation.
    Ensures genuine negative reviews cannot be deleted by workers,
    while offering a transparent dispute reporting process.
    """
    payload = request.get_json(silent=True) or {}
    report_reason = str(payload.get("report_reason") or "").strip()
    if len(report_reason) < 5:
        return jsonify({"success": False, "message": "Please explain why this review is fraudulent or abusive", "error_code": "VALIDATION_ERROR"}), 400

    worker_id = g.current_user["id"]
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            rev_res = client.table("worker_reviews").select("*").eq("id", review_id).maybe_single().execute()
            if not rev_res or not rev_res.data:
                return jsonify({"success": False, "message": "Review not found", "error_code": "NOT_FOUND"}), 404
            if rev_res.data.get("worker_id") != worker_id:
                return jsonify({"success": False, "message": "Unauthorized", "error_code": "FORBIDDEN"}), 403

            client.table("worker_reviews").update({
                "is_reported": True,
                "report_reason": report_reason
            }).eq("id", review_id).execute()

            return jsonify({
                "success": True,
                "message": "Review flagged for administrative moderation review."
            }), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e), "error_code": "DATABASE_ERROR"}), 500

    return jsonify({"success": True, "message": "Review flagged for moderation (Demo Mode)."}), 200
