import { useState, useEffect, useRef } from "react";
import "../index.css";
import "./UploadDance.css";
import {
  logout as apiLogout,
  uploadVideo,
  getVideoStatus,
  listVideos,
  getVideo,
} from "../lib/api";

function UploadDance({ email, onLogout }) {
  const [videos, setVideos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    refreshVideos();
    return () => clearInterval(pollRef.current);
  }, []);

  async function refreshVideos() {
    try {
      const data = await listVideos();
      setVideos(data.videos || []);
    } catch (err) {
      setError(err.message);
    }
  }

  const handleLogout = async () => {
    await apiLogout();
    onLogout();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError("");
    setUploading(true);

    try {
      const { video_id } = await uploadVideo(file);
      await refreshVideos();
      pollStatus(video_id);
    } catch (err) {
      setError(err.message);
      setUploading(false);
    } finally {
      e.target.value = "";
    }
  };

  function pollStatus(videoId) {
    pollRef.current = setInterval(async () => {
      try {
        const { status } = await getVideoStatus(videoId);
        if (status === "done" || status === "failed") {
          clearInterval(pollRef.current);
          setUploading(false);
          await refreshVideos();
        }
      } catch (err) {
        clearInterval(pollRef.current);
        setUploading(false);
        setError(err.message);
      }
    }, 2500);
  }

  async function handleViewVideo(videoId) {
    setError("");
    setLoadingVideo(true);
    try {
      const data = await getVideo(videoId);
      setSelectedVideo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingVideo(false);
    }
  }

  function handleCloseViewer() {
    setSelectedVideo(null);
  }

  if (selectedVideo) {
    return <DanceViewer video={selectedVideo} onBack={handleCloseViewer} />;
  }

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
            Log out
          </button>
        </header>

        <input
          type="file"
          accept="video/mp4,video/quicktime"
          ref={fileInputRef}
          onChange={handleFileSelected}
          style={{ display: "none" }}
        />

        <button
          className="upload-btn"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          {uploading ? "Processing..." : "Upload Dance"}
        </button>

        {error && (
          <p className="upload-error" aria-live="polite">
            {error}
          </p>
        )}

        <section className="library">
          <h2>Previously Uploaded Dances</h2>
          {videos.length === 0 ? (
            <div className="library-empty">
              <p>No dances uploaded yet.</p>
            </div>
          ) : (
            <ul className="video-list">
              {videos.map((v) => (
                <li key={v.video_id} className="video-list-item">
                  <span>{new Date(v.created_at).toLocaleString()}</span>{" "}
                  <span className={`status-badge status-${v.status}`}>
                    {v.status}
                  </span>
                  {v.status === "done" && (
                    <button
                      onClick={() => handleViewVideo(v.video_id)}
                      disabled={loadingVideo}
                    >
                      {loadingVideo ? "Loading..." : "View"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function DanceViewer({ video, onBack }) {
  const [speed, setSpeed] = useState(1);
  const [mirrored, setMirrored] = useState(false);
  const [looping, setLooping] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  return (
    <div className="page">
      <div className="home-card">
        <header className="home-header">
          <button className="logout-btn" onClick={onBack}>
            Back to Library
          </button>
        </header>

        <video
          ref={videoRef}
          src={video.video_url}
          controls
          loop={looping}
          style={{
            width: "100%",
            transform: mirrored ? "scaleX(-1)" : "none",
          }}
        />

        <div className="editor-controls">
          <label>
            Speed
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </label>

          <label>
            <input
              type="checkbox"
              checked={mirrored}
              onChange={(e) => setMirrored(e.target.checked)}
            />
            Mirror
          </label>

          <label>
            <input
              type="checkbox"
              checked={looping}
              onChange={(e) => setLooping(e.target.checked)}
            />
            Loop
          </label>
        </div>
      </div>
    </div>
  );
}

export default UploadDance;
