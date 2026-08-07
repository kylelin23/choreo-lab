from routes.videos import videos_bp
from routes.auth import auth_bp
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from flask_limiter.errors import RateLimitExceeded

from extensions import limiter

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ["FLASK_SECRET_KEY"]
app.config["RATELIMIT_STORAGE_URI"] = os.environ["REDIS_URL"]
CORS(app, origins=["http://localhost:5173", "http://18.237.24.57:5173"])

limiter.init_app(app)


@app.errorhandler(RateLimitExceeded)
def handle_rate_limit(e):
    return jsonify({"error": "Too many requests — please slow down and try again shortly."}), 429


app.register_blueprint(auth_bp)
app.register_blueprint(videos_bp)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
