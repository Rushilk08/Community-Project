import json
import os
import sys
from unittest.mock import Mock

import pytest
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from config import Config
from routes.ai import _is_rate_limited
from services.ai import AIServiceError, answer_website_question, generate_job_description


def _client():
    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def _test_headers(role="customer"):
    return {"X-Test-Auth": "true", "X-Test-Role": role}


def test_job_description_requires_customer_role():
    response = _client().post(
        "/api/ai/job-description",
        headers=_test_headers("worker"),
        json={"title": "Paint a room", "skill": "Painter"}
    )
    assert response.status_code == 403


def test_job_description_rejects_missing_title():
    response = _client().post(
        "/api/ai/job-description",
        headers=_test_headers(),
        json={"title": "", "skill": "Painter"}
    )
    assert response.status_code == 400
    assert response.get_json()["error_code"] == "VALIDATION_ERROR"


def test_job_description_reports_missing_gemini_configuration(monkeypatch):
    monkeypatch.setattr(Config, "GEMINI_API_KEY", "")
    response = _client().post(
        "/api/ai/job-description",
        headers=_test_headers(),
        json={"title": "Paint a room", "skill": "Painter"}
    )
    assert response.status_code == 503
    assert response.get_json()["error_code"] == "AI_NOT_CONFIGURED"


def test_unknown_assistant_question_uses_grounded_fallback(monkeypatch):
    monkeypatch.setattr(Config, "GEMINI_API_KEY", "")
    answer, sources = answer_website_question("What is the weather tomorrow?")
    assert "couldn't find" in answer.lower()
    assert sources == []


def test_unknown_assistant_question_does_not_require_gemini(monkeypatch):
    monkeypatch.setattr(Config, "GEMINI_API_KEY", "")
    response = _client().post(
        "/api/assistant/chat",
        json={"question": "What is the weather tomorrow?"}
    )
    assert response.status_code == 200
    assert response.get_json()["sources"] == []


def test_assistant_returns_only_valid_source_citations(monkeypatch):
    monkeypatch.setattr(Config, "GEMINI_API_KEY", "test-key")
    mock_generate = Mock(return_value=json.dumps({
            "answer": "Customers can create a job request from the Post Job page.",
            "source_ids": ["posting-jobs", "not-a-worklink-source"]
        }))
    monkeypatch.setattr("services.ai._generate_content", mock_generate)

    answer, sources = answer_website_question("How do I post a job?")
    assert "Post Job" in answer
    assert [source["id"] for source in sources] == ["posting-jobs"]
    mock_generate.assert_called_once()


def test_generated_description_rejects_prohibited_content(monkeypatch):
    monkeypatch.setattr(Config, "GEMINI_API_KEY", "test-key")

    class FakeResponse:
        status_code = 200
        ok = True

        @staticmethod
        def json():
            return {
                "candidates": [{
                    "content": {"parts": [{"text": "Hire child workers for construction."}]}
                }]
            }

    mock_post = Mock(return_value=FakeResponse())
    monkeypatch.setattr("services.ai.requests.post", mock_post)
    with pytest.raises(AIServiceError, match="safety checks"):
        generate_job_description("Construction work", "Mason")
    mock_post.assert_called_once()


def test_ai_rate_limit_resets_after_its_window(monkeypatch):
    monkeypatch.setattr("routes.ai.monotonic", Mock(return_value=100))
    client_ip = "ai-rate-limit-test"
    assert all(not _is_rate_limited(client_ip) for _ in range(20))
    assert _is_rate_limited(client_ip)

    monkeypatch.setattr("routes.ai.monotonic", Mock(return_value=161))
    assert not _is_rate_limited(client_ip)
