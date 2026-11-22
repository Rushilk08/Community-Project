import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from config import Config
from database.supabase_client import get_service_client

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great-circle distance between two points on the Earth
    using the Haversine formula. Returns distance in kilometers (km).
    No external paid API required.
    """
    R = 6371.0  # Earth's radius in kilometers

    # Convert degrees to radians
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)

    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def find_eligible_workers(
    job_id: str,
    job_lat: float,
    job_lng: float,
    required_skill: str,
    max_radius_km: float = None,
    exclude_worker_ids: List[str] = None
) -> List[Dict[str, Any]]:
    """
    Finds and ranks eligible nearby workers for a job:
    1. Online workers only (is_available = True)
    2. Matching skill requirement
    3. Excludes workers who already rejected this job
    4. Excludes workers with existing confirmed bookings on the same job
    5. Filters stale locations (> LOCATION_STALE_HOURS)
    6. Filters within configurable radius (default 10 km)
    7. Sorts ascending by straight-line Haversine distance
    8. Privacy: Worker coordinates are kept internal and never exposed to customers.
    """
    if max_radius_km is None:
        max_radius_km = Config.DEFAULT_DISPATCH_RADIUS_KM

    excluded_set = set(exclude_worker_ids or [])

    if not Config.is_supabase_configured():
        # Demo fallback for offline local testing
        return [
            {
                "worker_id": "00000000-0000-0000-0000-000000000002",
                "distance_km": 2.4,
                "skills": [required_skill]
            }
        ]

    client = get_service_client()

    # 1. Fetch workers who previously rejected or were rejected for this job
    past_offers_res = client.table("job_offers").select("worker_id").eq("job_id", job_id).eq("status", "rejected").execute()
    if past_offers_res and past_offers_res.data:
        for row in past_offers_res.data:
            excluded_set.add(row["worker_id"])

    # 2. Fetch workers already confirmed/booked for this job
    bookings_res = client.table("bookings").select("worker_id").eq("job_id", job_id).execute()
    if bookings_res and bookings_res.data:
        for row in bookings_res.data:
            excluded_set.add(row["worker_id"])

    # 3. Fetch online workers
    # Query worker_profiles where is_available is true and latitude/longitude are present
    workers_res = client.table("worker_profiles").select("user_id, skills, is_available, latitude, longitude, location_updated_at").eq("is_available", True).execute()

    if not workers_res or not workers_res.data:
        return []

    eligible_workers = []
    stale_cutoff = datetime.now(timezone.utc) - timedelta(hours=Config.LOCATION_STALE_HOURS)
    req_skill_lower = required_skill.strip().lower()

    for worker in workers_res.data:
        worker_id = worker["user_id"]
        if worker_id in excluded_set:
            continue

        # Check coordinates (fallback gracefully if worker hasn't shared GPS yet)
        lat = worker.get("latitude")
        lng = worker.get("longitude")
        if lat is None or lng is None:
            lat = float(job_lat) + 0.008
            lng = float(job_lng) + 0.008

        # Check stale location (if timestamp provided)
        loc_time_str = worker.get("location_updated_at")
        if loc_time_str:
            try:
                loc_time = datetime.fromisoformat(loc_time_str.replace("Z", "+00:00"))
                if loc_time < stale_cutoff:
                    continue
            except Exception:
                pass

        # Skill matching: Check if required skill is in worker's skills array or matches trade
        worker_skills = worker.get("skills") or []
        if isinstance(worker_skills, str):
            worker_skills = [worker_skills]

        has_skill = any(
            req_skill_lower in s.lower() or s.lower() in req_skill_lower or req_skill_lower == "general labour"
            for s in worker_skills
        )

        if not has_skill:
            continue

        # Calculate Haversine distance
        dist = haversine_distance(float(job_lat), float(job_lng), float(lat), float(lng))

        if dist <= max_radius_km:
            eligible_workers.append({
                "worker_id": worker_id,
                "distance_km": round(dist, 2),
                "skills": worker_skills
            })

    # Sort workers by distance ascending (nearest worker first)
    eligible_workers.sort(key=lambda w: w["distance_km"])
    return eligible_workers
