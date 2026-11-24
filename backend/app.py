from flask import Flask, jsonify
from flask_cors import CORS
from config import Config

# Import route blueprints
from routes.jobs import jobs_bp
from routes.workers import workers_bp
from routes.offers import offers_bp
from routes.bookings import bookings_bp
from routes.groups import groups_bp
from routes.reports import reports_bp
from routes.ai import ai_bp
from routes.worker_requests import worker_requests_bp
from services.dispatch import expire_stale_offers_sweep

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable CORS for frontend integration (React Vite default port: 5173, etc.)
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Register Blueprints under /api prefix
    app.register_blueprint(jobs_bp, url_prefix="/api")
    app.register_blueprint(workers_bp, url_prefix="/api")
    app.register_blueprint(offers_bp, url_prefix="/api")
    app.register_blueprint(bookings_bp, url_prefix="/api")
    app.register_blueprint(groups_bp, url_prefix="/api")
    app.register_blueprint(reports_bp, url_prefix="/api")
    app.register_blueprint(ai_bp, url_prefix="/api")
    app.register_blueprint(worker_requests_bp, url_prefix="/api")

    # Periodic background sweep helper endpoint (can be called by cron or during polling)
    @app.route("/api/dispatch/sweep", methods=["POST", "GET"])
    def sweep_expired():
        expired_count = expire_stale_offers_sweep()
        return jsonify({
            "success": True,
            "message": f"Swept and expired {expired_count} stale offers.",
            "data": {"expired_offers": expired_count}
        }), 200

    # API Health and Connectivity check
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "success": True,
            "message": "Worklink Backend API is operational",
            "data": {
                "status": "healthy",
                "supabase_configured": Config.is_supabase_configured(),
                "service": "worklink-backend",
                "version": "1.0.0"
            }
        }), 200

    # Centralized 404 handler with language-neutral code
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "success": False,
            "message": "Endpoint not found",
            "error_code": "NOT_FOUND"
        }), 404

    # Centralized 500 handler with language-neutral code
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({
            "success": False,
            "message": "An internal server error occurred",
            "error_code": "INTERNAL_SERVER_ERROR"
        }), 500

    return app

if __name__ == "__main__":
    app = create_app()
    print(f"[*] Starting Worklink Backend on port {Config.PORT}...")
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
