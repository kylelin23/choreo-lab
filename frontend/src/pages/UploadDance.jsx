import "../index.css";
import "./UploadDance.css";
import { logout as apiLogout } from "../lib/api";

function UploadDance({ email, onLogout, onUploadDance }) {
  const handleLogout = async () => {
    await apiLogout();
    onLogout();
  };

  return (
    <div className="page">
      <div className="home-card">
        <header className="home-header">
          <div>
            <h1>Choreo Video Library</h1>
            <p className="subtitle">
              {email ? `Signed in as ${email}` : "Welcome back"}
            </p>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </button>
        </header>

        <button className="upload-btn" onClick={onUploadDance}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Upload Dance
        </button>

        <section className="library">
          <h2>Previously Uploaded Dances</h2>
          <div className="library-empty">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 10l4.55-2.68A1 1 0 0 1 21 8.15v7.7a1 1 0 0 1-1.45.83L15 14" />
              <rect x="3" y="6" width="12" height="12" rx="2" />
            </svg>
            <p>No dances uploaded yet.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default UploadDance;
