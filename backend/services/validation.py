import re
from typing import Tuple, Dict, Any

# Prohibited keywords under legal and anti-exploitation safeguards:
# Prohibits bonded labour, hazardous child labour, human trafficking, illegal servitude, or illicit activities.
PROHIBITED_KEYWORDS = [
    "child", "minor", "underage", "trafficking", "smuggle", "drugs", "narcotics",
    "unpaid", "indentured", "bonded", "forced", "escort", "gambling", "weapon", "explosive"
]

def validate_coordinates(lat: Any, lng: Any) -> Tuple[bool, str]:
    """
    Validates latitude and longitude values.
    Latitude: -90.0 to 90.0
    Longitude: -180.0 to 180.0
    """
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (ValueError, TypeError):
        return False, "Coordinates must be valid numeric floating-point values."

    if not (-90.0 <= lat_f <= 90.0):
        return False, f"Latitude {lat_f} is out of valid range [-90.0, 90.0]."

    if not (-180.0 <= lng_f <= 180.0):
        return False, f"Longitude {lng_f} is out of valid range [-180.0, 180.0]."

    return True, ""

def validate_job_posting(data: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validates job creation payload for legal compliance, minimum wage floors,
    safety keywords, and required operational parameters.
    """
    if not isinstance(data, dict):
        return False, "Invalid payload format. Expected JSON object.", {}

    title = str(data.get("title", "")).strip()
    if not title or len(title) < 3:
        return False, "Job title is required and must be at least 3 characters.", {}

    description = str(data.get("description", "")).strip()
    full_text = f"{title} {description}".lower()

    # Safety & Legal filter check
    for keyword in PROHIBITED_KEYWORDS:
        if re.search(rf"\b{re.escape(keyword)}\b", full_text):
            return False, f"Job posting violates platform safety policy. Prohibited term detected: '{keyword}'", {}

    # Skill validation
    skill = data.get("required_skill") or data.get("skill")
    if not skill or not str(skill).strip():
        return False, "Required skill or trade is mandatory.", {}
    skill = str(skill).strip()

    # Workers needed validation
    try:
        workers_needed = int(data.get("workers_needed") or data.get("workers_required") or 1)
        if workers_needed <= 0 or workers_needed > 50:
            return False, "Number of workers required must be between 1 and 50.", {}
    except (ValueError, TypeError):
        return False, "Workers needed must be an integer.", {}

    # Wage validation
    try:
        wage = float(data.get("wage_per_worker") or data.get("wage") or 0)
        if wage <= 0:
            return False, "Daily wage per worker must be a positive amount.", {}
        # Sanity floor check
        if wage < 300.0:
            return False, "Daily wage offered is below the platform minimum sanity floor of ₹300/day.", {}
    except (ValueError, TypeError):
        return False, "Wage must be a valid numeric value.", {}

    # Location / Address validation
    address = data.get("worksite_address") or data.get("location")
    if not address or not str(address).strip():
        return False, "Worksite address or location description is required.", {}
    address = str(address).strip()

    # Coordinates validation (if provided)
    lat = data.get("latitude") if data.get("latitude") is not None else data.get("lat")
    lng = data.get("longitude") if data.get("longitude") is not None else data.get("lng")

    lat_val = None
    lng_val = None
    if lat is not None and lng is not None:
        valid_coords, coord_err = validate_coordinates(lat, lng)
        if not valid_coords:
            return False, coord_err, {}
        lat_val = float(lat)
        lng_val = float(lng)
    else:
        # Default placeholder coordinates (e.g. Bengaluru Central) if only address is provided
        lat_val = 12.9716
        lng_val = 77.5946

    # Date validation
    job_date = data.get("job_date") or data.get("date")
    if not job_date:
        return False, "Job execution date is required.", {}

    duration_hours = float(data.get("duration_hours", 8))
    start_time = str(data.get("start_time", "09:00"))

    cleaned_data = {
        "title": title,
        "description": description,
        "required_skill": skill,
        "skill": skill,
        "workers_needed": workers_needed,
        "workers_required": workers_needed,
        "wage_per_worker": wage,
        "wage": wage,
        "worksite_address": address,
        "location": address,
        "latitude": lat_val,
        "longitude": lng_val,
        "job_date": str(job_date),
        "date": str(job_date),
        "duration_hours": duration_hours,
        "start_time": start_time,
        "status": "open",
        "confirmed_workers": 0
    }

    return True, "", cleaned_data
