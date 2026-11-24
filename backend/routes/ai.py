from threading import Lock
from time import monotonic

from flask import Blueprint, jsonify, request
from services.ai import (
    AIConfigurationError,
    AIServiceError,
    answer_website_question,
    generate_job_description
)
from services.auth import require_auth

ai_bp = Blueprint("ai", __name__)
_AI_RATE_WINDOW_SECONDS = 60
_AI_RATE_LIMIT = 20
_ai_request_times: dict[str, list[float]] = {}
_ai_request_lock = Lock()


def _is_rate_limited(client_ip: str) -> bool:
    now = monotonic()
    with _ai_request_lock:
        for tracked_ip, timestamps in list(_ai_request_times.items()):
            recent_timestamps = [
                timestamp
                for timestamp in timestamps
                if now - timestamp < _AI_RATE_WINDOW_SECONDS
            ]
            if recent_timestamps:
                _ai_request_times[tracked_ip] = recent_timestamps
            else:
                del _ai_request_times[tracked_ip]

        recent_requests = list(_ai_request_times.get(client_ip, []))
        if len(recent_requests) >= _AI_RATE_LIMIT:
            _ai_request_times[client_ip] = recent_requests
            return True
        recent_requests.append(now)
        _ai_request_times[client_ip] = recent_requests
    return False


def _rate_limit_response():
    if _is_rate_limited(request.remote_addr or "unknown"):
        return jsonify({
            "success": False,
            "message": "AI request limit reached. Please wait a minute and try again.",
            "error_code": "RATE_LIMITED"
        }), 429
    return None


@ai_bp.route("/ai/job-description", methods=["POST"])
@require_auth(allowed_roles=["customer"])
def create_job_description():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({
            "success": False,
            "message": "A JSON object with a job title and trade is required.",
            "error_code": "VALIDATION_ERROR"
        }), 400

    title = str(payload.get("title") or "").strip()
    skill = str(payload.get("skill") or "").strip()
    if not title or len(title) < 3 or len(title) > 160:
        return jsonify({
            "success": False,
            "message": "Job title must contain between 3 and 160 characters.",
            "error_code": "VALIDATION_ERROR"
        }), 400
    if not skill or len(skill) > 100:
        return jsonify({
            "success": False,
            "message": "Select a trade or skill before generating a description.",
            "error_code": "VALIDATION_ERROR"
        }), 400

    rate_limit_response = _rate_limit_response()
    if rate_limit_response:
        return rate_limit_response

    try:
        description = generate_job_description(title, skill)
    except AIConfigurationError as error:
        return jsonify({
            "success": False,
            "message": str(error),
            "error_code": "AI_NOT_CONFIGURED"
        }), 503
    except AIServiceError as error:
        return jsonify({
            "success": False,
            "message": str(error),
            "error_code": "AI_SERVICE_ERROR"
        }), 502

    return jsonify({"success": True, "description": description}), 200


@ai_bp.route("/assistant/chat", methods=["POST"])
def ask_website_assistant():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({
            "success": False,
            "message": "A JSON object with a question is required.",
            "error_code": "VALIDATION_ERROR"
        }), 400

    question = str(payload.get("question") or "").strip()
    if not question or len(question) > 700:
        return jsonify({
            "success": False,
            "message": "Question must contain between 1 and 700 characters.",
            "error_code": "VALIDATION_ERROR"
        }), 400

    rate_limit_response = _rate_limit_response()
    if rate_limit_response:
        return rate_limit_response

    try:
        answer, sources = answer_website_question(question)
    except AIConfigurationError as error:
        return jsonify({
            "success": False,
            "message": str(error),
            "error_code": "AI_NOT_CONFIGURED"
        }), 503
    except AIServiceError as error:
        return jsonify({
            "success": False,
            "message": str(error),
            "error_code": "AI_SERVICE_ERROR"
        }), 502

    return jsonify({"success": True, "answer": answer, "sources": sources}), 200
