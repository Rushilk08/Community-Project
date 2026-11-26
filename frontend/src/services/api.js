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

  // Combine the caller's cancellation signal with the request timeout.
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else if (signal) {
    signal.addEventListener('abort', abortFromCaller, { once: true });
  }
  const effectiveSignal = controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: defaultHeaders,
      body: data ? JSON.stringify(data) : undefined,
      signal: effectiveSignal
    });

    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);

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
    signal?.removeEventListener('abort', abortFromCaller);

    const backendOnlyEndpoint =
      endpoint.startsWith('/ai/') ||
      endpoint === '/assistant/chat' ||
      endpoint.includes('/requests') ||
      endpoint.includes('worker-requests') ||
      endpoint.startsWith('/worker-requests/');
    if (backendOnlyEndpoint) {
      if (error.name === 'TypeError' || error.message?.includes('Failed to fetch')) {
        throw new Error(
          'This feature requires the WorkLink backend. Start it and configure Gemini for AI features.'
        );
      }
      throw error;
    }

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

  // 3b. Cancel Job
  if (endpoint.match(/\/jobs\/[^/]+\/cancel/) && (method === 'POST' || method === 'PATCH')) {
    const parts = endpoint.split('/');
    const jobId = parts[2];
    const job = mockDb.jobs.find(j => j.id === jobId);
    if (job) job.status = 'cancelled';
    return { success: true, message: 'Job cancelled successfully', status: 'cancelled' };
  }

  // 3c. Get Job Worker Requests
  if (endpoint.match(/\/jobs\/[^/]+\/worker-requests/) && method === 'GET') {
    return { success: true, requests: [] };
  }

  // 3d. Cancel Leave
  if (endpoint.match(/\/leaves\/[^/]+\/cancel/) && (method === 'PATCH' || method === 'POST')) {
    return { success: true, message: 'Leave cancelled successfully', status: 'cancelled' };
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

export async function generateJobDescription({ title, skill, signal }) {
  const result = await request('/ai/job-description', {
    method: 'POST',
    data: { title, skill },
    signal,
    timeoutMs: 30000
  });
  if (typeof result?.description !== 'string' || !result.description.trim()) {
    throw new Error('The AI service did not return a job description.');
  }
  return result;
}

export async function askWorkLinkAssistant(question) {
  const result = await request('/assistant/chat', {
    method: 'POST',
    data: { question },
    timeoutMs: 30000
  });
  if (typeof result?.answer !== 'string' || !result.answer.trim()) {
    throw new Error('The WorkLink assistant did not return an answer.');
  }
  return result;
}

export async function createWorkerRequest(bookingId, requestData) {
  return request(`/bookings/${encodeURIComponent(bookingId)}/requests`, {
    method: 'POST',
    data: requestData
  });
}

export async function getBookingRequests(bookingId) {
  return request(`/bookings/${encodeURIComponent(bookingId)}/requests`, {
    method: 'GET'
  });
}

export async function getJobWorkerRequests(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}/worker-requests`, {
    method: 'GET'
  });
}

export async function resolveWorkerRequest(requestId, decision) {
  return request(`/worker-requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    data: { decision }
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
 * Worker accepts a pending job offer (with optional team pledge or coworker referrals)
 */
export async function acceptOffer(offerId, data = null) {
  return request(`/workers/offers/${offerId}/accept`, {
    method: 'POST',
    data: data || undefined
  });
}

/**
 * Worker marks 'I have remaining person is there for this work'
 */
export async function pledgeWorkerTeam({ job_id, notes = '', remaining_count = null }) {
  return request('/referrals/pledge-team', {
    method: 'POST',
    data: { job_id, notes, remaining_count }
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

// ============================================================================
// 1. WORKER REFERRALS API
// ============================================================================

export async function getAvailableJobsForReferral() {
  return request('/referrals/available-jobs', { method: 'GET' });
}

export async function submitWorkerReferral(referralData) {
  return request('/referrals', {
    method: 'POST',
    data: referralData
  });
}

export async function getMyReferrals() {
  return request('/referrals/my-referrals', { method: 'GET' });
}

export async function getCustomerReferrals() {
  return request('/referrals/customer', { method: 'GET' });
}

export async function resolveReferral(referralId, decision) {
  return request(`/referrals/${referralId}/decision`, {
    method: 'PATCH',
    data: { decision }
  });
}

export async function claimReferralInvite(referralId) {
  return request(`/referrals/invite/${referralId}/claim`, { method: 'POST' });
}

// ============================================================================
// 2. LEAVE MANAGEMENT API
// ============================================================================

export async function applyForLeave(leaveData) {
  return request('/leaves', {
    method: 'POST',
    data: leaveData
  });
}

export async function getMyLeaves() {
  return request('/leaves/my-leaves', { method: 'GET' });
}

export async function getCustomerLeaves() {
  return request('/leaves/customer', { method: 'GET' });
}

export async function resolveLeaveRequest(leaveId, decision, reviewNotes = '') {
  return request(`/leaves/${leaveId}/decision`, {
    method: 'PATCH',
    data: { decision, review_notes: reviewNotes }
  });
}

export async function cancelMyLeave(leaveId) {
  return request(`/leaves/${leaveId}/cancel`, { method: 'PATCH' });
}

// ============================================================================
// 3. JOB CANCELLATION APPROVAL WORKFLOW API
// ============================================================================

export async function requestJobCancellation(cancellationData) {
  return request('/cancellations', {
    method: 'POST',
    data: cancellationData
  });
}

export async function getMyCancellations() {
  return request('/cancellations/my', { method: 'GET' });
}

export async function getCustomerCancellations() {
  return request('/cancellations/customer', { method: 'GET' });
}

export async function resolveCancellationRequest(cancellationId, decision) {
  return request(`/cancellations/${cancellationId}/decision`, {
    method: 'PATCH',
    data: { decision }
  });
}

// ============================================================================
// 4. WORKER RATINGS & REVIEWS API
// ============================================================================

export async function submitWorkerReview(reviewData) {
  return request('/reviews', {
    method: 'POST',
    data: reviewData
  });
}

export async function getWorkerReliability(workerId) {
  return request(`/workers/${workerId}/reliability`, { method: 'GET' });
}

export async function reportWorkerReview(reviewId, reportReason) {
  return request(`/reviews/${reviewId}/report`, {
    method: 'POST',
    data: { report_reason: reportReason }
  });
}

// ============================================================================
// 5. SMART WORKER AVAILABILITY & CALENDAR API
// ============================================================================

export async function getWorkerAvailabilityCalendar(year, month) {
  const query = (year && month) ? `?year=${year}&month=${month}` : '';
  return request(`/workers/availability-calendar${query}`, { method: 'GET' });
}

export async function checkJobAvailabilityConflict(params) {
  return request('/workers/check-conflict', {
    method: 'POST',
    data: params
  });
}

// ============================================================================
// 6. EMERGENCY WORKER REPLACEMENT API
// ============================================================================

export async function createReplacementRequest(replacementData) {
  return request('/replacements', {
    method: 'POST',
    data: replacementData
  });
}

export async function getReplacementCandidates({ skill = '', date = '', startTime = '09:00', duration = 8, job_id = '' } = {}) {
  const params = {
    skill,
    date,
    start_time: startTime,
    duration: String(duration)
  };
  if (job_id) params.job_id = job_id;
  const q = new URLSearchParams(params).toString();
  return request(`/replacements/candidates?${q}`, { method: 'GET' });
}

export async function sendReplacementInvitations(replacementId, workerIds) {
  return request(`/replacements/${replacementId}/invite`, {
    method: 'POST',
    data: { worker_ids: workerIds }
  });
}

export async function getWorkerReplacementInvitations() {
  return request('/replacements/worker-invitations', { method: 'GET' });
}

export async function respondReplacementInvitation(invitationId, decision) {
  return request(`/replacements/invitations/${invitationId}/respond`, {
    method: 'POST',
    data: { decision }
  });
}

export async function confirmReplacementSelection(replacementId, workerId) {
  return request(`/replacements/${replacementId}/confirm`, {
    method: 'POST',
    data: { worker_id: workerId }
  });
}

// ============================================================================
// 7. INTEGRATED NOTIFICATIONS API
// ============================================================================

export async function getNotifications(unreadOnly = false) {
  const q = unreadOnly ? '?unread_only=true' : '';
  return request(`/notifications${q}`, { method: 'GET' });
}

export async function markNotificationAsRead(notificationId) {
  return request(`/notifications/${notificationId}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsAsRead() {
  return request('/notifications/mark-all-read', { method: 'POST' });
}

export default {
  request,
  createJob,
  generateJobDescription,
  askWorkLinkAssistant,
  createWorkerRequest,
  getBookingRequests,
  getJobWorkerRequests,
  resolveWorkerRequest,
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
  createWorkerGroup,
  getAvailableJobsForReferral,
  submitWorkerReferral,
  pledgeWorkerTeam,
  getMyReferrals,
  getCustomerReferrals,
  resolveReferral,
  claimReferralInvite,
  applyForLeave,
  getMyLeaves,
  getCustomerLeaves,
  resolveLeaveRequest,
  cancelMyLeave,
  requestJobCancellation,
  getMyCancellations,
  getCustomerCancellations,
  resolveCancellationRequest,
  submitWorkerReview,
  getWorkerReliability,
  reportWorkerReview,
  getWorkerAvailabilityCalendar,
  checkJobAvailabilityConflict,
  createReplacementRequest,
  getReplacementCandidates,
  sendReplacementInvitations,
  getWorkerReplacementInvitations,
  respondReplacementInvitation,
  confirmReplacementSelection,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};
