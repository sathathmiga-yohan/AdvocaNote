
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

// =====================================
// PUBLIC PAGES
// =====================================

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";

// =====================================
// LAWYER PAGES
// =====================================

import MyLegalDiary from "./pages/MyLegalDiary";
import AddDiaryEntry from "./pages/AddDiaryEntry";
import DiaryEntryDetails from "./pages/DiaryEntryDetails";
import MyCases from "./pages/MyCases";
import Hearings from "./pages/Hearings";
import Calendar from "./pages/Calendar";
import TasksPremium from "./pages/TasksPremium";
import AISuggestions from "./pages/AISuggestions";
import Subscription from "./pages/Subscription";
import Profile from "./pages/Profile";
import RejoinAccount from "./pages/RejoinAccount";
// =====================================
// LAWYER ROUTE & LAYOUT
// =====================================

import ProtectedRoute from "./components/ProtectedRoute";
import LawyerLayout from "./components/LawyerLayout";

// =====================================
// ADMIN ROUTE & LAYOUT
// =====================================

import AdminRoute from "./admin/AdminRoute";
import AdminLayout from "./admin/AdminLayout";

// =====================================
// ADMIN PAGES
// =====================================

import AdminDashboard from "./admin/AdminDashboard";
import AdminLawyers from "./admin/AdminLawyers";
import AdminSubscriptions from "./admin/AdminSubscriptions";
import AdminNotifications from "./admin/AdminNotifications";
import AdminSupport from "./admin/AdminSupport";
import AdminSecurity from "./admin/AdminSecurity";
import AdminSettings from "./admin/AdminSettings";

// =====================================
// MAIN APPLICATION
// =====================================

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =====================================
            PUBLIC ROUTES
        ===================================== */}

        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />
        <Route
          path="/rejoin-account"
          element={<RejoinAccount />}
        />
        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/verify-email"
          element={<VerifyEmail />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        {/* =====================================
            PROTECTED LAWYER ROUTES
        ===================================== */}

        <Route
          element={
            <ProtectedRoute>
              <LawyerLayout />
            </ProtectedRoute>
          }
        >

          <Route
            path="/my-legal-diary"
            element={<MyLegalDiary />}
          />

          <Route
            path="/add-diary-entry"
            element={<AddDiaryEntry />}
          />

          <Route
            path="/diary-entry-details/:entryId"
            element={<DiaryEntryDetails />}
          />

          <Route
            path="/cases"
            element={<MyCases />}
          />

          <Route
            path="/hearings"
            element={<Hearings />}
          />

          <Route
            path="/calendar"
            element={<Calendar />}
          />

          <Route
            path="/tasks"
            element={<TasksPremium />}
          />

          <Route
            path="/ai-suggestions"
            element={<AISuggestions />}
          />

          {/* SUBSCRIPTION MAIN PAGE */}

          <Route
            path="/subscription"
            element={<Subscription />}
          />

          {/* STRIPE PAYMENT SUCCESS */}

          <Route
            path="/subscription/success"
            element={<Subscription />}
          />

          {/* STRIPE CHECKOUT CANCEL */}

          <Route
            path="/subscription/cancel"
            element={<Subscription />}
          />

          {/* PROFILE */}

          <Route
            path="/profile"
            element={<Profile />}
          />


        </Route>

        {/* =====================================
            PROTECTED ADMIN ROUTES
        ===================================== */}

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >

          <Route
            index
            element={<AdminDashboard />}
          />

          <Route
            path="lawyers"
            element={<AdminLawyers />}
          />

          <Route
            path="subscriptions"
            element={<AdminSubscriptions />}
          />

          <Route
            path="notifications"
            element={<AdminNotifications />}
          />

          <Route
            path="support"
            element={<AdminSupport />}
          />

          <Route
            path="security"
            element={<AdminSecurity />}
          />

          <Route
            path="settings"
            element={<AdminSettings />}
          />

        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;
