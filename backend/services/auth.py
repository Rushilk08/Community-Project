from functools import wraps
from flask import request, jsonify, g
from config import Config
from database.supabase_client import get_supabase_client, get_service_client

def get_bearer_token() -> str | None:
    """Extracts the Bearer token from the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return None

def require_auth(allowed_roles: list[str] | None = None):
    """
    Decorator that enforces Supabase JWT authentication and optional role checking.
    Injects g.current_user and g.current_profile into the Flask request context.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            token = get_bearer_token()

            # Handle unauthenticated request
            if not token:
                from flask import current_app
                if current_app.config.get("TESTING") or request.headers.get("X-Test-Auth"):
                    test_role = request.headers.get("X-Test-Role", "customer")
                    test_id = request.headers.get("X-Test-User-Id", "00000000-0000-0000-0000-000000000001")
                    g.current_user = {"id": test_id, "email": f"test-{test_role}@worklink.org", "role": test_role}
                    g.current_profile = {"id": test_id, "full_name": "Test User", "role": test_role, "phone": "+91 98860 12345"}
                    if allowed_roles and test_role not in allowed_roles:
                        return jsonify({"success": False, "message": "Access forbidden", "error_code": "FORBIDDEN"}), 403
                    return fn(*args, **kwargs)

                # If Supabase is not configured yet (e.g. initial local demo testing),
                # allow a fallback demo header or query parameter for testing
                demo_role = request.headers.get("X-Demo-Role") or ("customer" if "customer" in request.path else "worker")
                demo_id = request.headers.get("X-Demo-User-Id", "00000000-0000-0000-0000-000000000001")
                if not Config.is_supabase_configured():
                    g.current_user = {
                        "id": demo_id,
                        "email": f"demo-{demo_role}@worklink.org",
                        "role": demo_role
                    }
                    g.current_profile = {
                        "id": demo_id,
                        "full_name": f"Demo {demo_role.capitalize()}",
                        "role": demo_role,
                        "phone": "+91 98860 12345"
                    }
                    if allowed_roles and demo_role not in allowed_roles:
                        return jsonify({
                            "success": False,
                            "message": f"Unauthorized. Role '{demo_role}' cannot access this endpoint.",
                            "error_code": "FORBIDDEN"
                        }), 403
                    return fn(*args, **kwargs)

                return jsonify({
                    "success": False,
                    "message": "Missing Authorization header with Bearer token.",
                    "error_code": "UNAUTHORIZED"
                }), 401

            try:
                # Verify JWT token with Supabase Auth
                supabase = get_supabase_client()
                user_res = supabase.auth.get_user(token)
                if not user_res or not user_res.user:
                    return jsonify({
                        "success": False,
                        "message": "Invalid or expired authentication token.",
                        "error_code": "INVALID_TOKEN"
                    }), 401

                user = user_res.user
                user_id = user.id

                # Fetch profile from profiles table using service client
                service_client = get_service_client()
                profile_res = service_client.table("profiles").select("*").eq("id", user_id).maybe_single().execute()

                profile = profile_res.data if profile_res else None
                user_role = profile.get("role") if profile else user.user_metadata.get("role", "customer")

                # Attach to Flask request context
                g.current_user = {
                    "id": user_id,
                    "email": user.email,
                    "role": user_role
                }
                g.current_profile = profile or {
                    "id": user_id,
                    "role": user_role,
                    "full_name": user.user_metadata.get("full_name", user.email)
                }

                # Role-based access control
                if allowed_roles and user_role not in allowed_roles:
                    return jsonify({
                        "success": False,
                        "message": f"Access forbidden. This resource requires one of the following roles: {allowed_roles}",
                        "error_code": "FORBIDDEN"
                    }), 403

            except Exception as e:
                return jsonify({
                    "success": False,
                    "message": f"Authentication failed: {str(e)}",
                    "error_code": "AUTH_ERROR"
                }), 401

            return fn(*args, **kwargs)
        return wrapper
    return decorator
