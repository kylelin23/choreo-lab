from flask import Blueprint, request, jsonify

from apis.upload_video import upload_video
from apis.video_status import get_video_status
from apis.get_video import get_video
from apis.list_videos import list_videos
from apis.delete_video import delete_video
from apis.rename_video import rename_video
from routes.auth import get_payload_or_error
from extensions import limiter

videos_bp = Blueprint('videos', __name__)


@videos_bp.route('/api/videos/upload', methods=['POST'])
@limiter.limit("10 per hour")
def upload_route():
    payload, error = get_payload_or_error()
    if error:
        return jsonify({"error": error}), 401

    if "video" not in request.files:
        return jsonify({"error": "no video file provided"}), 400

    video_id, error = upload_video(request.files["video"], payload["sub"])
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"video_id": video_id}), 202


@videos_bp.route('/api/videos/status/<video_id>', methods=['GET'])
@limiter.limit("60 per minute")
def status_route(video_id):
    payload, error = get_payload_or_error()
    if error:
        return jsonify({"error": error}), 401

    status, error = get_video_status(video_id)
    if error:
        return jsonify({"error": error}), 404

    return jsonify({"status": status})


@videos_bp.route('/api/videos/<video_id>', methods=['GET'])
@limiter.limit("30 per minute")
def get_video_route(video_id):
    payload, error = get_payload_or_error()
    if error:
        return jsonify({"error": error}), 401

    result, error, status_code = get_video(video_id, payload["sub"])
    if error:
        return jsonify({"error": error}), status_code

    return jsonify(result), status_code


@videos_bp.route('/api/videos/<video_id>', methods=['DELETE'])
@limiter.limit("20 per hour")
def delete_video_route(video_id):
    payload, error = get_payload_or_error()
    if error:
        return jsonify({"error": error}), 401

    error, status_code = delete_video(video_id, payload["sub"])
    if error:
        return jsonify({"error": error}), status_code

    return jsonify({"status": "deleted"}), status_code


@videos_bp.route('/api/videos', methods=['GET'])
@limiter.limit("30 per minute")
def list_videos_route():
    payload, error = get_payload_or_error()
    if error:
        return jsonify({"error": error}), 401

    videos = list_videos(payload["sub"])
    return jsonify({"videos": videos})


@videos_bp.route('/api/videos/<video_id>', methods=['PATCH'])
@limiter.limit("20 per hour")
def rename_video_route(video_id):
    payload, error = get_payload_or_error()
    if error:
        return jsonify({"error": error}), 401

    data = request.json or {}
    error, status_code = rename_video(
        video_id, payload["sub"], data.get("name"))
    if error:
        return jsonify({"error": error}), status_code

    return jsonify({"status": "renamed"}), status_code
