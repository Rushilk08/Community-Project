from datetime import datetime, date, time, timedelta, timezone
from typing import Dict, Any, List, Optional
from config import Config
from database.supabase_client import get_service_client

# In-memory storage fallback for demo / test runs when Supabase is not configured
_demo_availability_store = {
    "leaves": [],
    "cancellations": [],
    "bookings": []
}

def parse_time_range(job_date_str: str, start_time_str: str = "09:00", duration_hours: float = 8.0):
    """
    Parses date and time into start and end datetimes.
    """
    try:
        if isinstance(job_date_str, date):
            job_date = job_date_str
        else:
            job_date = datetime.strptime(str(job_date_str).split("T")[0], "%Y-%m-%d").date()
    except Exception:
        job_date = datetime.now(timezone.utc).date()

    try:
        parts = str(start_time_str).split(":")
        start_hour = int(parts[0])
        start_minute = int(parts[1]) if len(parts) > 1 else 0
    except Exception:
        start_hour, start_minute = 9, 0

    start_dt = datetime.combine(job_date, time(hour=start_hour, minute=start_minute))
    end_dt = start_dt + timedelta(hours=float(duration_hours or 8.0))
    return start_dt, end_dt

def times_overlap(start1: datetime, end1: datetime, start2: datetime, end2: datetime) -> bool:
    """
    Checks if two time intervals overlap (strictly overlap with non-zero intersection).
    """
    return max(start1, start2) < min(end1, end2)

def check_worker_conflict(
    worker_id: str,
    job_date_str: str,
    start_time_str: str = "09:00",
    duration_hours: float = 8.0,
    exclude_booking_id: Optional[str] = None,
    exclude_job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Smart centralized availability and conflict detection.
    Checks:
    1. Active bookings (status in 'confirmed', 'in_progress') overlapping the requested date and time.
    2. Pending cancellations for existing overlapping commitments (pending cancellation does NOT release slot).
    3. Approved leave applications overlapping the requested date.
    
    Returns:
    {
        "conflict": bool,
        "reason": str,
        "conflict_type": Optional[str],
        "conflicting_record": Optional[dict]
    }
    """
    target_start, target_end = parse_time_range(job_date_str, start_time_str, duration_hours)
    target_date_str = target_start.date().isoformat()

    # If Supabase is configured, check database
    if Config.is_supabase_configured():
        try:
            client = get_service_client()

            # 1. Check approved leave applications
            leaves_res = (
                client.table("leave_applications")
                .select("*")
                .eq("worker_id", worker_id)
                .eq("status", "approved")
                .lte("start_date", target_date_str)
                .gte("end_date", target_date_str)
                .execute()
            )
            if leaves_res and leaves_res.data:
                leave = leaves_res.data[0]
                return {
                    "conflict": True,
                    "reason": f"You have an approved leave on this date ({leave.get('start_date')} to {leave.get('end_date')}).",
                    "conflict_type": "APPROVED_LEAVE",
                    "conflicting_record": leave
                }

            # 2. Check confirmed / in_progress bookings
            bookings_res = (
                client.table("bookings")
                .select("id, job_id, status, jobs(id, title, job_date, start_time, duration_hours, status)")
                .eq("worker_id", worker_id)
                .in_("status", ["confirmed", "in_progress"])
                .execute()
            )
            if bookings_res and bookings_res.data:
                for b in bookings_res.data:
                    if exclude_booking_id and b.get("id") == exclude_booking_id:
                        continue
                    job = b.get("jobs") or {}
                    if exclude_job_id and job.get("id") == exclude_job_id:
                        continue
                    if job.get("status") in ["completed", "cancelled"]:
                        continue

                    job_date = job.get("job_date") or job.get("date")
                    if not job_date:
                        continue

                    b_start, b_end = parse_time_range(
                        job_date,
                        job.get("start_time") or "09:00",
                        float(job.get("duration_hours") or 8.0)
                    )

                    if times_overlap(target_start, target_end, b_start, b_end):
                        # Check if cancellation is pending for this booking
                        canc_res = (
                            client.table("job_cancellation_requests")
                            .select("id, status")
                            .eq("booking_id", b["id"])
                            .eq("status", "pending")
                            .execute()
                        )
                        has_pending_cancellation = bool(canc_res and canc_res.data)

                        if has_pending_cancellation:
                            reason = (
                                f"You have an existing accepted job '{job.get('title')}' during this time. "
                                "Your cancellation request is still pending customer approval and does not release your commitment."
                            )
                            c_type = "PENDING_CANCELLATION"
                        else:
                            reason = (
                                f"You already have an accepted job '{job.get('title')}' scheduled from "
                                f"{b_start.strftime('%I:%M %p')} to {b_end.strftime('%I:%M %p')}. "
                                "You cannot accept another job that overlaps with your existing commitment."
                            )
                            c_type = "OVERLAPPING_BOOKING"

                        return {
                            "conflict": True,
                            "reason": reason,
                            "conflict_type": c_type,
                            "conflicting_record": {
                                "booking_id": b.get("id"),
                                "job_title": job.get("title"),
                                "start_time": b_start.isoformat(),
                                "end_time": b_end.isoformat()
                            }
                        }

        except Exception as e:
            # If database error occurs, log and fail safe
            print(f"[Availability] Error querying conflict database: {e}")

    # Fallback / In-Memory Mock Check for test suite & demo mode
    for leave in _demo_availability_store["leaves"]:
        if leave.get("worker_id") == worker_id and leave.get("status") == "approved":
            start_d = str(leave.get("start_date"))
            end_d = str(leave.get("end_date"))
            if start_d <= target_date_str <= end_d:
                return {
                    "conflict": True,
                    "reason": f"You have an approved leave on this date ({start_d} to {end_d}).",
                    "conflict_type": "APPROVED_LEAVE",
                    "conflicting_record": leave
                }

    for b in _demo_availability_store["bookings"]:
        if b.get("worker_id") == worker_id and b.get("status") in ["confirmed", "in_progress"]:
            if exclude_booking_id and b.get("id") == exclude_booking_id:
                continue
            if exclude_job_id and b.get("job_id") == exclude_job_id:
                continue
            b_start, b_end = parse_time_range(
                b.get("job_date", target_date_str),
                b.get("start_time", "09:00"),
                float(b.get("duration_hours", 8))
            )
            if times_overlap(target_start, target_end, b_start, b_end):
                is_pending_cancellation = any(
                    c.get("booking_id") == b.get("id") and c.get("status") == "pending"
                    for c in _demo_availability_store["cancellations"]
                )
                if is_pending_cancellation:
                    return {
                        "conflict": True,
                        "reason": (
                            f"You have an existing accepted job '{b.get('title')}' during this time. "
                            "Your cancellation request is pending customer approval and does not release your commitment."
                        ),
                        "conflict_type": "PENDING_CANCELLATION",
                        "conflicting_record": b
                    }
                return {
                    "conflict": True,
                    "reason": (
                        f"You already have an accepted job '{b.get('title')}' scheduled during this time. "
                        "You cannot accept another job that overlaps with your existing commitment."
                    ),
                    "conflict_type": "OVERLAPPING_BOOKING",
                    "conflicting_record": b
                }

    return {"conflict": False, "reason": None, "conflict_type": None, "conflicting_record": None}


def get_worker_calendar_data(worker_id: str, year: int, month: int) -> List[Dict[str, Any]]:
    """
    Returns calendar data for a given month with statuses:
    - green: 'available'
    - red: 'booked'
    - yellow: 'pending' (pending commitment or pending cancellation)
    - grey: 'leave'
    """
    import calendar
    _, num_days = calendar.monthrange(year, month)
    days_data = []

    # Map dates to commitments
    commitments_by_date = {}

    # Fetch DB records if available
    if Config.is_supabase_configured():
        try:
            client = get_service_client()
            month_start = f"{year:04d}-{month:02d}-01"
            month_end = f"{year:04d}-{month:02d}-{num_days:02d}"

            # Approved leaves
            leaves = (
                client.table("leave_applications")
                .select("*")
                .eq("worker_id", worker_id)
                .eq("status", "approved")
                .lte("start_date", month_end)
                .gte("end_date", month_start)
                .execute()
            )
            for l in (leaves.data or []):
                s_dt = max(datetime.strptime(l["start_date"], "%Y-%m-%d").date(), datetime.strptime(month_start, "%Y-%m-%d").date())
                e_dt = min(datetime.strptime(l["end_date"], "%Y-%m-%d").date(), datetime.strptime(month_end, "%Y-%m-%d").date())
                cur = s_dt
                while cur <= e_dt:
                    ds = cur.isoformat()
                    commitments_by_date[ds] = {
                        "status": "leave",
                        "badge": "grey",
                        "title": f"Leave: {l.get('reason')}",
                        "details": l
                    }
                    cur += timedelta(days=1)

            # Bookings
            bookings = (
                client.table("bookings")
                .select("id, status, jobs(id, title, job_date, start_time, duration_hours)")
                .eq("worker_id", worker_id)
                .in_("status", ["confirmed", "in_progress"])
                .execute()
            )
            for b in (bookings.data or []):
                job = b.get("jobs") or {}
                j_date = job.get("job_date")
                if j_date and j_date.startswith(f"{year:04d}-{month:02d}"):
                    # check if pending cancellation
                    canc = (
                        client.table("job_cancellation_requests")
                        .select("id, status")
                        .eq("booking_id", b["id"])
                        .eq("status", "pending")
                        .execute()
                    )
                    has_canc = bool(canc and canc.data)
                    commitments_by_date[j_date] = {
                        "status": "pending_cancellation" if has_canc else "booked",
                        "badge": "yellow" if has_canc else "red",
                        "title": job.get("title", "Confirmed Job"),
                        "details": b
                    }
        except Exception as e:
            print(f"[Availability] Calendar load error: {e}")

    # Fallback to demo store
    for leave in _demo_availability_store["leaves"]:
        if leave.get("worker_id") == worker_id and leave.get("status") == "approved":
            ds = str(leave.get("start_date"))
            if ds.startswith(f"{year:04d}-{month:02d}"):
                commitments_by_date[ds] = {
                    "status": "leave",
                    "badge": "grey",
                    "title": f"Leave: {leave.get('reason')}",
                    "details": leave
                }
    for b in _demo_availability_store["bookings"]:
        if b.get("worker_id") == worker_id and b.get("status") in ["confirmed", "in_progress"]:
            ds = str(b.get("job_date"))
            if ds.startswith(f"{year:04d}-{month:02d}"):
                has_canc = any(
                    c.get("booking_id") == b.get("id") and c.get("status") == "pending"
                    for c in _demo_availability_store["cancellations"]
                )
                commitments_by_date[ds] = {
                    "status": "pending_cancellation" if has_canc else "booked",
                    "badge": "yellow" if has_canc else "red",
                    "title": b.get("title", "Confirmed Job"),
                    "details": b
                }

    for day in range(1, num_days + 1):
        d_str = f"{year:04d}-{month:02d}-{day:02d}"
        if d_str in commitments_by_date:
            info = commitments_by_date[d_str]
            days_data.append({
                "date": d_str,
                "day": day,
                "status": info["status"],
                "color": info["badge"],
                "title": info["title"],
                "details": info["details"]
            })
        else:
            days_data.append({
                "date": d_str,
                "day": day,
                "status": "available",
                "color": "green",
                "title": "Available for Work",
                "details": None
            })

    return days_data
