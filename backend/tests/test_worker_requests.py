import os
import sys
from types import SimpleNamespace

import pytest
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from config import Config


class _FakeQuery:
    def __init__(self, record, table_name):
        self.record = record
        self.table_name = table_name
        self.filters = {}
        self.selected_fields = ()
        self.update_values = None

    def select(self, *fields):
        self.selected_fields = fields
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def maybe_single(self):
        return self

    def update(self, values):
        self.update_values = values
        return self

    def execute(self):
        if any(self.record.get(key) != value for key, value in self.filters.items()):
            return SimpleNamespace(data=None if self.update_values is None else [])
        if self.update_values is not None:
            self.record.update(self.update_values)
            return SimpleNamespace(data=[dict(self.record)])
        return SimpleNamespace(data=dict(self.record))


class _FakeClient:
    def __init__(self, record):
        self.record = record

    def table(self, table_name):
        return _FakeQuery(self.record, table_name)


def _client():
    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def _test_headers(role):
    return {
        "X-Test-Auth": "true",
        "X-Test-Role": role,
        "X-Test-User-Id": f"{role}-1"
    }


def test_worker_request_rejects_unknown_type_before_database_access(monkeypatch):
    monkeypatch.setattr(Config, "is_supabase_configured", lambda: False)
    response = _client().post(
        "/api/bookings/booking-1/requests",
        headers=_test_headers("worker"),
        json={"request_type": "change_booking", "reason": "Need a schedule change."}
    )
    assert response.status_code == 400
    assert response.get_json()["error_code"] == "VALIDATION_ERROR"


def test_overtime_request_requires_positive_amount(monkeypatch):
    monkeypatch.setattr(Config, "is_supabase_configured", lambda: False)
    response = _client().post(
        "/api/bookings/booking-1/requests",
        headers=_test_headers("worker"),
        json={
            "request_type": "overtime_pay",
            "requested_extra_pay": 0,
            "reason": "Worked extra hours."
        }
    )
    assert response.status_code == 400
    assert response.get_json()["error_code"] == "VALIDATION_ERROR"


def test_leave_request_does_not_accept_an_overtime_amount(monkeypatch):
    monkeypatch.setattr(Config, "is_supabase_configured", lambda: False)
    response = _client().post(
        "/api/bookings/booking-1/requests",
        headers=_test_headers("worker"),
        json={
            "request_type": "leave",
            "requested_extra_pay": 200,
            "reason": "I need leave for this job."
        }
    )
    assert response.status_code == 400
    assert response.get_json()["error_code"] == "VALIDATION_ERROR"


def test_worker_cannot_resolve_a_request():
    response = _client().patch(
        "/api/worker-requests/request-1",
        headers=_test_headers("worker"),
        json={"decision": "approve"}
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    ("decision", "expected_status"),
    [("approve", "approved"), ("decline", "declined")]
)
def test_customer_decision_resolves_pending_request(
    monkeypatch, decision, expected_status
):
    record = {
        "id": "request-1",
        "customer_id": "customer-1",
        "status": "pending"
    }
    monkeypatch.setattr(Config, "is_supabase_configured", lambda: True)
    monkeypatch.setattr(
        "routes.worker_requests.get_service_client",
        lambda: _FakeClient(record)
    )

    response = _client().patch(
        "/api/worker-requests/request-1",
        headers=_test_headers("customer"),
        json={"decision": decision}
    )
    assert response.status_code == 200
    assert response.get_json()["request"]["status"] == expected_status
    assert record["resolved_at"]


def test_customer_cannot_resolve_request_twice(monkeypatch):
    record = {
        "id": "request-1",
        "customer_id": "customer-1",
        "status": "approved"
    }
    monkeypatch.setattr(Config, "is_supabase_configured", lambda: True)
    monkeypatch.setattr(
        "routes.worker_requests.get_service_client",
        lambda: _FakeClient(record)
    )

    response = _client().patch(
        "/api/worker-requests/request-1",
        headers=_test_headers("customer"),
        json={"decision": "decline"}
    )
    assert response.status_code == 409
    assert record["status"] == "approved"
