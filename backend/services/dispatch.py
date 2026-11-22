from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from config import Config
from database.supabase_client import get_service_client
from services.matching import find_eligible_workers

def expire_stale_offers_sweep() -> int:
    """
    Finds pending offers past their expiry time and updates status to 'expired'.
    Returns number of expired offers.
    """
    if not Config.is_supabase_configured():
        return 0

    client = get_service_client()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Query expired pending offers
    res = client.table("job_offers").select("id, job_id").eq("status", "pending").lt("expires_at", now_iso).execute()

    if not res or not res.data:
        return 0

    expired_count = 0
    jobs_to_reassign = set()

    for offer in res.data:
        offer_id = offer["id"]
        job_id = offer["job_id"]
        client.table("job_offers").update({
            "status": "expired",
            "updated_at": now_iso
        }).eq("id", offer_id).execute()
        expired_count += 1
        jobs_to_reassign.add(job_id)

    # Reassign jobs that lost pending workers to the next eligible workers
    for job_id in jobs_to_reassign:
        try:
            dispatch_job_offers(job_id)
        except Exception as e:
            print(f"[Dispatch Warning] Failed auto-reassignment for job {job_id}: {e}")

    return expired_count

def dispatch_job_offers(job_id: str) -> List[Dict[str, Any]]:
    """
    Dispatches job offers to nearest available workers matching the required skill.
    Calculates remaining vacancies and dispatches new pending offers with expiry.
    """
    if not Config.is_supabase_configured():
        return []

    client = get_service_client()

    # 1. Fetch current job state
    job_res = client.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
    if not job_res or not job_res.data:
        return []

    job = job_res.data
    if job.get("status") in ("completed", "cancelled"):
        return []

    workers_needed = int(job.get("workers_needed") or job.get("workers_required") or 1)
    confirmed_workers = int(job.get("confirmed_workers") or 0)
    vacancies = workers_needed - confirmed_workers

    if vacancies <= 0:
        return []

    # 2. Count current pending active offers for this job
    now_iso = datetime.now(timezone.utc).isoformat()
    pending_offers_res = client.table("job_offers").select("worker_id").eq("job_id", job_id).eq("status", "pending").gt("expires_at", now_iso).execute()

    already_offered_workers = set()
    if pending_offers_res and pending_offers_res.data:
        for o in pending_offers_res.data:
            already_offered_workers.add(o["worker_id"])

    # Number of offers we still need to send out
    slots_to_dispatch = vacancies - len(already_offered_workers)
    if slots_to_dispatch <= 0:
        return []

    # 3. Find eligible nearby workers
    job_lat = float(job.get("latitude") or 12.9716)
    job_lng = float(job.get("longitude") or 77.5946)
    skill = job.get("required_skill") or job.get("skill") or "General Labour"

    eligible_workers = find_eligible_workers(
        job_id=job_id,
        job_lat=job_lat,
        job_lng=job_lng,
        required_skill=skill,
        exclude_worker_ids=list(already_offered_workers)
    )

    if not eligible_workers:
        return []

    # 4. Create pending offers for the top candidates
    created_offers = []
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=Config.OFFER_EXPIRY_MINUTES)).isoformat()

    for candidate in eligible_workers[:slots_to_dispatch]:
        worker_id = candidate["worker_id"]
        dist = candidate["distance_km"]

        offer_payload = {
            "job_id": job_id,
            "worker_id": worker_id,
            "status": "pending",
            "distance_km": dist,
            "expires_at": expires_at,
            "created_at": now_iso,
            "updated_at": now_iso
        }

        insert_res = client.table("job_offers").insert(offer_payload).execute()
        if insert_res and insert_res.data:
            created_offers.append(insert_res.data[0])

    return created_offers

def reassign_job_offer(job_id: str) -> List[Dict[str, Any]]:
    """
    Called when an offer is rejected or expired to immediately backfill
    the vacant position with the next closest eligible worker.
    """
    return dispatch_job_offers(job_id)
