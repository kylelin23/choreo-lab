## Choreo Video Library System Architecture

#### System Diagram
<img src="diagrams/architecture_diagram.png" alt="Architecture diagram" width="900" />

#### Frontend
The frontend is built with Vite and React. After authentication, it will let the user upload any dance video file they want and then process the video in the backend. The backend will then return a processed video that will help the user learn the dance better. Features of this app include counts synchronized to the dance video, custom looping and speed, video mirroring, and comparison dances side by side.

Here is a preview of the frontend file architecture.

```
src/
├── pages/
│   ├── Auth.css
│   ├── Auth.jsx          # Authentication page (starting page for user)
│   ├── Home.css
│   ├── Home.jsx          # Home page, where the user can access the app features such as counts synchronized to the dance video
│   ├── UploadDance.css
│   └── UploadDance.jsx   # Upload dance page, where the user uploads a dance video of their choice
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
The backend is written in Python/Flask. Here are the APIs used in the backend:
- Will add later

### Video Processing Flow
- User sends mp4 file over to backend in POST request
- Flask will upload the video to Amazon S3
- Flask will write the job status to DynamoDB and Redis
- Frontend gets job status and keeps polling Redis to see if video is processed
- Flask runs model in background thread and stores the processed video in Amazon S3
- Job status is updated, and frontend gets updated video from Amazon S3

### Model
The model handles the actual video processing. (Will add later)


### Data Storage
- Amazon DynamoDB: Database (user and video information)
- Amazon S3: Object storage (videos)
- Redis: Tracks state of video processing

### Containerization and Deployment
The app will be containerized in Docker and deployed on Amazon EC2.
