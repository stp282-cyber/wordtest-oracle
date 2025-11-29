import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import StudyHistory from './pages/StudyHistory';
import StudyPage from './pages/StudyPage';
import TestInterface from './pages/TestInterface';
import WordGame from './pages/WordGame';
import WordScramble from './pages/WordScramble';
import SpeedQuiz from './pages/SpeedQuiz';
import WordRain from './pages/WordRain';
import AdminDashboard from './pages/AdminDashboard';
import WordManagement from './pages/WordManagement';
import StudentManagement from './pages/StudentManagement';
import ClassManagement from './pages/ClassManagement';
import LessonManagement from './pages/LessonManagement';
import DollarManagement from './pages/DollarManagement';
import AnnouncementManagement from './pages/AnnouncementManagement';
import BattleLobby from './pages/BattleLobby';
import BattleRoom from './pages/BattleRoom';
import SurvivalLobby from './pages/SurvivalLobby';
import SurvivalGame from './pages/SurvivalGame';
import MigrationTool from './pages/MigrationTool';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Layout from './components/Layout';

const PrivateRoute = ({ children, role }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  if (!token) return <Navigate to="/login" />;

  // Super admin can access everything, or at least admin routes
  if (role === 'admin' && userRole === 'super_admin') {
    return children;
  }

  if (role && userRole !== role) return <Navigate to="/" />;

  return children;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<Layout />}>
            {/* Student Routes */}
            <Route
              path="/student"
              element={
                <PrivateRoute role="student">
                  <StudentDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/study"
              element={
                <PrivateRoute role="student">
                  <StudyPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/test"
              element={
                <PrivateRoute role="student">
                  <TestInterface />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/game"
              element={
                <PrivateRoute role="student">
                  <WordGame />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/scramble"
              element={
                <PrivateRoute role="student">
                  <WordScramble />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/speed"
              element={
                <PrivateRoute role="student">
                  <SpeedQuiz />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/rain"
              element={
                <PrivateRoute role="student">
                  <WordRain />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/history"
              element={
                <PrivateRoute role="student">
                  <StudyHistory />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/battle"
              element={
                <PrivateRoute role="student">
                  <BattleLobby />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/battle/:roomId"
              element={
                <PrivateRoute role="student">
                  <BattleRoom />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/survival"
              element={
                <PrivateRoute role="student">
                  <SurvivalLobby />
                </PrivateRoute>
              }
            />
            <Route
              path="/student/survival/:roomId"
              element={
                <PrivateRoute role="student">
                  <SurvivalGame />
                </PrivateRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <PrivateRoute role="admin">
                  <AdminDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/words"
              element={
                <PrivateRoute role="admin">
                  <WordManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/students"
              element={
                <PrivateRoute role="admin">
                  <StudentManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/classes"
              element={
                <PrivateRoute role="admin">
                  <ClassManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/lessons"
              element={
                <PrivateRoute role="admin">
                  <LessonManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/dollars"
              element={
                <PrivateRoute role="admin">
                  <DollarManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/announcements"
              element={
                <PrivateRoute role="admin">
                  <AnnouncementManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/student-history"
              element={
                <PrivateRoute role="admin">
                  <StudyHistory />
                </PrivateRoute>
              }
            />
            <Route
              path="/migration"
              element={
                <PrivateRoute role="admin">
                  <MigrationTool />
                </PrivateRoute>
              }
            />
          </Route>

          {/* Super Admin Routes - No Layout for full immersion or different layout */}
          <Route
            path="/super-admin"
            element={
              <PrivateRoute role="super_admin">
                <SuperAdminDashboard />
              </PrivateRoute>
            }
          />

          {/* Default Redirect */}
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
