import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from routes.auth import auth_bp

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ["FLASK_SECRET_KEY"]
CORS(app, origins=["http://localhost:5173"])

app.register_blueprint(auth_bp)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
