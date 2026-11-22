import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRedirect from './routes/RoleRedirect';
import Navbar from './components/Navbar';

// Public Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';

// Customer Pages (Member 2 integration points)
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerProfile from './pages/customer/Profile';
import PostJob from './pages/customer/PostJob';
import LiveHiring from './pages/customer/LiveHiring';
import ConfirmedWorkers from './pages/customer/ConfirmedWorkers';
import CustomerMyJobs from './pages/customer/MyJobs';

// Worker Pages (Member 3 integration points)
import WorkerDashboard from './pages/worker/Dashboard';
import WorkerProfile from './pages/worker/Profile';
import JobOffers from './pages/worker/JobOffers';
import AcceptedJob from './pages/worker/AcceptedJob';
import WorkerMyJobs from './pages/worker/MyJobs';
import WorkerGroups from './pages/worker/Groups';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-container">
          <Navbar />
          <main className="main-content">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/customer/login" element={<Login />} />
              <Route path="/customer/register" element={<Register />} />
              <Route path="/worker/login" element={<Login />} />
              <Route path="/worker/register" element={<Register />} />

              {/* Customer Protected Routes */}
              <Route
                path="/customer/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <CustomerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/profile"
                element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <CustomerProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/post-job"
                element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <PostJob />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/live-hiring"
                element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <LiveHiring />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/confirmed-workers"
                element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <ConfirmedWorkers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customer/my-jobs"
                element={
                  <ProtectedRoute allowedRoles={['customer']}>
                    <CustomerMyJobs />
                  </ProtectedRoute>
                }
              />

              {/* Worker Protected Routes */}
              <Route
                path="/worker/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['worker']}>
                    <WorkerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/worker/profile"
                element={
                  <ProtectedRoute allowedRoles={['worker']}>
                    <WorkerProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/worker/job-offers"
                element={
                  <ProtectedRoute allowedRoles={['worker']}>
                    <JobOffers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/worker/accepted-job"
                element={
                  <ProtectedRoute allowedRoles={['worker']}>
                    <AcceptedJob />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/worker/my-jobs"
                element={
                  <ProtectedRoute allowedRoles={['worker']}>
                    <WorkerMyJobs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/worker/groups"
                element={
                  <ProtectedRoute allowedRoles={['worker']}>
                    <WorkerGroups />
                  </ProtectedRoute>
                }
              />

              {/* Fallback route */}
              <Route path="*" element={<RoleRedirect />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
