import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRedirect from './routes/RoleRedirect';
import Navbar from './components/Navbar';
import AssistantWidget from './components/AssistantWidget';
import GlobalLeaveActionBanner from './components/GlobalLeaveActionBanner';

// Public Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AuthConfirm from './pages/AuthConfirm';

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

function RouteTransition({ children }) {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname}
      className="route-transition"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.2, 0.7, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <BrowserRouter>
          <div className="app-container">
            <Navbar />
            <main className="main-content">
              <RouteTransition>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/customer/login" element={<Login />} />
                  <Route path="/customer/register" element={<Register />} />
                  <Route path="/worker/login" element={<Login />} />
                  <Route path="/worker/register" element={<Register />} />
                  <Route path="/auth/confirm" element={<AuthConfirm />} />
                  <Route path="/auth/callback" element={<AuthConfirm />} />

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
              </RouteTransition>
            </main>
            <AssistantWidget />
            <GlobalLeaveActionBanner />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </MotionConfig>
  );
}
