import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = os.getenv("FLASK_ENV", "development").lower() == "development"
    SECRET_KEY = os.getenv("SECRET_KEY", "worklink-hackathon-insecure-secret-key")

    # Supabase Configuration
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # Matching & Legal Dispatch Parameters
    DEFAULT_DISPATCH_RADIUS_KM = float(os.getenv("DISPATCH_RADIUS_KM", 10.0))
    OFFER_EXPIRY_MINUTES = int(os.getenv("OFFER_EXPIRY_MINUTES", 5))
    LOCATION_STALE_HOURS = int(os.getenv("LOCATION_STALE_HOURS", 24))

    # Minimum wage sanity floor (indicative floor for Bengaluru unorganized labor hackathon safeguard)
    MINIMUM_DAILY_WAGE_FLOOR = 350.0

    @classmethod
    def is_supabase_configured(cls) -> bool:
        return bool(
            cls.SUPABASE_URL and 
            cls.SUPABASE_ANON_KEY and 
            not cls.SUPABASE_URL.startswith("https://your-project-id")
        )
