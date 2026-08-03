import { useState, useEffect, useRef } from "react";
import "../index.css";
import "./UploadDance.css";
import {
  logout as apiLogout,
  uploadVideo,
  getVideoStatus,
  listVideos,
  getVideo,
  deleteVideo,
} from "../lib/api";

function UploadDance({ email, onLogout }) {
  const [videos, setVideos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const avatarMenuRef = useRef(null);

  useEffect(() => {
    refreshVideos();
    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    function handleClickOutside(e) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avatarMenuOpen]);

  async function refreshVideos() {
    try {
      const data = await listVideos();
      setVideos(data.videos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setHasLoadedOnce(true);
    }
  }

  const handleLogout = async () => {
    await apiLogout();
    onLogout();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  async function handleUpload(file) {
    if (!file) return;

    setError("");
    setUploading(true);
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    try {
      const { video_id } = await uploadVideo(file);
      await refreshVideos();
      pollStatus(video_id);
    } catch (err) {
      setError(err.message);
      setUploading(false);
      clearInterval(timerRef.current);
    }
  }

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    await handleUpload(file);
    e.target.value = "";
  };

  const [dragActive, setDragActive] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  function pollStatus(videoId) {
    pollRef.current = setInterval(async () => {
      try {
        const { status } = await getVideoStatus(videoId);
        if (status === "done" || status === "failed") {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setUploading(false);
          await refreshVideos();
        }
      } catch (err) {
        clearInterval(pollRef.current);
        clearInterval(timerRef.current);
        setUploading(false);
        setError(err.message);
      }
    }, 2500);
  }

  async function handleViewVideo(videoId) {
    setError("");
    setLoadingVideo(true);
    setSelectedVideoId(videoId);
    try {
      const data = await getVideo(videoId);
      setSelectedVideo(data);
      setMenuOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingVideo(false);
    }
  }

  async function handleDeleteVideo(videoId) {
    if (!window.confirm("Delete this dance? This can't be undone.")) return;

    setError("");
    setDeletingId(videoId);
    try {
      await deleteVideo(videoId);
      if (videoId === selectedVideoId) {
        setSelectedVideo(null);
        setSelectedVideoId(null);
      }
      await refreshVideos();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function formatElapsed(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  const hasAnyVideos = videos.length > 0;
  const hasCompletedVideos = videos.some((v) => v.status === "done");
  const avatarInitial = email ? email[0].toUpperCase() : "?";

  return (
    <div className="shell">
      <header className="topbar">
        <button
          className="menu-trigger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Select a dance"}
          aria-expanded={menuOpen}
        >
          <ListIcon />
          {menuOpen ? "Close" : "Select a Dance"}
        </button>
        <span className="topbar-brand">Choreo</span>
        <div className="topbar-avatar-wrap" ref={avatarMenuRef}>
          <button
            className="topbar-avatar"
            onClick={() => setAvatarMenuOpen((o) => !o)}
            aria-label="Account menu"
            aria-expanded={avatarMenuOpen}
            title={email}
          >
            {avatarInitial}
          </button>
          {avatarMenuOpen && (
            <div className="avatar-menu">
              <p className="avatar-menu-email">{email}</p>
              <button
                className="avatar-menu-item"
                onClick={() => {
                  setAvatarMenuOpen(false);
                  handleLogout();
                }}
              >
                <LogoutIcon />
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {menuOpen && (
        <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />
      )}

      <aside className={`drawer ${menuOpen ? "drawer-open" : ""}`}>
        <div className="drawer-user">
          <span className="rail-avatar" aria-hidden="true">
            {avatarInitial}
          </span>
          <span className="rail-email">{email}</span>
        </div>

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
          {uploading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            "+ Upload Dance"
          )}
        </button>

        {uploading && (
          <p className="processing-note" aria-live="polite">
            This can take a minute or two. Elapsed:{" "}
            <strong>{formatElapsed(elapsedSeconds)}</strong>
          </p>
        )}

        {error && (
          <p className="upload-error" role="alert" aria-live="polite">
            <AlertIcon />
            {error}
          </p>
        )}

        <nav className="rail-list">
          <p className="rail-list-label">Your dances</p>
          {!hasAnyVideos ? (
            <div className="rail-empty">
              <FilmIcon />
              <p>Nothing uploaded yet</p>
            </div>
          ) : (
            <ul>
              {videos.map((v) => (
                <li key={v.video_id} className="rail-item-row">
                  <button
                    className={`rail-item ${
                      v.video_id === selectedVideoId ? "rail-item-active" : ""
                    }`}
                    onClick={() =>
                      v.status === "done" && handleViewVideo(v.video_id)
                    }
                    disabled={v.status !== "done"}
                  >
                    <span className="rail-item-date">
                      {v.filename} ·{" "}
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                    <span className={`status-badge status-badge-${v.status}`}>
                      <span className={`status-dot status-dot-${v.status}`} />
                      {v.status === "processing" ? "processing…" : v.status}
                    </span>
                  </button>
                  <button
                    className="rail-delete-btn"
                    onClick={() => handleDeleteVideo(v.video_id)}
                    disabled={deletingId === v.video_id}
                    aria-label={`Delete ${v.filename || "this dance"}`}
                    title="Delete"
                  >
                    {deletingId === v.video_id ? (
                      <span className="spinner" aria-hidden="true" />
                    ) : (
                      <TrashIcon />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <button className="rail-logout" onClick={handleLogout}>
          <LogoutIcon />
          Log out
        </button>
      </aside>

      <main className="stage">
        {selectedVideo ? (
          <DanceViewerInline
            key={selectedVideo.video_id}
            video={selectedVideo}
          />
        ) : hasLoadedOnce && !hasAnyVideos ? (
          <div
            className={`stage-empty stage-dropzone ${
              dragActive ? "stage-dropzone-active" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <span className="stage-empty-icon" aria-hidden="true">
              <UploadCloudIcon />
            </span>
            <h2>Upload your first dance</h2>
            <p>Drag and drop a video here, or click below to choose a file.</p>
            <button
              className="stage-upload-btn"
              onClick={handleUploadClick}
              disabled={uploading}
            >
              {uploading ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                "+ Upload Dance"
              )}
            </button>
            <p className="stage-empty-hint">
              Once it finishes processing, it'll show up here — with mirroring,
              looping, and speed controls.
            </p>
          </div>
        ) : hasCompletedVideos ? (
          <div className="stage-empty">
            <span className="stage-empty-icon" aria-hidden="true">
              <FilmIcon />
            </span>
            <h2>Pick a dance</h2>
            <p>Open the menu and select one to view it here.</p>
          </div>
        ) : (
          <div className="stage-empty">
            <span className="stage-empty-icon" aria-hidden="true">
              <span className="spinner spinner-dark" />
            </span>
            <h2>Still processing</h2>
            <p>
              Your upload is being processed — this can take a minute or two.
              It'll show up here once it's ready.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function ListIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function LogoutIcon() {
  return (
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
  );
}

function FilmIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="18" rx="2" ry="2" />
      <line x1="7" y1="3" x2="7" y2="21" />
      <line x1="17" y1="3" x2="17" y2="21" />
      <line x1="2" y1="9" x2="7" y2="9" />
      <line x1="2" y1="15" x2="7" y2="15" />
      <line x1="17" y1="9" x2="22" y2="9" />
      <line x1="17" y1="15" x2="22" y2="15" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function UploadCloudIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 16l-4-4-4 4" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function DanceViewerInline({ video }) {
  const [speed, setSpeed] = useState(1);
  const [mirrored, setMirrored] = useState(false);
  const [looping, setLooping] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Loop-a-section state
  const [loopStart, setLoopStart] = useState(null);
  const [loopEnd, setLoopEnd] = useState(null);
  const [sectionLooping, setSectionLooping] = useState(false);
  const [draggingMarker, setDraggingMarker] = useState(null);

  const videoRef = useRef(null);
  const scrubberWrapRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  useEffect(() => {
    let frameId;
    function tick() {
      if (videoRef.current) {
        const t = videoRef.current.currentTime;
        setCurrentTime(t);

        if (
          sectionLooping &&
          loopStart !== null &&
          loopEnd !== null &&
          t >= loopEnd
        ) {
          videoRef.current.currentTime = loopStart;
        }
      }
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [sectionLooping, loopStart, loopEnd]);

  useEffect(() => {
    if (!draggingMarker) return;

    function handleMove(e) {
      if (!scrubberWrapRef.current || duration <= 0) return;
      const rect = scrubberWrapRef.current.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      if (clientX == null) return;
      let frac = (clientX - rect.left) / rect.width;
      frac = Math.min(1, Math.max(0, frac));
      const t = frac * duration;

      if (draggingMarker === "start") {
        setLoopStart(Math.min(t, loopEnd !== null ? loopEnd - 0.1 : duration));
      } else {
        setLoopEnd(Math.max(t, loopStart !== null ? loopStart + 0.1 : 0));
      }
    }

    function handleUp() {
      setDraggingMarker(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingMarker, duration, loopStart, loopEnd]);

  function togglePlay() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  }

  function handleSeek(e) {
    const time = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }

  function toggleMute() {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(videoRef.current.muted);
  }

  function markLoopStart() {
    const t = videoRef.current ? videoRef.current.currentTime : currentTime;
    if (loopEnd !== null && t >= loopEnd) {
      // keep the range valid — push end forward slightly
      setLoopEnd(Math.min(duration, t + 1));
    }
    setLoopStart(t);
    setSectionLooping(true);
  }

  function markLoopEnd() {
    const t = videoRef.current ? videoRef.current.currentTime : currentTime;
    if (loopStart !== null && t <= loopStart) {
      setLoopStart(Math.max(0, t - 1));
    }
    setLoopEnd(t);
    setSectionLooping(true);
  }

  function clearLoopSection() {
    setLoopStart(null);
    setLoopEnd(null);
    setSectionLooping(false);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  function currentCount() {
    const timestamps = video.beat_timestamps || [];
    const counts = video.counts || [];
    if (timestamps.length === 0) return null;

    let idx = -1;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] <= currentTime) idx = i;
      else break;
    }
    return idx >= 0 ? counts[idx] : null;
  }

  const count = currentCount();
  const hasLoopRange = loopStart !== null && loopEnd !== null;

  return (
    <div className="viewer">
      <div className="viewer-video-wrap">
        <div className="viewer-video-frame">
          <video
            ref={videoRef}
            src={video.video_url}
            loop={looping && !sectionLooping}
            onClick={togglePlay}
            onLoadedMetadata={(e) => setDuration(e.target.duration)}
            onEnded={() => setPlaying(false)}
            style={{
              maxWidth: "100%",
              maxHeight: "75vh",
              width: "auto",
              height: "auto",
              transform: mirrored ? "scaleX(-1)" : "none",
            }}
          />
          {count !== null && (
            <span className="count-overlay" aria-hidden="true">
              {count}
            </span>
          )}
        </div>

        <div className="custom-controls">
          <button
            type="button"
            className="control-btn"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          <span className="control-time">{formatTime(currentTime)}</span>

          <div className="scrubber-wrap" ref={scrubberWrapRef}>
            {hasLoopRange && duration > 0 && (
              <div
                className="loop-range-highlight"
                style={{
                  left: `${(loopStart / duration) * 100}%`,
                  width: `${((loopEnd - loopStart) / duration) * 100}%`,
                }}
              />
            )}
            {loopStart !== null && duration > 0 && (
              <div
                className="loop-marker loop-marker-start"
                style={{ left: `${(loopStart / duration) * 100}%` }}
                title={`Loop start: ${formatTime(loopStart)} — drag to adjust`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDraggingMarker("start");
                }}
              />
            )}
            {loopEnd !== null && duration > 0 && (
              <div
                className="loop-marker loop-marker-end"
                style={{ left: `${(loopEnd / duration) * 100}%` }}
                title={`Loop end: ${formatTime(loopEnd)} — drag to adjust`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDraggingMarker("end");
                }}
              />
            )}
            <input
              type="range"
              className="control-scrubber"
              min={0}
              max={duration || 0}
              step={0.01}
              value={currentTime}
              onChange={handleSeek}
            />
          </div>

          <span className="control-time">{formatTime(duration)}</span>

          <button
            type="button"
            className="control-btn"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MuteIcon /> : <VolumeIcon />}
          </button>
        </div>

        <div className="loop-section-controls">
          <button
            type="button"
            className="loop-mark-btn"
            onClick={markLoopStart}
          >
            Set start
          </button>
          <button type="button" className="loop-mark-btn" onClick={markLoopEnd}>
            Set end
          </button>

          {hasLoopRange && (
            <>
              <span className="loop-range-label">
                {formatTime(loopStart)}–{formatTime(loopEnd)}
              </span>
              <button
                type="button"
                className={`toggle-pill ${
                  sectionLooping ? "toggle-pill-active" : ""
                }`}
                role="switch"
                aria-checked={sectionLooping}
                onClick={() => setSectionLooping((s) => !s)}
              >
                Loop section
              </button>
              <button
                type="button"
                className="loop-clear-btn"
                onClick={clearLoopSection}
                aria-label="Clear loop section"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      <div className="viewer-controls">
        <label className="viewer-speed">
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

        <button
          type="button"
          className={`toggle-pill ${mirrored ? "toggle-pill-active" : ""}`}
          role="switch"
          aria-checked={mirrored}
          onClick={() => setMirrored((m) => !m)}
        >
          Mirror
        </button>

        <button
          type="button"
          className={`toggle-pill ${
            looping && !(sectionLooping && hasLoopRange)
              ? "toggle-pill-active"
              : ""
          }`}
          role="switch"
          aria-checked={looping}
          onClick={() => setLooping((l) => !l)}
          disabled={sectionLooping && hasLoopRange}
          title={
            sectionLooping && hasLoopRange
              ? "Clear the loop section to use whole-video loop"
              : undefined
          }
        >
          Loop video
        </button>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

export default UploadDance;
