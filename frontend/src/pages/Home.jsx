import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../index.css";
import "./Home.css";
import "./UploadDance.css";
import { getDemoVideo } from "../lib/api";

const HERO_TITLE = "Welcome to Choreo Lab! ";
const TYPING_SPEED_MS = 35;

function useTypewriter(text, speed) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

function Home() {
  const [demoVideo, setDemoVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const { displayed: titleText, done: titleDone } = useTypewriter(
    HERO_TITLE,
    TYPING_SPEED_MS,
  );

  useEffect(() => {
    getDemoVideo()
      .then(setDemoVideo)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="home-page">
      <header className="home-topbar">
        <span className="home-brand">Choreo Lab</span>
        <div className="home-cta">
          <button className="home-btn-ghost" onClick={() => navigate("/login")}>
            Log in
          </button>
          <button
            className="home-btn-primary"
            onClick={() => navigate("/signup")}
          >
            Sign up
          </button>
        </div>
      </header>

      <main className="home-hero">
        <h1 aria-label={HERO_TITLE}>
          <span aria-hidden="true">
            {titleText}
            <span
              className={`home-caret ${titleDone ? "home-caret-blink" : ""}`}
            />
          </span>
        </h1>
        <p>
          Upload a dance video and learn faster with AI-detected counts, custom
          looping/speed, and more!
        </p>

        <button
          className="home-btn-primary home-btn-hero"
          onClick={() => navigate("/login")}
        >
          Start Learning
        </button>

        {loading && <div className="home-demo-loading">Loading demo…</div>}

        {!loading && error && (
          <div className="home-demo-error">
            Demo video isn't available right now — sign up to try it with your
            own video.
          </div>
        )}

        {!loading && demoVideo && (
          <div className="home-demo-section">
            <span className="home-demo-badge">
              <span className="home-demo-badge-dot" aria-hidden="true" />
              Demo
            </span>
            <DanceViewerInline video={demoVideo} />
          </div>
        )}
      </main>
    </div>
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

function maxPanForZoom(zoom) {
  return zoom > 1 ? ((zoom - 1) / zoom) * 50 : 0;
}

// Identical to UploadDance.jsx's DanceViewerInline — same component, same
// classes, same behavior — so the demo on the public Home page looks and
// feels exactly like the authenticated viewer.
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
  const [playbackFeedback, setPlaybackFeedback] = useState(null);
  const playbackFeedbackTimeoutRef = useRef(null);
  const [loopPanelOpen, setLoopPanelOpen] = useState(false);
  const [draggingMarker, setDraggingMarker] = useState(null);
  const beatTimestamps = video.beat_timestamps || [];
  const beatCounts = video.counts || [];
  const [slideshowOn, setSlideshowOn] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [slideshowFrame, setSlideshowFrame] = useState(null);
  const [slideshowLoading, setSlideshowLoading] = useState(false);
  const [draggingTimeline, setDraggingTimeline] = useState(false);
  const slideshowTimelineRef = useRef(null);
  const canvasRef = useRef(null);
  const frameCacheRef = useRef({});

  const [cropMode, setCropMode] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPanX, setCropPanX] = useState(0);
  const [cropPanY, setCropPanY] = useState(0);
  const [draggingCrop, setDraggingCrop] = useState(false);
  const cropDragStartRef = useRef(null);

  const videoRef = useRef(null);
  const videoFrameRef = useRef(null);
  const scrubberWrapRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  useEffect(() => {
    return () => clearTimeout(playbackFeedbackTimeoutRef.current);
  }, []);

  function flashPlaybackFeedback(icon) {
    setPlaybackFeedback({ icon, key: Date.now() });
    clearTimeout(playbackFeedbackTimeoutRef.current);
    playbackFeedbackTimeoutRef.current = setTimeout(() => {
      setPlaybackFeedback(null);
    }, 550);
  }

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
      // Canvas tainted — video not served with CORS-enabled pixel reads.
    }
  }

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
      } else if (videoRef.current) {
        const resumeAt = loopStart !== null ? loopStart : 0;
        videoRef.current.currentTime = resumeAt;
        setCurrentTime(resumeAt);
      }
      return next;
    });
  }

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
    if (slideshowOn) return;
    function handleKeyDown(e) {
      if (e.code !== "Space" && e.key !== " ") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      togglePlay();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slideshowOn]);

  useEffect(() => {
    let frameId;
    function tick() {
      if (videoRef.current) {
        const t = videoRef.current.currentTime;
        setCurrentTime(t);

        if (
          !slideshowOn &&
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
  }, [sectionLooping, loopStart, loopEnd, slideshowOn]);

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
    if (!draggingCrop) return;

    function handleMove(e) {
      const start = cropDragStartRef.current;
      const frame = videoFrameRef.current;
      if (!start || !frame) return;
      const rect = frame.getBoundingClientRect();
      const dxPct = ((e.clientX - start.x) / rect.width) * 100;
      const dyPct = ((e.clientY - start.y) / rect.height) * 100;
      const limit = maxPanForZoom(cropZoom);
      setCropPanX(Math.max(-limit, Math.min(limit, start.panX + dxPct)));
      setCropPanY(Math.max(-limit, Math.min(limit, start.panY + dyPct)));
    }

    function handleUp() {
      setDraggingCrop(false);
      cropDragStartRef.current = null;
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingCrop, cropZoom]);

  useEffect(() => {
    const limit = maxPanForZoom(cropZoom);
    setCropPanX((x) => Math.max(-limit, Math.min(limit, x)));
    setCropPanY((y) => Math.max(-limit, Math.min(limit, y)));
  }, [cropZoom]);

  function scrubTimelineToClientX(clientX) {
    const el = slideshowTimelineRef.current;
    if (!el || beatTimestamps.length < 2) return;
    const rect = el.getBoundingClientRect();
    let frac = (clientX - rect.left) / rect.width;
    frac = Math.min(1, Math.max(0, frac));
    const first = beatTimestamps[0];
    const last = beatTimestamps[beatTimestamps.length - 1];
    const time = first + frac * (last - first);
    setSlideshowIndex(nearestBeatIndex(time, beatTimestamps));
  }

  function handleTimelinePointerDown(e) {
    if (beatTimestamps.length < 2) return;
    e.preventDefault();
    setDraggingTimeline(true);
    scrubTimelineToClientX(e.clientX);
  }

  useEffect(() => {
    if (!draggingTimeline) return;

    function handleMove(e) {
      scrubTimelineToClientX(e.clientX);
    }
    function handleUp() {
      setDraggingTimeline(false);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingTimeline, beatTimestamps]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === videoFrameRef.current);
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
      flashPlaybackFeedback("play");
    } else {
      videoRef.current.pause();
      setPlaying(false);
      flashPlaybackFeedback("pause");
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
    if (!videoFrameRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      videoFrameRef.current.requestFullscreen?.();
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

  function toggleLoopPanel() {
    setLoopPanelOpen((open) => {
      const next = !open;
      if (next) {
        if (loopStart !== null && loopEnd !== null) {
          setSectionLooping(true);
        } else {
          setLooping(true);
        }
      } else {
        setLooping(false);
        setSectionLooping(false);
        setLoopStart(null);
        setLoopEnd(null);
      }
      return next;
    });
  }

  function toggleCropMode() {
    setCropMode((open) => {
      const next = !open;
      if (next && videoRef.current) {
        videoRef.current.pause();
        setPlaying(false);
      }
      return next;
    });
  }

  function resetCrop() {
    setCropZoom(1);
    setCropPanX(0);
    setCropPanY(0);
  }

  function handleCropPointerDown(e) {
    if (!cropMode || cropZoom <= 1) return;
    e.preventDefault();
    setDraggingCrop(true);
    cropDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: cropPanX,
      panY: cropPanY,
    };
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
  const cropChanged = cropZoom !== 1 || cropPanX !== 0 || cropPanY !== 0;

  const slideshowCount =
    slideshowOn && beatCounts[slideshowIndex] != null
      ? beatCounts[slideshowIndex]
      : null;

  const videoTransform = [
    `scale(${cropZoom})`,
    `translate(${cropPanX}%, ${cropPanY}%)`,
    mirrored ? "scaleX(-1)" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const timelineFirst = beatTimestamps[0];
  const timelineLast = beatTimestamps[beatTimestamps.length - 1];
  const timelineRange = timelineLast - timelineFirst;

  return (
    <div className="viewer">
      <div className="viewer-video-wrap" ref={videoFrameRef}>
        <div className="viewer-video-frame">
          <video
            ref={videoRef}
            src={video.video_url}
            crossOrigin="anonymous"
            loop={looping && !sectionLooping}
            onClick={!slideshowOn && !cropMode ? togglePlay : undefined}
            onPointerDown={cropMode ? handleCropPointerDown : undefined}
            onLoadedMetadata={(e) => setDuration(e.target.duration)}
            onEnded={() => setPlaying(false)}
            style={{
              maxWidth: "100%",
              maxHeight: isFullscreen ? "calc(100vh - 64px)" : "75vh",
              width: "auto",
              height: "auto",
              transform: videoTransform,
              cursor: cropMode
                ? cropZoom > 1
                  ? draggingCrop
                    ? "grabbing"
                    : "grab"
                  : "default"
                : "pointer",
              opacity: slideshowOn ? 0 : 1,
              pointerEvents: slideshowOn ? "none" : "auto",
            }}
          />

          {!slideshowOn && showCounts && count !== null && (
            <span className="count-overlay" aria-hidden="true">
              {count}
            </span>
          )}

          {!slideshowOn && playbackFeedback && (
            <span
              key={playbackFeedback.key}
              className="play-feedback"
              aria-hidden="true"
            >
              {playbackFeedback.icon === "play" ? <PlayIcon /> : <PauseIcon />}
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
          <>
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

            {beatTimestamps.length > 1 && (
              <div
                className="slideshow-timeline"
                ref={slideshowTimelineRef}
                onPointerDown={handleTimelinePointerDown}
              >
                {beatTimestamps.map((t, i) => {
                  const leftPct =
                    timelineRange > 0
                      ? ((t - timelineFirst) / timelineRange) * 100
                      : 0;
                  return (
                    <div
                      key={i}
                      className={`slideshow-tick ${
                        i === slideshowIndex ? "slideshow-tick-active" : ""
                      }`}
                      style={{ left: `${leftPct}%` }}
                    />
                  );
                })}
              </div>
            )}
          </>
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

            {loopPanelOpen && (
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
                      className="loop-clear-btn"
                      onClick={clearLoopSection}
                      aria-label="Clear loop section"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            )}

            {cropMode && (
              <div className="loop-section-controls">
                <label className="viewer-speed">
                  Zoom
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={cropZoom}
                    onChange={(e) => setCropZoom(Number(e.target.value))}
                  />
                </label>
                <span className="loop-range-label">
                  {cropZoom > 1
                    ? "Drag the video to reposition"
                    : "Zoom in to crop"}
                </span>
                <button
                  type="button"
                  className="loop-clear-btn"
                  onClick={resetCrop}
                  disabled={!cropChanged}
                >
                  Reset
                </button>
              </div>
            )}
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
          className={`toggle-pill ${loopPanelOpen ? "toggle-pill-active" : ""}`}
          role="switch"
          aria-checked={loopPanelOpen}
          onClick={toggleLoopPanel}
        >
          Loop
        </button>

        <button
          type="button"
          className={`toggle-pill ${cropMode ? "toggle-pill-active" : ""}`}
          role="switch"
          aria-checked={cropMode}
          onClick={toggleCropMode}
        >
          Crop
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

function nearestBeatIndex(time, timestamps) {
  let closest = 0;
  let closestDiff = Infinity;
  for (let i = 0; i < timestamps.length; i++) {
    const diff = Math.abs(timestamps[i] - time);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = i;
    }
  }
  return closest;
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

export default Home;
