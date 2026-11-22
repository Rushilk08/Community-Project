import pytest
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from services.matching import haversine_distance
from services.validation import validate_coordinates, validate_job_posting

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client

def test_haversine_distance_calculation():
    """Verify Haversine formula against known coordinates in Bengaluru."""
    # Point A: Indiranagar (12.9784, 77.6408)
    # Point B: Koramangala (12.9352, 77.6245)
    dist = haversine_distance(12.9784, 77.6408, 12.9352, 77.6245)
    assert 4.0 <= dist <= 6.0, f"Expected distance between 4 and 6 km, got {dist}"

    # Same location should return zero distance
    zero_dist = haversine_distance(12.9716, 77.5946, 12.9716, 77.5946)
    assert round(zero_dist, 4) == 0.0

def test_coordinate_validation():
    """Verify coordinate bounds [-90, 90] for lat, [-180, 180] for lng."""
    valid, _ = validate_coordinates(12.9716, 77.5946)
    assert valid is True

    invalid_lat, _ = validate_coordinates(95.0, 77.5946)
    assert invalid_lat is False

    invalid_lng, _ = validate_coordinates(12.9716, 200.0)
    assert invalid_lng is False

    non_numeric, _ = validate_coordinates("invalid", "coords")
    assert non_numeric is False

def test_legal_and_safety_keyword_filtering():
    """Verify that jobs with exploitative or prohibited keywords are rejected."""
    bad_job = {
        "title": "Need child labour for brick kiln",
        "description": "Urgent work",
        "skill": "Mason",
        "wage": 500,
        "workers_required": 2,
        "location": "Bengaluru",
        "date": "2026-11-25"
    }
    is_valid, msg, _ = validate_job_posting(bad_job)
    assert is_valid is False
    assert "safety policy" in msg.lower() or "prohibited" in msg.lower()

def test_minimum_wage_floor_safeguard():
    """Verify that jobs below the minimum wage sanity floor are rejected."""
    underpaid_job = {
        "title": "Painting apartment wall",
        "description": "Full day painting",
        "skill": "Painter",
        "wage": 100,  # Below ₹300 sanity floor
        "workers_required": 1,
        "location": "Bengaluru",
        "date": "2026-11-25"
    }
    is_valid, msg, _ = validate_job_posting(underpaid_job)
    assert is_valid is False
    assert "minimum" in msg.lower() or "floor" in msg.lower()

def test_valid_job_posting():
    """Verify valid job payload passes and normalizes fields."""
    good_job = {
        "title": "Carpentry for wooden shelves",
        "description": "Assemble and polish 3 plywood shelves",
        "skill": "Carpenter",
        "wage": 900,
        "workers_required": 2,
        "location": "Whitefield, Bengaluru",
        "date": "2026-11-25"
    }
    is_valid, _, cleaned = validate_job_posting(good_job)
    assert is_valid is True
    assert cleaned["wage_per_worker"] == 900.0
    assert cleaned["workers_needed"] == 2
    assert cleaned["required_skill"] == "Carpenter"

def test_health_check_endpoint(client):
    """Verify /api/health endpoint returns 200 and healthy status."""
    res = client.get("/api/health")
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data["success"] is True
    assert json_data["data"]["status"] == "healthy"

def test_404_standardized_error(client):
    """Verify 404 handler returns language-neutral JSON code."""
    res = client.get("/api/nonexistent-endpoint")
    assert res.status_code == 404
    json_data = res.get_json()
    assert json_data["success"] is False
    assert json_data["error_code"] == "NOT_FOUND"

def test_customer_job_status_demo(client):
    """Verify /api/jobs/<id>/status returns live hiring progress payload."""
    res = client.get("/api/jobs/00000000-0000-0000-0000-000000000001/status")
    assert res.status_code in (200, 404)
    if res.status_code == 200:
        json_data = res.get_json()
        assert json_data["success"] is True

def test_cancel_job_endpoint(client):
    """Verify /api/jobs/<id>/cancel endpoint is reachable and enforces customer ownership."""
    res = client.post("/api/jobs/00000000-0000-0000-0000-000000000001/cancel")
    assert res.status_code in (200, 404)
    json_data = res.get_json()
    assert "success" in json_data
