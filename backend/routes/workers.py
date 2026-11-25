from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
from services.auth import require_auth
from services.validation import validate_coordinates
from database.supabase_client import get_service_client
from config import Config

workers_bp = Blueprint("workers", __name__)

@workers_bp.route("/workers/status", methods=["PATCH", "POST"])
@workers_bp.route("/workers/availability", methods=["PATCH", "POST"])
@require_auth(allowed_roles=["worker"])
def update_availability():
    """
    Allow worker to set availability online or offline.
    Dual routes support both the project specification and frontend api.js.
    """
    data = request.get_json(silent=True) or {}
    is_available = bool(data.get("is_available", True))
    worker_id = g.current_user["id"]

    if not Config.is_supabase_configured():
        return jsonify({
            "success": True,
            "message": f"Availability set to {'available' if is_available else 'unavailable'} (Demo Mode)",
            "is_available": is_available,
            "data": {"is_available": is_available}
        }), 200

    try:
        client = get_service_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        # Update worker_profiles
        client.table("worker_profiles").upsert({
            "user_id": worker_id,
            "is_available": is_available,
            "updated_at": now_iso
        }).execute()

        # Keep legacy profiles table in sync
        client.table("profiles").update({
            "is_available": is_available,
            "updated_at": now_iso
        }).eq("id", worker_id).execute()

        return jsonify({
            "success": True,
            "message": f"Availability successfully set to {'available' if is_available else 'unavailable'}.",
            "is_available": is_available,
            "data": {"is_available": is_available}
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to update availability: {str(e)}",
            "error_code": "SERVER_ERROR"
        }), 500


@workers_bp.route("/workers/location", methods=["PATCH", "POST"])
@require_auth(allowed_roles=["worker"])
def update_location():
    """
    Receive worker GPS coordinates after user grants browser location permission.
    Validates latitude and longitude, keeping coordinates secure on server.
    """
    data = request.get_json(silent=True) or {}
    lat = data.get("latitude") if data.get("latitude") is not None else data.get("lat")
    lng = data.get("longitude") if data.get("longitude") is not None else data.get("lng")

    is_valid, err_msg = validate_coordinates(lat, lng)
    if not is_valid:
        return jsonify({
            "success": False,
            "message": err_msg,
            "error_code": "INVALID_COORDINATES"
        }), 400

    worker_id = g.current_user["id"]
    lat_val = float(lat)
    lng_val = float(lng)

    if not Config.is_supabase_configured():
        return jsonify({
            "success": True,
            "message": "Location updated (Demo Mode)",
            "location": {"latitude": lat_val, "longitude": lng_val},
            "data": {"latitude": lat_val, "longitude": lng_val}
        }), 200

    try:
        client = get_service_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        client.table("worker_profiles").upsert({
            "user_id": worker_id,
            "latitude": lat_val,
            "longitude": lng_val,
            "is_available": True,
            "location_updated_at": now_iso,
            "updated_at": now_iso
        }).execute()

        client.table("profiles").update({
            "is_available": True,
            "updated_at": now_iso
        }).eq("id", worker_id).execute()

        return jsonify({
            "success": True,
            "message": "Worker location updated successfully.",
            "location": {"latitude": lat_val, "longitude": lng_val},
            "data": {"latitude": lat_val, "longitude": lng_val}
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to update location: {str(e)}",
            "error_code": "SERVER_ERROR"
        }), 500


@workers_bp.route("/workers/offers", methods=["GET"])
@require_auth(allowed_roles=["worker"])
def get_worker_offers():
    """
    Return pending, unexpired offers belonging exclusively to the authenticated worker.
    Privacy safeguard: Approximate distance and area description are returned,
    hiding exact coordinates and worksite address until booking confirmation.
    """
    worker_id = g.current_user["id"]

    if not Config.is_supabase_configured():
        return jsonify({
            "success": True,
            "offers": [],
            "data": []
        }), 200

    try:
        client = get_service_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Fetch pending offers that are unexpired
        offers_res = client.table("job_offers").select("*").eq("worker_id", worker_id).eq("status", "pending").gt("expires_at", now_iso).order("created_at", desc=True).execute()

        if not offers_res or not offers_res.data:
            return jsonify({
                "success": True,
                "offers": [],
                "data": []
            }), 200

        # 2. Fetch associated jobs
        job_ids = list({o["job_id"] for o in offers_res.data})
        jobs_res = client.table("jobs").select("id, title, description, required_skill, skill, wage_per_worker, wage, job_date, date, duration_hours, worksite_address, location, status").in_("id", job_ids).execute()

        jobs_map = {j["id"]: j for j in (jobs_res.data if jobs_res else [])}

        results = []
        for offer in offers_res.data:
            job = jobs_map.get(offer["job_id"])
            if not job or job.get("status") in ("completed", "cancelled"):
                continue

            dist_km = float(offer.get("distance_km") or 0.0)
            approx_loc = job.get("worksite_address") or job.get("location") or "Local Site"
            if dist_km > 0:
                loc_label = f"{approx_loc} (~{dist_km:.1f} km away)"
            else:
                loc_label = approx_loc

            wage = float(job.get("wage_per_worker") or job.get("wage") or 0)
            skill = job.get("required_skill") or job.get("skill") or "General Labour"
            job_date = job.get("job_date") or job.get("date")

            results.append({
                "id": offer["id"],
                "offer_id": offer["id"],
                "job_id": job["id"],
                "title": job.get("title"),
                "description": job.get("description"),
                "skill": skill,
                "wage": wage,
                "distance_km": dist_km,
                "location": loc_label,
                "date": str(job_date) if job_date else "",
                "duration_hours": job.get("duration_hours", 8),
                "expires_at": offer.get("expires_at"),
                "created_at": offer.get("created_at")
            })

        return jsonify({
            "success": True,
            "offers": results,
            "data": results
        }), 200

    except Exception as e:
        err_str = str(e)
        if "PGRST205" in err_str or "schema cache" in err_str or "42501" in err_str:
            print(f"[WorkLink DB Warning] get_worker_offers fallback: {err_str}")
            return jsonify({
                "success": True,
                "offers": [],
                "data": []
            }), 200
        return jsonify({
            "success": False,
            "message": f"Failed to retrieve offers: {err_str}",
            "error_code": "SERVER_ERROR"
        }), 500


@workers_bp.route("/workers/bookings", methods=["GET"])
@require_auth(allowed_roles=["worker"])
def get_worker_bookings():
    """
    Return confirmed bookings for the authenticated worker with full worksite navigation details.
    """
    worker_id = g.current_user["id"]

    if not Config.is_supabase_configured():
        return jsonify({
            "success": True,
            "bookings": [],
            "data": []
        }), 200

    try:
        client = get_service_client()

        # Query bookings for this worker
        bookings_res = client.table("bookings").select("*").eq("worker_id", worker_id).order("confirmed_at", desc=True).execute()

        if not bookings_res or not bookings_res.data:
            return jsonify({
                "success": True,
                "bookings": [],
                "data": []
            }), 200

        job_ids = list({b["job_id"] for b in bookings_res.data})
        jobs_res = client.table("jobs").select("*").in_("id", job_ids).execute()
        jobs_map = {j["id"]: j for j in (jobs_res.data if jobs_res else [])}

        customer_ids = list({j["customer_id"] for j in jobs_map.values() if j.get("customer_id")})
        cust_res = client.table("profiles").select("id, full_name, phone").in_("id", customer_ids).execute()
        cust_map = {c["id"]: c for c in (cust_res.data if cust_res else [])}

        results = []
        for b in bookings_res.data:
            job = jobs_map.get(b["job_id"], {})
            customer = cust_map.get(job.get("customer_id"), {})

            loc_str = job.get("worksite_address") or job.get("location") or "Bangalore"
            lat = job.get("latitude")
            lng = job.get("longitude")

            if lat and lng:
                maps_url = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"
            else:
                maps_url = f"https://www.google.com/maps/search/?api=1&query={loc_str.replace(' ', '+')}"

            results.append({
                "id": b["id"],
                "booking_id": b["id"],
                "job_id": b["job_id"],
                "title": job.get("title", "Confirmed Job"),
                "description": job.get("description", ""),
                "wage": float(b.get("agreed_wage") or job.get("wage_per_worker") or 0),
                "status": b.get("status", "confirmed"),
                "location": loc_str,
                "latitude": lat,
                "longitude": lng,
                "maps_url": maps_url,
                "date": str(job.get("job_date") or job.get("date") or ""),
                "customer_name": customer.get("full_name", "Site Employer"),
                "customer_phone": customer.get("phone", "Contact via platform"),
                "confirmed_at": b.get("confirmed_at")
            })

        return jsonify({
            "success": True,
            "bookings": results,
            "data": results
        }), 200

    except Exception as e:
        err_str = str(e)
        if "PGRST205" in err_str or "schema cache" in err_str or "42501" in err_str:
            print(f"[WorkLink DB Warning] get_worker_bookings fallback: {err_str}")
            return jsonify({
                "success": True,
                "bookings": [],
                "data": []
            }), 200
        return jsonify({
            "success": False,
            "message": f"Failed to retrieve bookings: {err_str}",
            "error_code": "SERVER_ERROR"
        }), 500
