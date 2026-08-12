## Choreo Lab System Architecture

#### System Diagram
<img src="diagrams/architecture_diagram.png" alt="Architecture diagram" width="900" />

#### Frontend
The frontend is built with Vite and React. After authentication, it will let the user upload any dance video file they want and then process the video in the backend. The backend will then return a processed video that will help the user learn the dance better. Features of this app include counts synchronized to the dance video, custom looping and speed, video mirroring, and comparison dances side by side.

Here is a preview of the frontend file architecture.

```
src/
├── pages/
│   ├── Auth.css
│   ├── Auth.jsx          # Authentication page
│   ├── Home.css
│   ├── Home.jsx          # Home page (starting page for the user)
│   ├── UploadDance.css
│   └── UploadDance.jsx   # Page where user uploads their dance video and views and edits their processed video
├── App.jsx
├── index.css
├── main.jsx              # App entry point
```


### Authentication
Authentication is handled by Flask, backed by a Users table in DynamoDB. It uses three APIs:
- **Register**: Creates a new entry in the DynamoDB `Users` table hashed by bcrypt
- **Login**: Verifies credentials against the `Users` table and issues a JWT token
- **Logout**: Token ID stored in Redis to track which users are logged out

API endpoints are protected and check for a valid JWT token.

### APIs
The backend is written in Python/Flask, and are rate limited to prevent malicious cyber attacks. Here are the APIs used in the backend:

| Endpoint | Method | Description |
|---|---|---|
| `/api/videos/upload` | POST | Accepts an mp4/mov file and returns a `video_id` corresponding to the uploaded video. Uploads the raw video to S3, writes a job record to DynamoDB, and sends message to SQS. |
| `/api/videos/status/<video_id>` | GET | Returns the current processing status (`processing`, `done`, or `failed`) from DynamoDB. Used to poll if the video is done processing. |
| `/api/videos/<video_id>` | GET | Returns a presigned S3 URL for the processed video and beat data when a user clicks on a video in the library list view. |
| `/api/videos` | GET | Returns all videos belonging to the current user for the library list view. |
| `/api/videos/<video_id>` | PATCH | Allows user to give the video a custom name. |
| `/api/videos/<video_id>` | DELETE | Deletes a video's S3 objects and DynamoDB record. |

### Video Processing Flow
- User sends video file over to backend with `POST /api/videos/upload`
- Raw video uploaded to Amazon S3 and job record written to Amazon DynamoDB
- Frontend gets video ID back and polls using `GET /api/videos/status/<id>` to see if that video ID is processed
- Flask sends a message to SQS
- SQS triggers Lambda and runs `beat_sync.py`, which processes the video, adding 8-counts
- Processed video is uploaded back to Amazon S3 and DynamoDB job status is updated
- Frontend polling finally succeeds because of updated state in DynamoDB and calls `GET /api/videos/<id>`
- Presigned URL is returned and frontend uses that to get processed video from S3

### Model
- Takes a raw dance video and works out its rhythm.
- Returns the tempo (BPM), the timestamp of every beat, and the count for each beat (1, 2, 3, 4…).
- Also saves a copy of the video with those counts shown on screen in time with the music.
- Uses the librosa library to find the beats, and ClaudeAPI to decide which beat is the "1."
- Falls back to a simpler rule when no API key is set, so it always produces a result.
- Can be corrected by teaching it a song it gets wrong.


### Data Storage
- Amazon DynamoDB: Database (user and video information)
- Amazon S3: Object storage (videos)
- Redis: Auth token blocklist and rate-limiting counters
- Amazon SQS: Job queue for triggering video processing

### Containerization and Deployment
The app is containerized using Docker and deployed on Amazon EC2.
