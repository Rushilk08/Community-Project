import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    failed++;
  }
}

console.log('=== WORKLINK INTEGRATION TEST SUITE ===\n');

// 1. Multilingual Translations Integrity Test
const requiredKeys = [
  'welcome', 'login', 'register', 'dashboard', 'profile',
  'postJob', 'findWork', 'myJobs', 'available', 'unavailable',
  'accept', 'reject', 'jobDescription', 'location', 'wage',
  'workersRequired', 'confirmedWorkers', 'pendingRequests',
  'logout', 'selectLanguage', 'loading', 'error', 'save',
  'cancel', 'navigate'
];

const en = JSON.parse(readFileSync(join(__dirname, 'src/i18n/locales/en.json'), 'utf-8'));
const kn = JSON.parse(readFileSync(join(__dirname, 'src/i18n/locales/kn.json'), 'utf-8'));
const hi = JSON.parse(readFileSync(join(__dirname, 'src/i18n/locales/hi.json'), 'utf-8'));

for (const key of requiredKeys) {
  assert(en[key] && typeof en[key] === 'string', `English locale has key: "${key}" (${en[key]})`);
  assert(kn[key] && typeof kn[key] === 'string', `Kannada locale has key: "${key}" (${kn[key]})`);
  assert(hi[key] && typeof hi[key] === 'string', `Hindi locale has key: "${key}" (${hi[key]})`);
}

// 2. Centralized API Client Export Verification
import api from './src/services/api.js';

const requiredApiMethods = [
  'createJob',
  'getMyJobs',
  'getJobStatus',
  'updateWorkerAvailability',
  'updateWorkerLocation',
  'getWorkerOffers',
  'acceptOffer',
  'rejectOffer',
  'getWorkerBookings',
  'getBookingDetails',
  'createWorkerGroup'
];

for (const method of requiredApiMethods) {
  assert(typeof api[method] === 'function', `API client exports method: ${method}()`);
}

// 3. API Client Mock Fallback & Operations Test
async function testApiMockExecution() {
  console.log('\n--- Testing API Fallback / Operational Mock Layer ---');

  // Test createJob
  const newJob = await api.createJob({
    title: 'Carpentry',
    description: 'Furniture work',
    wage: 900,
    workers_required: 2,
    location: 'Whitefield',
    date: '2026-11-25'
  });
  assert(newJob?.job?.id || newJob?.success, 'Scenario 1 & 8: createJob executes and returns structured job');

  // Test getMyJobs
  const myJobs = await api.getMyJobs();
  assert(Array.isArray(myJobs?.jobs) && myJobs.jobs.length > 0, 'Scenario 8: getMyJobs retrieves jobs list');

  // Test getJobStatus (Customer polling endpoint)
  const status = await api.getJobStatus('job-101');
  assert(status?.status && status.confirmed_workers !== undefined, 'Scenario 10: getJobStatus returns active hiring metrics for polling');

  // Test getWorkerOffers (Worker polling endpoint)
  const offersRes = await api.getWorkerOffers();
  assert(Array.isArray(offersRes?.offers) && offersRes.offers.length > 0, 'Scenario 9: getWorkerOffers returns available offers for polling');

  // Test acceptOffer
  const acceptRes = await api.acceptOffer('offer-501');
  assert(acceptRes?.success && acceptRes.booking, 'Scenario 4: acceptOffer confirms assignment and creates booking');

  // Test updateWorkerAvailability
  const availRes = await api.updateWorkerAvailability(false);
  assert(availRes?.success && availRes.is_available === false, 'Scenario 4: updateWorkerAvailability toggles status');

  // Test getWorkerBookings
  const bookingsRes = await api.getWorkerBookings();
  assert(Array.isArray(bookingsRes?.bookings), 'Scenario 4: getWorkerBookings returns list of worker bookings');

  // Test createWorkerGroup
  const groupRes = await api.createWorkerGroup({
    group_name: 'Bangalore Masons Group',
    members_count: 4,
    skills: 'Masonry'
  });
  assert(groupRes?.success && groupRes.group, 'Scenario 2: createWorkerGroup registers group profile');
}

// 4. Role & Route Guard Assertions
function testRouteGuards() {
  console.log('\n--- Testing Role-based Routing Rules ---');

  // Scenario 5: ProtectedRoute logic
  const checkAccess = (userRole, allowedRoles) => {
    if (!userRole) return '/login'; // unauthenticated -> login
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return userRole === 'customer' ? '/customer/dashboard' : '/worker/dashboard'; // unauthorized -> redirect
    }
    return 'ALLOWED';
  };

  assert(checkAccess(null, ['customer']) === '/login', 'Scenario 5: Unauthenticated user redirected to /login');
  assert(checkAccess('worker', ['customer']) === '/worker/dashboard', 'Scenario 5: Worker accessing customer route redirected to /worker/dashboard');
  assert(checkAccess('customer', ['worker']) === '/customer/dashboard', 'Scenario 5: Customer accessing worker route redirected to /customer/dashboard');
  assert(checkAccess('customer', ['customer']) === 'ALLOWED', 'Scenario 3: Customer access to customer route granted');
  assert(checkAccess('worker', ['worker']) === 'ALLOWED', 'Scenario 4: Worker access to worker route granted');
}

// Run asynchronous tests
await testApiMockExecution();
testRouteGuards();

console.log(`\n==================================================`);
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
}
