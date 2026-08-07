# Takes input_path as an input
# input_path is a file path to the raw video, just open it with some python video library
# output_path is a file path for the processed video.
# This function should process the video to output_path, adding counts and stuff
# Return a dictionary with this shape:
# {
#   "bpm": 128.0,
#   "beat_timestamps": [0.47, 0.94, 1.41, ...],
#   "counts": [1, 2, 3, 4, 1, 2, 3, 4, ...]
# }
# This dictionary will be used by the frontend later to edit the video
"""backend/processing/beat_sync.py

Detect the beat grid of a dance video, write a clean processed copy of it, and
return the beat/count data the frontend edits from. The count numbers are drawn
by the frontend, not burned into the video here.

    result = detect_beats_and_sync("raw.mp4", "processed.mp4")
    # -> {"bpm": 128.0, "beat_timestamps": [0.47, 0.94, ...], "counts": [1,2,3,4,1,2,3,4,...]}

Two Brains decide which beat is count "1":
  - Claude (default) reasons over the beat cues — best on tricky songs
    (syncopation, weak kicks, half-8-count offsets). Needs ANTHROPIC_API_KEY.
  - a deterministic kick-energy heuristic, used automatically when the LLM is
    disabled, has no key, or errors — so the endpoint always works offline.

TRAIN IT: Claude reads worked examples from BEAT_SYNC_EXAMPLES_PATH each run.
When it mislabels a song, correct it once and it learns:

    from backend.processing.beat_sync import add_example
    add_example("that_song.mp4", first_one_index=3, rationale="intro has a 3-beat pickup")

Dependencies: librosa, numpy, anthropic. ffmpeg (on PATH) transcodes the output
to web-friendly H.264/AAC; without it the source video is copied through as-is.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

# --- audio / detection knobs ----------------------------------------------- #
# 11025 Hz is plenty for beat + downbeat detection (the kick band tops out at
# 130 Hz, far below the 5.5 kHz Nyquist) and roughly halves the audio array and
# all spectral work vs 22050. Timing resolution drops to ~one 512-sample hop
# (~46 ms); raise back to 22050 if you need tighter beat timestamps.
AUDIO_SR = 11025
HOP_LENGTH = 512
LOW_BAND_HZ = (30.0, 130.0)
ENVELOPE_WINDOW = 1
BASS_PRESENCE_MIN = 0.03

# Count cycle. 4 -> "1 2 3 4 1 2 3 4" (beat within the 4/4 bar, the spec's
# example). Set 8 for full dancer 8-counts ("1..8") — that's where the LLM's
# count-1-vs-5 judgement pays off most.
COUNTS_PER_CYCLE = 8

# --- Brain (LLM) knobs ------------------------------------------------------ #
# Claude is on by default; set BEAT_SYNC_USE_LLM=0 to force the offline heuristic
# (useful for fast, free, deterministic API tests).
USE_LLM = os.environ.get("BEAT_SYNC_USE_LLM", "1") != "0"
LLM_MODEL = os.environ.get("BEAT_SYNC_MODEL", "claude-opus-4-8")
LLM_EFFORT = os.environ.get("BEAT_SYNC_EFFORT", "medium")   # low | medium | high | max
LLM_MAX_TOKENS = 4096

# Where training examples live. Claude reads these as few-shot precedents.
EXAMPLES_PATH = os.environ.get(
    "BEAT_SYNC_EXAMPLES_PATH",
    str(Path(__file__).with_name("beat_sync_examples.json")),
)

# Seed example, used until you create the examples file with add_example().
DEFAULT_EXAMPLES: list[dict] = [
    {
        "name": "steady_128bpm_kick_on_1_and_5",
        "bpm": 128.0,
        "beats": [
            {"index": 0, "time_sec": 0.500, "onset": 0.70, "kick": 1.00},
            {"index": 1, "time_sec": 0.969, "onset": 0.25, "kick": 0.18},
            {"index": 2, "time_sec": 1.438, "onset": 0.92, "kick": 0.22},
            {"index": 3, "time_sec": 1.906, "onset": 0.24, "kick": 0.15},
            {"index": 4, "time_sec": 2.375, "onset": 0.66, "kick": 0.80},
            {"index": 5, "time_sec": 2.844, "onset": 0.26, "kick": 0.17},
            {"index": 6, "time_sec": 3.313, "onset": 0.90, "kick": 0.20},
            {"index": 7, "time_sec": 3.781, "onset": 0.23, "kick": 0.16},
            {"index": 8, "time_sec": 4.250, "onset": 0.71, "kick": 0.98},
            {"index": 9, "time_sec": 4.719, "onset": 0.25, "kick": 0.18},
            {"index": 10, "time_sec": 5.188, "onset": 0.91, "kick": 0.21},
            {"index": 11, "time_sec": 5.656, "onset": 0.24, "kick": 0.15},
            {"index": 12, "time_sec": 6.125, "onset": 0.65, "kick": 0.79},
            {"index": 13, "time_sec": 6.594, "onset": 0.26, "kick": 0.17},
            {"index": 14, "time_sec": 7.063, "onset": 0.89, "kick": 0.20},
            {"index": 15, "time_sec": 7.531, "onset": 0.22, "kick": 0.16},
        ],
        "one_indices": [0, 8],
        "rationale": "Kick strongest on 0 and 8 (count 1); 4 and 12 second (count 5). "
                     "Beats 2/6/10/14 spike in onset not kick — snare on 3/7, not a 1.",
    }
]


# --------------------------------------------------------------------------- #
# Data model
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Beat:
    index: int
    time_sec: float
    onset: float   # full-band attack, 0..1
    kick: float    # low-band 30-130 Hz energy, 0..1


@dataclass
class BeatFacts:
    bpm: float
    duration_sec: float
    beats: list[Beat] = field(default_factory=list)
    bass_present: bool = True


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #
def detect_beats_and_sync(input_path: str, output_path: str) -> dict:
    audio, sr = _load_audio(input_path)
    facts = _detect_beats(audio, sr)

    beat_times = [b.time_sec for b in facts.beats]
    counts: list[int] = []
    if facts.beats:
        phase, detector = _resolve_downbeat(facts)
        counts = [((b.index - phase) % COUNTS_PER_CYCLE) + 1 for b in facts.beats]
        print(f"[beat_sync] downbeat via {detector}, phase {phase}, "
              f"{len(facts.beats)} beats @ {facts.bpm:.1f} bpm")

    _write_output(input_path, output_path)

    return {
        "bpm": round(float(facts.bpm), 2),
        "beat_timestamps": [round(float(t), 3) for t in beat_times],
        "counts": counts,
    }


# --------------------------------------------------------------------------- #
# The Ears
# --------------------------------------------------------------------------- #
def _load_audio(input_path: str) -> tuple[np.ndarray, int]:
    import librosa

    audio, sr = librosa.load(input_path, sr=AUDIO_SR, mono=True)
    return audio.astype(np.float32), int(sr)


def _detect_beats(audio: np.ndarray, sr: int) -> BeatFacts:
    import librosa

    if audio.size == 0:
        return BeatFacts(bpm=0.0, duration_sec=0.0, beats=[], bass_present=False)

    onset_env = librosa.onset.onset_strength(y=audio, sr=sr, hop_length=HOP_LENGTH)
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env, sr=sr, hop_length=HOP_LENGTH, units="frames"
    )
    beat_frames = np.asarray(beat_frames, dtype=int)
    bpm = float(np.atleast_1d(tempo)[0])
    duration = len(audio) / sr
    if beat_frames.size == 0:
        return BeatFacts(bpm=bpm, duration_sec=duration, beats=[], bass_present=False)

    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=HOP_LENGTH)
    onset_at = _normalise(_sample_peak(onset_env, beat_frames))
    low_env, bass_share = _low_band_energy(audio, sr)
    kick_at = _normalise(_sample_peak(low_env, beat_frames))

    beats = [
        Beat(index=i, time_sec=float(t), onset=float(o), kick=float(k))
        for i, (t, o, k) in enumerate(zip(beat_times, onset_at, kick_at))
    ]
    return BeatFacts(bpm=bpm, duration_sec=duration, beats=beats,
                     bass_present=bass_share >= BASS_PRESENCE_MIN)


def _sample_peak(envelope: np.ndarray, frames: np.ndarray) -> np.ndarray:
    w, n = ENVELOPE_WINDOW, len(envelope)
    out = np.zeros(len(frames))
    for i, f in enumerate(frames):
        lo, hi = max(0, f - w), min(n, f + w + 1)
        if hi > lo:
            out[i] = envelope[lo:hi].max()
    return out


def _low_band_energy(audio: np.ndarray, sr: int) -> tuple[np.ndarray, float]:
    """Per-hop kick-band energy + the band's share of total energy.

    A band-pass filter instead of a second full STFT: onset detection already
    pays for one STFT, and allocating another complex spectrogram just to read
    30-130 Hz is wasteful. sosfiltfilt is linear-time and allocates a single
    array the size of the audio, not a freq-by-frame matrix — the main
    memory/CPU saving on this path.
    """
    from scipy.signal import butter, sosfiltfilt

    nyq = 0.5 * sr
    # Guard tiny clips: sosfiltfilt needs a few times the filter length.
    if audio.size < 64:
        return np.zeros(1 + audio.size // HOP_LENGTH), 0.0

    sos = butter(4, [LOW_BAND_HZ[0] / nyq, min(LOW_BAND_HZ[1], 0.99 * nyq) / nyq],
                 btype="band", output="sos")
    low = sosfiltfilt(sos, audio).astype(np.float32)

    n_frames = 1 + audio.size // HOP_LENGTH
    per_frame = np.zeros(n_frames, dtype=np.float32)  # energy on librosa's hop grid
    for i in range(n_frames):
        seg = low[i * HOP_LENGTH:(i + 1) * HOP_LENGTH]
        if seg.size:
            per_frame[i] = float(np.dot(seg, seg))

    total = float(np.dot(audio, audio)) or 1.0
    return per_frame, float(per_frame.sum() / total)


def _normalise(values: np.ndarray) -> np.ndarray:
    if values.size == 0:
        return values
    ref = np.percentile(values, 95)
    return np.clip(values / ref, 0.0, 1.0) if ref > 0 else np.zeros_like(values)


# --------------------------------------------------------------------------- #
# The Brains: pick which beat is count "1"
# --------------------------------------------------------------------------- #
def _resolve_downbeat(facts: BeatFacts) -> tuple[int, str]:
    """Return (phase within COUNTS_PER_CYCLE, which brain decided it).

    Claude first (if enabled); on any failure fall back to the heuristic so the
    endpoint never hard-fails on a missing key or a flaky call.
    """
    if USE_LLM:
        try:
            ones = _llm_one_indices(facts)
            if ones:
                return min(ones) % COUNTS_PER_CYCLE, "llm"
        except Exception as exc:  # no key, no anthropic, network, parse, ...
            print(f"[beat_sync] LLM unavailable ({exc}); using heuristic")
    return _heuristic_phase(facts), "heuristic"


def _heuristic_phase(facts: BeatFacts) -> int:
    """The strongest-kick position in the cycle is count 1."""
    cue = np.array([b.kick if facts.bass_present else b.onset for b in facts.beats])
    scores = [cue[p::COUNTS_PER_CYCLE].mean() if cue[p::COUNTS_PER_CYCLE].size else 0.0
              for p in range(COUNTS_PER_CYCLE)]
    return int(np.argmax(scores))


# ---- Claude structured-output reasoning ----------------------------------- #
_SYSTEM = """\
You are a rhythm analyst for dancers. Find the 8-count grid of a song from \
measured audio facts.

An 8-count is eight beats, "1 2 3 4 5 6 7 8". In 4/4 it spans two measures: \
count 1 and count 5 are the measure downbeats, and count 1 is the strongest \
beat of the group.

Each beat has: index (0-based), time_sec, onset (full-band attack 0..1), \
kick (low-band 30-130 Hz energy 0..1). The kick marks the downbeat — count 1 \
usually has the strongest kick, count 5 the second. Snares sit on counts 3 and \
7 and show up in onset, not kick; do not mistake a strong snare for a "1". \
Count "1"s recur every 8 beats. If bass_present is false, rely on onset and \
periodicity and lower your confidence. Do not label a pickup/intro beat as a 1.

Return the 0-based indices of every count "1", the meter, a confidence in \
[0,1], one or two sentences of reasoning, and any flags."""

_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "one_indices": {"type": "array", "items": {"type": "integer"}},
        "meter": {"type": "string"},
        "confidence": {"type": "number"},
        "reasoning": {"type": "string"},
        "flags": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["one_indices", "meter", "confidence", "reasoning", "flags"],
    "additionalProperties": False,
}


def _llm_one_indices(facts: BeatFacts) -> list[int]:
    import anthropic  # resolves ANTHROPIC_API_KEY from env / an `ant auth login` profile

    client = anthropic.Anthropic()
    system, user = _build_prompt(facts, _load_examples())

    kwargs: dict[str, Any] = dict(
        model=LLM_MODEL,
        max_tokens=LLM_MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": LLM_EFFORT,
                       "format": {"type": "json_schema", "schema": _RESPONSE_SCHEMA}},
        thinking={"type": "adaptive"},
    )
    response = client.messages.create(**kwargs)
    text = next((b.text for b in response.content if getattr(b, "type", None) == "text"), None)
    if text is None:
        raise ValueError("model returned no text block")
    data = json.loads(text)
    n = len(facts.beats)
    return sorted(i for i in (int(x) for x in data.get("one_indices", [])) if 0 <= i < n)


def _build_prompt(facts: BeatFacts, examples: list[dict]) -> tuple[str, str]:
    system = _SYSTEM
    if examples:
        system += "\n\nWORKED EXAMPLES\n" + "\n\n".join(
            f"[{e['name']}] bpm {e['bpm']:.0f}\n{_beat_table(e['beats'])}\n"
            f"count-1 indices: {e['one_indices']}"
            + (f"\nwhy: {e['rationale']}" if e.get("rationale") else "")
            for e in examples
        )
    rows = [{"index": b.index, "time_sec": round(b.time_sec, 3),
             "onset": round(b.onset, 3), "kick": round(b.kick, 3)} for b in facts.beats]
    user = (
        f"Song facts:\nbpm: {facts.bpm:.1f}\nduration_sec: {facts.duration_sec:.1f}\n"
        f"bass_present: {facts.bass_present}\n"
        f"beats (index | time_sec | onset | kick):\n{_beat_table(rows)}\n\n"
        f'Respond with the count-"1" beat indices for THIS song.'
    )
    return system, user


def _beat_table(rows: list[dict]) -> str:
    return "\n".join(
        f"{r['index']:>3} | {r['time_sec']:>7.3f} | {r['onset']:.3f} | {r['kick']:.3f}"
        for r in rows
    )


# --------------------------------------------------------------------------- #
# Training: teach the LLM by adding corrected examples
# --------------------------------------------------------------------------- #
def _load_examples() -> list[dict]:
    path = Path(EXAMPLES_PATH)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return DEFAULT_EXAMPLES


def add_example(
    input_path: str,
    *,
    one_indices: list[int] | None = None,
    first_one_index: int | None = None,
    name: str | None = None,
    rationale: str = "",
) -> dict:
    """Add a corrected song to the training set so the LLM learns from it.

    Give the correct answer either as the full list of count-"1" beat indices
    (``one_indices``) or, more simply, as the beat index of the first true
    count "1" (``first_one_index``) — the rest are inferred at a stride of 8.
    Persists to BEAT_SYNC_EXAMPLES_PATH and returns the stored example.
    """
    audio, sr = _load_audio(input_path)
    facts = _detect_beats(audio, sr)
    n = len(facts.beats)

    if one_indices is None:
        if first_one_index is None:
            raise ValueError("pass one_indices or first_one_index")
        one_indices = list(range(first_one_index, n, 8))
    one_indices = sorted(i for i in one_indices if 0 <= i < n)

    example = {
        "name": name or Path(input_path).stem,
        "bpm": round(facts.bpm, 2),
        "beats": [{"index": b.index, "time_sec": round(b.time_sec, 3),
                   "onset": round(b.onset, 3), "kick": round(b.kick, 3)}
                  for b in facts.beats],
        "one_indices": one_indices,
        "rationale": rationale,
    }

    examples = _load_examples()
    examples = [e for e in examples if e.get("name") != example["name"]] + [example]
    Path(EXAMPLES_PATH).write_text(json.dumps(examples, indent=2), encoding="utf-8")
    print(f"[beat_sync] saved example {example['name']!r} to {EXAMPLES_PATH} "
          f"({len(examples)} total)")
    return example


# --------------------------------------------------------------------------- #
# The Hands: write the processed video (the frontend draws the counts)
# --------------------------------------------------------------------------- #
def _write_output(input_path: str, output_path: str) -> None:
    """Write the source video to output_path in a web-friendly form.

    Count numbers are no longer burned in here — the frontend overlays them from
    the returned beat_timestamps/counts. We just hand back a clean, playable
    copy: an H.264/AAC transcode (with faststart for streaming) when ffmpeg is
    available, otherwise a straight copy of the original file.
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    # Nothing to do if the caller points input and output at the same file.
    if out.resolve() == Path(input_path).resolve():
        return

    if shutil.which("ffmpeg"):
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-movflags", "+faststart",
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode == 0 and out.exists():
            return  # transcoded successfully

    shutil.copyfile(input_path, output_path)  # fallback: copy the source through


if __name__ == "__main__":
    import sys

    print(json.dumps(detect_beats_and_sync(sys.argv[1], sys.argv[2]), indent=2))

