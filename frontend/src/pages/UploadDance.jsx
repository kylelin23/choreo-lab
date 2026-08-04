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
  renameVideo,
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
  const [renamingId, setRenamingId] = useState(null);
  const [renameInput, setRenameInput] = useState("");
  const [savingRename, setSavingRename] = useState(false);
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
          if (status === "done") {
            // Jump straight into the freshly processed video instead of
            // leaving the user to find it in the menu themselves.
            handleViewVideo(videoId);
          }
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

  function startRename(video) {
    setRenamingId(video.video_id);
    setRenameInput(video.name || "");
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameInput("");
  }

  async function submitRename(videoId) {
    const trimmed = renameInput.trim();
    if (!trimmed) {
      cancelRename();
      return;
    }

    setError("");
    setSavingRename(true);
    try {
      await renameVideo(videoId, trimmed);
      await refreshVideos();
      cancelRename();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingRename(false);
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
                  {renamingId === v.video_id ? (
                    <div className="rail-rename-form">
                      <input
                        type="text"
                        className="rail-rename-input"
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(v.video_id);
                          if (e.key === "Escape") cancelRename();
                        }}
                        maxLength={100}
                        autoFocus
                        disabled={savingRename}
                      />
                      <button
                        type="button"
                        className="rail-rename-btn"
                        onClick={() => submitRename(v.video_id)}
                        disabled={savingRename}
                        aria-label="Save name"
                      >
                        {savingRename ? (
                          <span className="spinner" aria-hidden="true" />
                        ) : (
                          <CheckIcon />
                        )}
                      </button>
                      <button
                        type="button"
                        className="rail-rename-btn"
                        onClick={cancelRename}
                        disabled={savingRename}
                        aria-label="Cancel rename"
                      >
                        <XIcon />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className={`rail-item ${
                          v.video_id === selectedVideoId
                            ? "rail-item-active"
                            : ""
                        }`}
                        onClick={() =>
                          v.status === "done" && handleViewVideo(v.video_id)
                        }
                        disabled={v.status !== "done"}
                      >
                        <span className="rail-item-date">
                          {v.name} ·{" "}
                          {new Date(v.created_at).toLocaleDateString()}
                        </span>
                        <span
                          className={`status-badge status-badge-${v.status}`}
                        >
                          <span
                            className={`status-dot status-dot-${v.status}`}
                          />
                          {v.status === "processing" ? "processing…" : v.status}
                        </span>
                      </button>
                      <button
                        className="rail-delete-btn"
                        onClick={() => startRename(v)}
                        aria-label={`Rename ${v.name || "this dance"}`}
                        title="Rename"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        className="rail-delete-btn"
                        onClick={() => handleDeleteVideo(v.video_id)}
                        disabled={deletingId === v.video_id}
                        aria-label={`Delete ${v.name || "this dance"}`}
                        title="Delete"
                      >
                        {deletingId === v.video_id ? (
                          <span className="spinner" aria-hidden="true" />
                        ) : (
                          <TrashIcon />
                        )}
                      </button>
                    </>
                  )}
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
            <p>
              Drag and drop a non-copyrighted video here, or click below to
              choose a file.
            </p>
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

function PencilIcon() {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function CheckIcon() {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function getBeatIndex(t, timestamps) {
  let idx = -1;
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] <= t) idx = i;
    else break;
  }
  return idx;
}

function DanceViewerInline({ video }) {
  const [speed, setSpeed] = useState(1);
  const [customSpeedMode, setCustomSpeedMode] = useState(false);
  const [customSpeedInput, setCustomSpeedInput] = useState("");
  const [mirrored, setMirrored] = useState(false);
  const [looping, setLooping] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showCounts, setShowCounts] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loopStart, setLoopStart] = useState(null);
  const [loopEnd, setLoopEnd] = useState(null);
  const [sectionLooping, setSectionLooping] = useState(false);
  const [draggingMarker, setDraggingMarker] = useState(null);
  const beatTimestamps = video.beat_timestamps || [];
  const beatCounts = video.counts || [];
  const [slideshowOn, setSlideshowOn] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [slideshowFrame, setSlideshowFrame] = useState(null);
  const [slideshowLoading, setSlideshowLoading] = useState(false);
  const canvasRef = useRef(null);
  const frameCacheRef = useRef({}); // beat index -> captured data URL

  const videoRef = useRef(null);
  const scrubberWrapRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  function captureAndCacheFrame(idx) {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas || !v.videoWidth) return;
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      frameCacheRef.current[idx] = dataUrl;
      setSlideshowFrame(dataUrl);
    } catch {
      // Canvas is "tainted" — the video isn't served with CORS headers
      // that allow pixel reads. Nothing to do but skip this frame.
    }
  }

  // Seek to (and capture) the beat at `slideshowIndex`, using the cache
  // when we've already visited it.
  useEffect(() => {
    if (!slideshowOn) return;
    if (slideshowIndex < 0 || slideshowIndex >= beatTimestamps.length) return;

    const cached = frameCacheRef.current[slideshowIndex];
    if (cached) {
      setSlideshowFrame(cached);
      return;
    }

    const v = videoRef.current;
    if (!v) return;

    setSlideshowLoading(true);
    const target = beatTimestamps[slideshowIndex];

    function onSeeked() {
      v.removeEventListener("seeked", onSeeked);
      captureAndCacheFrame(slideshowIndex);
      setSlideshowLoading(false);
    }

    v.addEventListener("seeked", onSeeked);
    v.currentTime = target;

    return () => v.removeEventListener("seeked", onSeeked);
  }, [slideshowOn, slideshowIndex, beatTimestamps.length]);

  function goToSlideshowIndex(idx) {
    const len = beatTimestamps.length;
    if (len === 0) return;
    setSlideshowIndex(((idx % len) + len) % len);
  }

  function handleToggleSlideshow() {
    setSlideshowOn((prev) => {
      const next = !prev;
      if (next) {
        videoRef.current?.pause();
        setPlaying(false);
        const startIdx = Math.max(
          0,
          getBeatIndex(
            videoRef.current?.currentTime ?? currentTime,
            beatTimestamps,
          ),
        );
        setSlideshowIndex(startIdx);
      }
      return next;
    });
  }

  // Arrow-key navigation while the slideshow is active — wraps around
  // from the last count back to the first, and vice versa.
  useEffect(() => {
    if (!slideshowOn) return;
    function handleKeyDown(e) {
      const len = beatTimestamps.length;
      if (len === 0) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSlideshowIndex((i) => (i + 1) % len);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSlideshowIndex((i) => (i - 1 + len) % len);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slideshowOn, beatTimestamps.length]);

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

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === videoRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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

  function toggleFullscreen() {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      videoRef.current.requestFullscreen?.();
    }
  }

  function handleSpeedSelect(e) {
    const val = e.target.value;
    if (val === "custom") {
      setCustomSpeedMode(true);
      const num = parseFloat(customSpeedInput);
      if (!Number.isNaN(num) && num > 0) {
        setSpeed(num);
      }
    } else {
      setCustomSpeedMode(false);
      setSpeed(Number(val));
    }
  }

  function handleCustomSpeedChange(e) {
    const val = e.target.value;

    if (val === "") {
      setCustomSpeedInput(val);
      return;
    }

    const num = parseFloat(val);
    if (Number.isNaN(num) || num <= 0) {
      return;
    }

    setCustomSpeedInput(val);
    setSpeed(num);
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
    if (beatTimestamps.length === 0) return null;
    const idx = getBeatIndex(currentTime, beatTimestamps);
    return idx >= 0 ? beatCounts[idx] : null;
  }

  const count = currentCount();
  const hasLoopRange = loopStart !== null && loopEnd !== null;
  const isPresetSpeed = SPEED_PRESETS.includes(speed) && !customSpeedMode;

  const slideshowCount =
    slideshowOn && beatCounts[slideshowIndex] != null
      ? beatCounts[slideshowIndex]
      : null;

  return (
    <div className="viewer">
      <div className="viewer-video-wrap">
        <div className="viewer-video-frame">
          <video
            ref={videoRef}
            src={video.video_url}
            crossOrigin="anonymous"
            loop={looping && !sectionLooping}
            onClick={!slideshowOn ? togglePlay : undefined}
            onLoadedMetadata={(e) => setDuration(e.target.duration)}
            onEnded={() => setPlaying(false)}
            style={{
              maxWidth: "100%",
              maxHeight: "75vh",
              width: "auto",
              height: "auto",
              transform: mirrored ? "scaleX(-1)" : "none",
              opacity: slideshowOn ? 0 : 1,
              pointerEvents: slideshowOn ? "none" : "auto",
            }}
          />

          {!slideshowOn && showCounts && count !== null && (
            <span className="count-overlay" aria-hidden="true">
              {count}
            </span>
          )}

          {slideshowOn && (
            <div className="slideshow-overlay">
              {slideshowLoading || !slideshowFrame ? (
                <div className="slideshow-loading">
                  <span className="spinner spinner-dark" />
                </div>
              ) : (
                <img
                  src={slideshowFrame}
                  alt={`Count ${slideshowCount ?? slideshowIndex + 1}`}
                  className="slideshow-img"
                  style={{ transform: mirrored ? "scaleX(-1)" : "none" }}
                />
              )}
              {showCounts && slideshowCount !== null && (
                <span className="count-overlay" aria-hidden="true">
                  {slideshowCount}
                </span>
              )}
            </div>
          )}
        </div>

        {slideshowOn ? (
          <div className="slideshow-nav">
            <button
              type="button"
              className="control-btn"
              onClick={() => goToSlideshowIndex(slideshowIndex - 1)}
              disabled={beatTimestamps.length === 0}
              aria-label="Previous count"
            >
              <ChevronLeftIcon />
            </button>
            <span className="slideshow-position">
              {beatTimestamps.length > 0
                ? `Count ${slideshowIndex + 1} of ${beatTimestamps.length}`
                : "No counts detected for this video"}
            </span>
            <button
              type="button"
              className="control-btn"
              onClick={() => goToSlideshowIndex(slideshowIndex + 1)}
              disabled={beatTimestamps.length === 0}
              aria-label="Next count"
            >
              <ChevronRightIcon />
            </button>
          </div>
        ) : (
          <>
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

              <button
                type="button"
                className="control-btn"
                onClick={toggleFullscreen}
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
              >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
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
              <button
                type="button"
                className="loop-mark-btn"
                onClick={markLoopEnd}
              >
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
          </>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="viewer-controls">
        <label className="viewer-speed">
          Speed
          <select
            value={isPresetSpeed ? speed : "custom"}
            onChange={handleSpeedSelect}
          >
            {SPEED_PRESETS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
            <option value="custom">Custom…</option>
          </select>
        </label>

        {customSpeedMode && (
          <label className="viewer-speed-custom">
            <input
              type="number"
              min="0.05"
              step="0.05"
              inputMode="decimal"
              placeholder={String(speed)}
              value={customSpeedInput}
              onChange={handleCustomSpeedChange}
            />
            x
          </label>
        )}

        <button
          type="button"
          className={`toggle-pill ${showCounts ? "toggle-pill-active" : ""}`}
          role="switch"
          aria-checked={showCounts}
          onClick={() => setShowCounts((c) => !c)}
        >
          Counts
        </button>

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

        <button
          type="button"
          className={`toggle-pill ${slideshowOn ? "toggle-pill-active" : ""}`}
          role="switch"
          aria-checked={slideshowOn}
          onClick={handleToggleSlideshow}
          disabled={beatTimestamps.length === 0}
          title={
            beatTimestamps.length === 0
              ? "No counts detected for this video"
              : undefined
          }
        >
          Frame View
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

function FullscreenIcon() {
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
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function ChevronLeftIcon() {
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
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
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
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function FullscreenExitIcon() {
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
      <polyline points="9 3 9 9 3 9" />
      <polyline points="15 21 15 15 21 15" />
      <line x1="9" y1="9" x2="3" y2="3" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}

export default UploadDance;
