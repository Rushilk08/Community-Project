import pytest
from app import create_app
from config import Config
from services.availability import check_worker_conflict, _demo_availability_store

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(Config, "is_supabase_configured", classmethod(lambda cls: False))
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_referrals_available_jobs(client):
    res = client.get(
        "/api/referrals/available-jobs",
        headers={"X-Test-Auth": "1", "X-Test-Role": "worker", "X-Test-User-Id": "worker-1"}
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "jobs" in data

def test_referral_submission_and_duplicate_prevention(client):
    # Submit referral
    payload = {
        "job_id": "job-101",
        "candidate_name": "Ravi Shankar",
        "candidate_phone": "+91 99001 22334",
        "candidate_skills": "Mason, Plasterer",
        "experience": "5 years residential construction",
        "location": "Indiranagar, Bengaluru",
        "notes": "Very reliable skilled worker",
        "consent_confirmed": True
    }
    res = client.post(
        "/api/referrals",
        json=payload,
        headers={"X-Test-Auth": "1", "X-Test-Role": "worker", "X-Test-User-Id": "worker-1"}
    )
    assert res.status_code == 201
    data = res.get_json()
    assert data["success"] is True
    assert "invitation_link" in data
    referral_id = data["referral"]["id"]

    # Duplicate referral for same candidate & job should be blocked
    dup_res = client.post(
        "/api/referrals",
        json=payload,
        headers={"X-Test-Auth": "1", "X-Test-Role": "worker", "X-Test-User-Id": "worker-1"}
    )
    assert dup_res.status_code == 400
    assert dup_res.get_json()["error_code"] == "DUPLICATE_REFERRAL"

    # Customer reviews and accepts referral
    dec_res = client.patch(
        f"/api/referrals/{referral_id}/decision",
        json={"decision": "accepted"},
        headers={"X-Test-Auth": "1", "X-Test-Role": "customer", "X-Test-User-Id": "customer-1"}
    )
    assert dec_res.status_code == 200
    assert dec_res.get_json()["success"] is True

def test_leave_application_and_customer_decision(client):
    payload = {
        "job_id": "job-101",
        "booking_id": "booking-test-1",
        "start_date": "2026-11-28",
        "end_date": "2026-11-29",
        "reason": "Family emergency and medical checkup",
        "description": "Will resume on 30th",
        "is_emergency": True
    }
    res = client.post(
        "/api/leaves",
        json=payload,
        headers={"X-Test-Auth": "1", "X-Test-Role": "worker", "X-Test-User-Id": "worker-leave-1"}
    )
    assert res.status_code == 201
    data = res.get_json()
    assert data["success"] is True
    leave_id = data["leave"]["id"]

    # Customer approves leave
    app_res = client.patch(
        f"/api/leaves/{leave_id}/decision",
        json={"decision": "approved", "review_notes": "Approved for emergency medical reasons"},
        headers={"X-Test-Auth": "1", "X-Test-Role": "customer", "X-Test-User-Id": "customer-1"}
    )
    assert app_res.status_code == 200
    assert app_res.get_json()["leave"]["status"] == "approved"

    # Worker availability check should now detect approved leave on that date
    conflict = check_worker_conflict("worker-leave-1", "2026-11-28")
    assert conflict["conflict"] is True
    assert conflict["conflict_type"] == "APPROVED_LEAVE"

def test_job_cancellation_workflow(client):
    payload = {
        "booking_id": "booking-canc-1",
        "reason": "Personal medical condition",
        "explanation": "Doctor advised 3 days bed rest",
        "acknowledged_approval_required": True
    }
    res = client.post(
        "/api/cancellations",
        json=payload,
        headers={"X-Test-Auth": "1", "X-Test-Role": "worker", "X-Test-User-Id": "worker-canc-1"}
    )
    assert res.status_code == 201
    data = res.get_json()
    assert data["success"] is True
    canc_id = data["cancellation"]["id"]

    # Pending cancellation does NOT release slot - conflict detection must still flag commitment!
    _demo_availability_store["bookings"].append({
        "id": "booking-canc-1",
        "worker_id": "worker-canc-1",
        "title": "Painting Project",
        "job_date": "2026-12-01",
        "start_time": "09:00",
        "duration_hours": 8,
        "status": "confirmed"
    })
    conflict = check_worker_conflict("worker-canc-1", "2026-12-01", "10:00", 4)
    assert conflict["conflict"] is True
    assert conflict["conflict_type"] == "PENDING_CANCELLATION"

    # Customer approves cancellation
    dec_res = client.patch(
        f"/api/cancellations/{canc_id}/decision",
        json={"decision": "approved"},
        headers={"X-Test-Auth": "1", "X-Test-Role": "customer", "X-Test-User-Id": "customer-1"}
    )
    assert dec_res.status_code == 200
    assert dec_res.get_json()["cancellation"]["status"] == "approved"

    # After approval, slot is released
    conflict_after = check_worker_conflict("worker-canc-1", "2026-12-01", "10:00", 4)
    assert conflict_after["conflict"] is False

def test_time_interval_overlap_detection():
    # Job on same day at non-overlapping time is allowed
    _demo_availability_store["bookings"].append({
        "id": "booking-timed-1",
        "worker_id": "worker-time-1",
        "title": "Morning Electrical Work",
        "job_date": "2026-12-05",
        "start_time": "08:00",
        "duration_hours": 4, # 08:00 to 12:00
        "status": "confirmed"
    })

    # Overlapping afternoon job (11:00 to 15:00) -> CONFLICT!
    conf_overlap = check_worker_conflict("worker-time-1", "2026-12-05", "11:00", 4)
    assert conf_overlap["conflict"] is True
    assert conf_overlap["conflict_type"] == "OVERLAPPING_BOOKING"

    # Non-overlapping evening job (14:00 to 18:00) -> ALLOWED!
    conf_non_overlap = check_worker_conflict("worker-time-1", "2026-12-05", "14:00", 4)
    assert conf_non_overlap["conflict"] is False

def test_worker_review_and_reliability_indicators(client):
    payload = {
        "job_id": "job-completed-1",
        "worker_id": "worker-reviewed-1",
        "booking_id": "booking-comp-1",
        "punctuality_rating": 5,
        "quality_rating": 5,
        "professionalism_rating": 4,
        "reliability_rating": 5,
        "communication_rating": 4,
        "review_text": "Completed the masonry work on schedule with great precision."
    }
    res = client.post(
        "/api/reviews",
        json=payload,
        headers={"X-Test-Auth": "1", "X-Test-Role": "customer", "X-Test-User-Id": "customer-1"}
    )
    assert res.status_code == 201
    data = res.get_json()
    assert data["success"] is True
    assert data["review"]["overall_rating"] == 4.6

    # Fetch worker reliability profile
    rel_res = client.get(
        "/api/workers/worker-reviewed-1/reliability",
        headers={"X-Test-Auth": "1", "X-Test-Role": "worker", "X-Test-User-Id": "worker-reviewed-1"}
    )
    assert rel_res.status_code == 200
    metrics = rel_res.get_json()["metrics"]
    assert "category_ratings" in metrics
    assert "reliability_indicators" in metrics
    # Verify approved leave notice is present and not penalizing
    assert "Approved leave" in metrics["reliability_indicators"]["note"]

def test_emergency_replacement_workflow(client):
    # Customer initializes replacement
    rep_payload = {
        "job_id": "job-101",
        "original_worker_id": "worker-orig-1",
        "trigger_reason": "approved_leave",
        "replacement_date": "2026-12-10",
        "start_time": "09:00",
        "duration_hours": 8,
        "required_skill": "Mason"
    }
    res = client.post(
        "/api/replacements",
        json=rep_payload,
        headers={"X-Test-Auth": "1", "X-Test-Role": "customer", "X-Test-User-Id": "customer-1"}
    )
    assert res.status_code == 201
    rep_id = res.get_json()["replacement"]["id"]

    # Candidate search
    cands_res = client.get(
        "/api/replacements/candidates?skill=Mason&date=2026-12-10",
        headers={"X-Test-Auth": "1", "X-Test-Role": "customer", "X-Test-User-Id": "customer-1"}
    )
    assert cands_res.status_code == 200
    assert len(cands_res.get_json()["candidates"]) > 0

    # Send invites
    inv_res = client.post(
        f"/api/replacements/{rep_id}/invite",
        json={"worker_ids": ["worker-rep-candidate-1"]},
        headers={"X-Test-Auth": "1", "X-Test-Role": "customer", "X-Test-User-Id": "customer-1"}
    )
    assert inv_res.status_code == 200

def test_notification_center(client):
    res = client.get(
        "/api/notifications",
        headers={"X-Test-Auth": "1", "X-Test-Role": "worker", "X-Test-User-Id": "worker-1"}
    )
    assert res.status_code == 200
    data = res.get_json()
    assert "notifications" in data
    assert "unread_count" in data


def test_pledge_worker_team_and_accept_with_remaining_workers(client):
    # 1. Test accepting offer with has_remaining_workers checkbox marked
    accept_res = client.post(
        "/api/workers/offers/offer-501/accept",
        json={"has_remaining_workers": True},
        headers={"X-Test-Auth": "1", "X-Test-Role": "worker", "X-Test-User-Id": "worker-1"}
    )
    assert accept_res.status_code == 200
    accept_data = accept_res.get_json()
    assert accept_data["success"] is True
    assert accept_data.get("has_team_pledged") is True

    # 2. Test pledge-team route directly
    pledge_res = client.post(
        "/api/referrals/pledge-team",
        json={"job_id": "job-101", "notes": "I have remaining person for this work"},
        headers={"X-Test-Auth": "1", "X-Test-Role": "worker", "X-Test-User-Id": "worker-1"}
    )
    assert pledge_res.status_code == 200
    pledge_data = pledge_res.get_json()
    assert pledge_data["success"] is True
    assert pledge_data["remaining_count"] >= 1
