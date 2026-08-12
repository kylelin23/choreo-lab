import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Auth from "./pages/Auth.jsx";
import UploadDance from "./pages/UploadDance.jsx";
import { me as apiMe } from "./lib/api";
import "./index.css";

function App() {
  const [email, setEmail] = useState("");
  const [checkedSession, setCheckedSession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    apiMe()
      .then((data) => setEmail(data.email || ""))
      .catch(() => {})
      .finally(() => setCheckedSession(true));
  }, []);

  if (!checkedSession) {
    return null;
  }

  const handleLogout = () => {
    setEmail("");
    navigate("/");
  };

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/login"
        element={
          email ? (
            <Navigate to="/upload-dance" replace />
          ) : (
            <Auth
              mode="login"
              onSuccess={(userEmail) => {
                setEmail(userEmail);
                navigate("/upload-dance");
              }}
            />
          )
        }
      />
      <Route
        path="/signup"
        element={
          <Auth
            mode="signup"
            onSuccess={(userEmail) => {
              setEmail(userEmail);
              navigate("/upload-dance");
            }}
          />
        }
      />
      <Route
        path="/upload-dance"
        element={
          email ? (
            <UploadDance email={email} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
