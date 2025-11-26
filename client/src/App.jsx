import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import StudyHistory from './pages/StudyHistory';
import StudyPage from './pages/StudyPage';
import TestInterface from './pages/TestInterface';
import AdminDashboard from './pages/AdminDashboard';
import WordManagement from './pages/WordManagement';
import StudentManagement from './pages/StudentManagement';
import ClassManagement from './pages/ClassManagement';

const PrivateRoute = ({ children, role }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  if (!token) return <Navigate to="/login" />;
  if (role && userRole !== role) return <Navigate to="/" />;

  return children;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <Routes>
          <Route path="/login" element={<Login />} />

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
            path="/student/history"
            element={
              <PrivateRoute role="student">
                <StudyHistory />
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

          {/* Default Redirect */}
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
