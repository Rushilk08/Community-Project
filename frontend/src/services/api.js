import { supabase, API_URL, isSupabaseConfigured } from './supabase.js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const ENABLE_MOCKS = env.VITE_ENABLE_MOCKS === 'true';

// Helper to retrieve the current session token
async function getAuthToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (err) {
    console.warn('[WorkLink API] Failed to fetch auth session token:', err);
    return null;
  }
}

// In-memory mock storage for local testing when backend is not running
const mockDb = {
  jobs: [
    {
      id: 'job-101',
      title: 'Masonry and Bricklaying',
      description: 'Wall construction and brick laying for residential building',
      skill: 'Mason',
      wage: 950,
      workers_required: 3,
      confirmed_workers: 1,
      pending_requests: 2,
      status: 'in_progress',
      location: 'Indiranagar, Bengaluru',
      date: '2026-11-23'
    }
  ],
  offers: [
    {
      id: 'offer-501',
      job_id: 'job-101',
      title: 'Masonry Work Needed',
      description: 'Require skilled mason for 1 day brick laying',
      skill: 'Mason',
      wage: 950,
      location: 'Indiranagar, Bengaluru (2.3 km away)',
      distance_km: 2.3,
      date: '2026-11-23',
      workers_needed: 3,
      created_at: new Date().toISOString()
    }
  ],
  bookings: [
    {
      id: 'booking-201',
      job_id: 'job-099',
      customer_name: 'Rajesh Sharma',
      customer_phone: '+91 98765 43210',
      title: 'Painting & Plastering',
      wage: 850,
      status: 'confirmed',
      location: 'Koramangala, Bengaluru',
      date: '2026-11-22'
    }
  ],
  availability: true,
  workerLocation: { lat: 12.9716, lng: 77.5946 }
};

/**
 * Generic fetch wrapper with timeout, token attachment, and centralized error handling
 */
export async function request(endpoint, {
  method = 'GET',
  data = null,
  headers = {},
  signal = null,
  timeoutMs = 10000
} = {}) {
  const token = await getAuthToken();

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers
  };

  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Build timeout signal if none provided
  const controller = new AbortController();
  const effectiveSignal = signal || controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: defaultHeaders,
      body: data ? JSON.stringify(data) : undefined,
      signal: effectiveSignal
    });

    clearTimeout(timeoutId);

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const result = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMessage = (typeof result === 'object' && result?.message) 
        ? result.message 
        : `Request failed with status ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = result;
      throw error;
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    // If mocks enabled or network error, execute mock fallback gracefully
    if (ENABLE_MOCKS || error.name === 'TypeError' || error.message?.includes('Failed to fetch')) {
      console.info(`[WorkLink API Mock Fallback] ${method} ${endpoint}:`, error.message);
      return handleMockFallback(endpoint, method, data);
    }

    throw error;
  }
}

/**
 * Temporary mock adapter to allow frontend testing before Member 1 finishes backend
 */
function handleMockFallback(endpoint, method, data) {
  // 1. Create Job
  if (endpoint === '/jobs' && method === 'POST') {
    const newJob = {
      id: `job-${Date.now()}`,
      ...data,
      confirmed_workers: 0,
      pending_requests: data.workers_required || 1,
      status: 'open',
      created_at: new Date().toISOString()
    };
    mockDb.jobs.push(newJob);
    return { success: true, job: newJob };
  }

  // 2. Get My Jobs (Customer)
  if (endpoint.startsWith('/jobs/my-jobs') && method === 'GET') {
    return { success: true, jobs: [...mockDb.jobs] };
  }

  // 3. Get Job Status (Customer polling)
  if (endpoint.match(/\/jobs\/[^/]+\/status/) && method === 'GET') {
    const parts = endpoint.split('/');
    const jobId = parts[2];
    const job = mockDb.jobs.find(j => j.id === jobId) || mockDb.jobs[0] || {
      id: jobId,
      confirmed_workers: 1,
      pending_requests: 1,
      workers_required: 2,
      status: 'in_progress'
    };

    return {
      success: true,
      job_id: job.id,
      status: job.status,
      confirmed_workers: job.confirmed_workers,
      pending_requests: job.pending_requests,
      workers_required: job.workers_required,
      accepted_workers: (mockDb.bookings && mockDb.bookings.length > 0)
        ? mockDb.bookings.map(b => ({
            id: b.id,
            name: b.worker_name || 'Rushil',
            phone: b.worker_phone || '7456123689',
            skill: b.skill || 'General Labour',
            agreed_wage: b.wage || 850,
            is_new: true,
            rating: 5.0,
            reviews_count: 0,
            experience_years: 0,
            punctuality: '100%',
            completed_jobs: 0
          }))
        : [],
      updated_at: new Date().toISOString()
    };
  }

  // 4. Update Worker Availability
  if (endpoint === '/workers/availability' && (method === 'PATCH' || method === 'POST')) {
    mockDb.availability = data?.is_available ?? true;
    return { success: true, is_available: mockDb.availability };
  }

  // 5. Update Worker Location
  if (endpoint === '/workers/location' && (method === 'PATCH' || method === 'POST')) {
    mockDb.workerLocation = data;
    return { success: true, location: data };
  }

  // 6. Get Worker Offers (Worker polling)
  if (endpoint.startsWith('/workers/offers') && method === 'GET') {
    return {
      success: true,
      offers: [...mockDb.offers]
    };
  }

  // 7. Accept Offer
  if (endpoint.match(/\/workers\/offers\/[^/]+\/accept/) && method === 'POST') {
    const parts = endpoint.split('/');
    const offerId = parts[3];
    const accepted = mockDb.offers.find(o => o.id === offerId);
    mockDb.offers = mockDb.offers.filter(o => o.id !== offerId);
    return {
      success: true,
      message: 'Offer accepted successfully',
      booking: {
        id: `booking-${Date.now()}`,
        job_id: accepted?.job_id || 'job-101',
        title: accepted?.title || 'Masonry Work',
        wage: accepted?.wage || 950,
        location: accepted?.location || 'Indiranagar, Bengaluru',
        customer_name: 'Ramesh Patel',
        customer_phone: '+91 98860 12345',
        status: 'confirmed'
      }
    };
  }

  // 8. Reject Offer
  if (endpoint.match(/\/workers\/offers\/[^/]+\/reject/) && method === 'POST') {
    const parts = endpoint.split('/');
    const offerId = parts[3];
    mockDb.offers = mockDb.offers.filter(o => o.id !== offerId);
    return { success: true, message: 'Offer rejected' };
  }

  // 9. Get Worker Bookings
  if (endpoint === '/workers/bookings' && method === 'GET') {
    return { success: true, bookings: [...mockDb.bookings] };
  }

  // 10. Get Booking Details
  if (endpoint.match(/\/bookings\/[^/]+/) && method === 'GET') {
    return {
      success: true,
      booking: mockDb.bookings[0] || {
        id: 'booking-201',
        title: 'Painting & Plastering',
        wage: 850,
        status: 'confirmed',
        location: 'Koramangala, Bengaluru',
        customer_name: 'Rajesh Sharma',
        customer_phone: '+91 98765 43210'
      }
    };
  }

  // 11. Create Worker Group
  if (endpoint === '/workers/groups' && method === 'POST') {
    return {
      success: true,
      message: 'Worker group created successfully',
      group: { id: `grp-${Date.now()}`, ...data }
    };
  }

  // Default fallback
  return { success: true, message: 'Mock response executed' };
}

/* =========================================================================
   EXPORTED API FUNCTIONS (Required Contract for Member 1's Flask backend)
   ========================================================================= */

/**
 * Customer creates a new job request
 */
export async function createJob(jobData) {
  return request('/jobs', {
    method: 'POST',
    data: jobData
  });
}

/**
 * Customer fetches their posted jobs
 */
export async function getMyJobs() {
  return request('/jobs/my-jobs', {
    method: 'GET'
  });
}

/**
 * Customer polls hiring progress for a job
 */
export async function getJobStatus(jobId, { signal } = {}) {
  return request(`/jobs/${jobId}/status`, {
    method: 'GET',
    signal
  });
}

/**
 * Customer cancels an active job posting
 */
export async function cancelJob(jobId) {
  return request(`/jobs/${jobId}/cancel`, {
    method: 'POST'
  });
}

/**
 * Worker toggles their availability (ON/OFF)
 */
export async function updateWorkerAvailability(isAvailable) {
  return request('/workers/availability', {
    method: 'PATCH',
    data: { is_available: isAvailable }
  });
}

/**
 * Worker updates real-time GPS location
 */
export async function updateWorkerLocation(coords) {
  return request('/workers/location', {
    method: 'PATCH',
    data: coords
  });
}

/**
 * Worker polls nearby pending job offers
 */
export async function getWorkerOffers({ signal } = {}) {
  return request('/workers/offers', {
    method: 'GET',
    signal
  });
}

/**
 * Worker accepts a pending job offer
 */
export async function acceptOffer(offerId) {
  return request(`/workers/offers/${offerId}/accept`, {
    method: 'POST'
  });
}

/**
 * Worker rejects a pending job offer
 */
export async function rejectOffer(offerId, reason = '') {
  return request(`/workers/offers/${offerId}/reject`, {
    method: 'POST',
    data: { reason }
  });
}

/**
 * Worker gets their accepted jobs/bookings
 */
export async function getWorkerBookings() {
  return request('/workers/bookings', {
    method: 'GET'
  });
}

/**
 * Retrieve specific booking details including navigation details
 */
export async function getBookingDetails(bookingId) {
  return request(`/bookings/${bookingId}`, {
    method: 'GET'
  });
}

/**
 * Create a family or group worker profile
 */
export async function createWorkerGroup(groupData) {
  return request('/workers/groups', {
    method: 'POST',
    data: groupData
  });
}

export default {
  request,
  createJob,
  getMyJobs,
  getJobStatus,
  cancelJob,
  updateWorkerAvailability,
  updateWorkerLocation,
  getWorkerOffers,
  acceptOffer,
  rejectOffer,
  getWorkerBookings,
  getBookingDetails,
  createWorkerGroup
};
