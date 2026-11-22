from flask import Blueprint, jsonify, g
from services.auth import require_auth
from database.supabase_client import get_service_client
from config import Config

bookings_bp = Blueprint("bookings", __name__)

@bookings_bp.route("/bookings/<booking_id>", methods=["GET"])
@require_auth()
def get_booking(booking_id: str):
    """
    Return booking information only to authorized participants (the worker or the customer).
    Includes full worksite coordinates, address, and Google Maps directions link.
    """
    user_id = g.current_user["id"]

    if not Config.is_supabase_configured():
        mock_booking = {
            "id": booking_id,
            "title": "Masonry and Wall Plastering",
            "agreed_wage": 950,
            "status": "confirmed",
            "location": "5th Main, Indiranagar, Bengaluru",
            "worksite_address": "5th Main, Indiranagar, Bengaluru",
            "latitude": 12.9784,
            "longitude": 77.6408,
            "google_maps_url": "https://www.google.com/maps/dir/?api=1&destination=12.9784,77.6408",
            "customer_name": "Ramesh Patel",
            "customer_phone": "+91 98860 12345"
        }
        return jsonify({
            "success": True,
            "booking": mock_booking,
            "data": mock_booking
        }), 200

    try:
        client = get_service_client()

        # 1. Fetch booking record
        booking_res = client.table("bookings").select("*").eq("id", booking_id).maybe_single().execute()
        if not booking_res or not booking_res.data:
            return jsonify({
                "success": False,
                "message": "Booking not found",
                "error_code": "NOT_FOUND"
            }), 404

        booking = booking_res.data
        job_id = booking["job_id"]
        worker_id = booking["worker_id"]

        # 2. Fetch associated job
        job_res = client.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
        if not job_res or not job_res.data:
            return jsonify({
                "success": False,
                "message": "Associated job record not found",
                "error_code": "NOT_FOUND"
            }), 404

        job = job_res.data
        customer_id = job["customer_id"]

        # 3. Authorization check: user must be the worker or the customer
        if user_id != worker_id and user_id != customer_id:
            return jsonify({
                "success": False,
                "message": "Access denied. You are not an authorized participant for this booking.",
                "error_code": "FORBIDDEN"
            }), 403

        # 4. Fetch customer profile for contact info
        cust_res = client.table("profiles").select("full_name, phone, organization").eq("id", customer_id).maybe_single().execute()
        cust = cust_res.data if cust_res else {}

        # 5. Build Google Maps directions link without paid API
        loc_str = job.get("worksite_address") or job.get("location") or "Bengaluru"
        lat = job.get("latitude")
        lng = job.get("longitude")

        if lat and lng:
            maps_url = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"
        else:
            maps_url = f"https://www.google.com/maps/search/?api=1&query={loc_str.replace(' ', '+')}"

        booking_details = {
            "id": booking["id"],
            "booking_id": booking["id"],
            "job_id": job_id,
            "title": job.get("title", "Confirmed Work"),
            "description": job.get("description", ""),
            "agreed_wage": float(booking.get("agreed_wage") or job.get("wage_per_worker") or 0),
            "wage": float(booking.get("agreed_wage") or job.get("wage_per_worker") or 0),
            "status": booking.get("status", "confirmed"),
            "worksite_address": loc_str,
            "location": loc_str,
            "latitude": lat,
            "longitude": lng,
            "google_maps_url": maps_url,
            "date": str(job.get("job_date") or job.get("date") or ""),
            "duration_hours": job.get("duration_hours", 8),
            "customer_name": cust.get("full_name", "Site Employer"),
            "customer_phone": cust.get("phone", "Site Contact"),
            "customer_org": cust.get("organization", ""),
            "confirmed_at": booking.get("confirmed_at")
        }

        return jsonify({
            "success": True,
            "booking": booking_details,
            "data": booking_details
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Server error fetching booking: {str(e)}",
            "error_code": "SERVER_ERROR"
        }), 500
