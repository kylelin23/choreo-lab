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
def detect_beats_and_sync(input_path: str, output_path: str) -> dict:

    raise NotImplementedError("detect_beats_and_sync() is not implemented yet")
