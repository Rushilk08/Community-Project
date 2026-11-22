from supabase import create_client, Client
from config import Config

_anon_client: Client | None = None
_service_client: Client | None = None

def get_supabase_client() -> Client:
    """Returns the standard Supabase client with public anon key."""
    global _anon_client
    if _anon_client is None:
        if not Config.is_supabase_configured():
            raise RuntimeError(
                "Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your backend/.env file."
            )
        _anon_client = create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)
    return _anon_client

def get_service_client() -> Client:
    """
    Returns the Supabase client initialized with the Service Role key.
    Used for backend-only atomic tasks, background matching, and audit logging.
    NEVER expose this key to client-side applications.
    """
    global _service_client
    if _service_client is None:
        key = Config.SUPABASE_SERVICE_ROLE_KEY or Config.SUPABASE_ANON_KEY
        if not Config.SUPABASE_URL or not key:
            raise RuntimeError(
                "Supabase credentials missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env"
            )
        _service_client = create_client(Config.SUPABASE_URL, key)
    return _service_client

def get_user_client(access_token: str) -> Client:
    """
    Returns a client scoped with the user's JWT access token for RLS enforcement.
    """
    if not Config.is_supabase_configured():
        raise RuntimeError("Supabase is not configured.")
    client = create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)
    client.postgrest.auth(access_token)
    return client
