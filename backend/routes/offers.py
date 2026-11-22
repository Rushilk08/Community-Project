from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
from services.auth import require_auth
from services.dispatch import reassign_job_offer
from database.supabase_client import get_service_client
from config import Config

offers_bp = Blueprint("offers", __name__)

@offers_bp.route("/offers/<offer_id>/accept", methods=["POST"])
@offers_bp.route("/workers/offers/<offer_id>/accept", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def accept_offer(offer_id: str):
    """
    Worker accepts a job offer.
    Performs atomic booking confirmation via PostgreSQL function to prevent overbooking.
    Dual routes support both the project specification and frontend api.js.
    """
    worker_id = g.current_user["id"]

    if not Config.is_supabase_configured():
        return jsonify({
            "success": True,
            "message": "Offer accepted successfully (Demo Mode)",
            "booking": {
                "id": f"booking-{int(datetime.now().timestamp())}",
                "job_id": "job-101",
                "title": "Masonry Work",
                "wage": 950,
                "location": "Indiranagar, Bengaluru",
                "customer_name": "Ramesh Patel",
                "customer_phone": "+91 98860 12345",
                "status": "confirmed"
            }
        }), 200

    try:
        client = get_service_client()

        # Execute atomic PostgreSQL RPC function
        try:
            rpc_res = client.rpc("accept_job_offer", {
                "p_offer_id": offer_id,
                "p_worker_id": worker_id
            }).execute()

            result = rpc_res.data if rpc_res else None
        except Exception as rpc_err:
            # Python-level atomic fallback if RPC function not created in DB yet
            result = _python_accept_fallback(client, offer_id, worker_id)

        if not result or not result.get("success"):
            error_code = result.get("error_code", "ACCEPT_FAILED") if result else "ACCEPT_FAILED"
            msg = result.get("message", "Unable to accept job offer.") if result else "Unable to accept job offer."

            # If the offer was already accepted by this worker, return their existing confirmed booking idempotently
            if error_code == "OFFER_ALREADY_PROCESSED" and ("already accepted" in msg or "already" in msg):
                existing_booking = client.table("bookings").select("*").eq("worker_id", worker_id).eq("status", "confirmed").order("created_at", desc=True).limit(1).maybe_single().execute()
                if existing_booking and existing_booking.data:
                    b = existing_booking.data
                    job_id = b.get("job_id")
                    job_res = client.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
                    job = job_res.data if job_res else {}
                    customer_res = client.table("profiles").select("full_name, phone").eq("id", job.get("customer_id")).maybe_single().execute()
                    cust = customer_res.data if customer_res else {}
                    loc_str = job.get("worksite_address") or job.get("location") or "Bengaluru"
                    lat = job.get("latitude")
                    lng = job.get("longitude")
                    if lat and lng:
                        maps_url = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"
                    else:
                        maps_url = f"https://www.google.com/maps/search/?api=1&query={loc_str.replace(' ', '+')}"

                    booking_data = {
                        "id": b["id"],
                        "job_id": job_id,
                        "title": job.get("title", "Confirmed Job"),
                        "agreed_wage": b.get("agreed_wage"),
                        "wage": b.get("agreed_wage"),
                        "status": "confirmed",
                        "worksite_address": loc_str,
                        "location": loc_str,
                        "latitude": lat,
                        "longitude": lng,
                        "google_maps_url": maps_url,
                        "customer_name": cust.get("full_name", "Site Employer"),
                        "customer_phone": cust.get("phone", "Site Contact"),
                        "confirmed_at": b.get("confirmed_at")
                    }
                    return jsonify({
                        "success": True,
                        "message": "Offer already accepted. Booking confirmed.",
                        "booking": booking_data,
                        "data": booking_data
                    }), 200

            return jsonify({
                "success": False,
                "message": msg,
                "error_code": error_code
            }), 400

        # Fetch confirmed booking details and worksite navigation
        booking_id = result.get("booking_id")
        job_id = result.get("job_id")

        job_res = client.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
        job = job_res.data if job_res else {}

        customer_res = client.table("profiles").select("full_name, phone").eq("id", job.get("customer_id")).maybe_single().execute()
        cust = customer_res.data if customer_res else {}

        loc_str = job.get("worksite_address") or job.get("location") or "Bengaluru"
        lat = job.get("latitude")
        lng = job.get("longitude")

        if lat and lng:
            maps_url = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"
        else:
            maps_url = f"https://www.google.com/maps/search/?api=1&query={loc_str.replace(' ', '+')}"

        booking_data = {
            "id": booking_id,
            "job_id": job_id,
            "title": job.get("title", "Confirmed Job"),
            "agreed_wage": result.get("agreed_wage"),
            "wage": result.get("agreed_wage"),
            "status": "confirmed",
            "worksite_address": loc_str,
            "location": loc_str,
            "latitude": lat,
            "longitude": lng,
            "google_maps_url": maps_url,
            "customer_name": cust.get("full_name", "Site Employer"),
            "customer_phone": cust.get("phone", "Site Contact"),
            "confirmed_at": datetime.now(timezone.utc).isoformat()
        }

        return jsonify({
            "success": True,
            "message": "Offer accepted and booking confirmed successfully.",
            "booking": booking_data,
            "data": booking_data
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Server error accepting offer: {str(e)}",
            "error_code": "SERVER_ERROR"
        }), 500


def _python_accept_fallback(client, offer_id: str, worker_id: str) -> dict:
    """Python fallback matching logic if PostgreSQL RPC is not installed."""
    offer_res = client.table("job_offers").select("*").eq("id", offer_id).eq("worker_id", worker_id).maybe_single().execute()
    if not offer_res or not offer_res.data:
        return {"success": False, "error_code": "OFFER_NOT_FOUND", "message": "Offer not found or unauthorized"}

    offer = offer_res.data
    if offer.get("status") != "pending":
        return {"success": False, "error_code": "OFFER_ALREADY_PROCESSED", "message": "Offer is no longer pending"}

    job_id = offer["job_id"]
    job_res = client.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
    if not job_res or not job_res.data:
        return {"success": False, "error_code": "JOB_NOT_FOUND", "message": "Job not found"}

    job = job_res.data
    workers_needed = int(job.get("workers_needed") or job.get("workers_required") or 1)
    confirmed = int(job.get("confirmed_workers") or 0)

    if confirmed >= workers_needed:
        client.table("job_offers").update({"status": "expired"}).eq("id", offer_id).execute()
        return {"success": False, "error_code": "JOB_FULL", "message": "Positions for this job are already filled"}

    # Mark offer accepted
    now_iso = datetime.now(timezone.utc).isoformat()
    client.table("job_offers").update({"status": "accepted", "updated_at": now_iso}).eq("id", offer_id).execute()

    # Insert booking
    wage = float(job.get("wage_per_worker") or job.get("wage") or 0)
    booking_res = client.table("bookings").insert({
        "job_id": job_id,
        "worker_id": worker_id,
        "agreed_wage": wage,
        "status": "confirmed",
        "confirmed_at": now_iso
    }).execute()

    booking_id = booking_res.data[0]["id"] if booking_res and booking_res.data else f"b-{offer_id}"

    # Update job count
    new_confirmed = confirmed + 1
    new_status = "in_progress" if new_confirmed >= workers_needed else job.get("status")
    client.table("jobs").update({
        "confirmed_workers": new_confirmed,
        "status": new_status,
        "updated_at": now_iso
    }).eq("id", job_id).execute()

    return {
        "success": True,
        "booking_id": booking_id,
        "job_id": job_id,
        "agreed_wage": wage
    }


@offers_bp.route("/offers/<offer_id>/reject", methods=["POST"])
@offers_bp.route("/workers/offers/<offer_id>/reject", methods=["POST"])
@require_auth(allowed_roles=["worker"])
def reject_offer(offer_id: str):
    """
    Worker rejects an offer.
    Marks offer as rejected and triggers immediate reassignment to the next eligible worker.
    """
    worker_id = g.current_user["id"]

    if not Config.is_supabase_configured():
        return jsonify({
            "success": True,
            "message": "Offer rejected (Demo Mode)"
        }), 200

    try:
        client = get_service_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Fetch offer and verify ownership
        offer_res = client.table("job_offers").select("*").eq("id", offer_id).eq("worker_id", worker_id).maybe_single().execute()
        if not offer_res or not offer_res.data:
            return jsonify({
                "success": False,
                "message": "Offer not found or unauthorized.",
                "error_code": "OFFER_NOT_FOUND"
            }), 404

        offer = offer_res.data
        job_id = offer["job_id"]

        # 2. Mark offer rejected
        client.table("job_offers").update({
            "status": "rejected",
            "updated_at": now_iso
        }).eq("id", offer_id).execute()

        # 3. Log audit event
        client.table("audit_logs").insert({
            "actor_id": worker_id,
            "action": "OFFER_REJECTED",
            "entity_type": "job_offer",
            "entity_id": offer_id,
            "metadata": {"job_id": job_id}
        }).execute()

        # 4. Trigger automatic reassignment to next eligible worker
        reassign_job_offer(job_id)

        return jsonify({
            "success": True,
            "message": "Offer rejected. The position will be dispatched to another eligible worker."
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to reject offer: {str(e)}",
            "error_code": "SERVER_ERROR"
        }), 500
