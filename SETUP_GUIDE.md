# IntelliTest Website & Backend Setup

This document explains how to run the website as a separate frontend application that communicates with the backend API.

## Architecture Overview

```
┌─────────────────────┐                    ┌──────────────────────┐
│  Website Frontend   │  ◄──POST requests──┤   Backend Server     │
│  (website/ folder)  │     /generate-*    │  (Server/ folder)    │
│                     │                    │                      │
│ - Landing page      │   JSON responses   │ - API endpoints      │
│ - Demo page         │──────────────────► │ - LLM integration    │
│ - Static files      │                    │ - Test generation    │
│                     │                    │                      │
└─────────────────────┘                    └──────────────────────┘
   Port: 8000+                                Port: 3000 (default)
   (or any static server)                     (Node.js server)
```

## Prerequisites

- **Node.js** v18+ (for the backend server)
- **npm** (comes with Node.js)
- **Python** 3.8+ (for running a simple HTTP server for the website, or use any static server)
- **Ollama** or **OpenAI API key** (for the LLM backend)

## Setup Instructions

### Step 1: Set Up the Backend Server

1. Navigate to the Server directory:
   ```bash
   cd Server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the `Server` directory and configure it:

   **For local Ollama (default):**
   ```env
   PORT=3000
   LLM_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   NODE_ENV=development
   ```

   **For OpenAI API:**
   ```env
   PORT=3000
   LLM_PROVIDER=api
   API_BASE_URL=https://api.openai.com/v1
   API_KEY=your-openai-api-key
   API_MODEL=gpt-4o-mini
   NODE_ENV=development
   ```

4. Start the backend server:
   ```bash
   npm run dev
   ```

   You should see output like:
   ```
   [info] server_listening { port: 3000, provider: 'ollama' }
   ```

The backend API is now running at `http://localhost:3000`.

### Step 2: Configure the Website Frontend

1. Open `website/config.js` and update the `BASE_URL` if needed:

   ```javascript
   export const API_CONFIG = {
     BASE_URL: 'http://localhost:3000', // Change this for production
     // ...
   };
   ```

   - **For local development:** `http://localhost:3000`
   - **For production:** `https://api.your-app.com`

### Step 3: Serve the Website Locally

Choose one of the following methods:

#### Option A: Using Python (Simplest)

```bash
cd website
python -m http.server 8000
```

Visit `http://localhost:8000/Landing/Landing.html` in your browser.

#### Option B: Using Node.js (http-server)

```bash
npm install -g http-server
cd website
http-server . -p 8000
```

Visit `http://localhost:8000/Landing/Landing.html` in your browser.

#### Option C: Using VS Code Live Server Extension

1. Install the **Live Server** extension in VS Code
2. Right-click on `website/Landing/Landing.html` and select "Open with Live Server"

---

## Testing the Setup

1. **Start the Backend Server** (in one terminal):
   ```bash
   cd Server
   npm run dev
   ```

2. **Serve the Website** (in another terminal):
   ```bash
   cd website
   python -m http.server 8000
   ```

3. **Open the Demo Page** in your browser:
   - Visit `http://localhost:8000/Landing/Landing.html`
   - Click on "Try yourself" to go to the demo page
   - Fill out the form and click "Generate Test Cases"

---

## API Endpoints Reference

All endpoints are prefixed with your backend URL (e.g., `http://localhost:3000`):

### 1. Generate Test Cases
- **Endpoint:** `POST /generate-testcases`
- **Body:**
  ```json
  {
    "type": "function",
    "language": "javascript",
    "framework": "jest",
    "prompt": "Test with edge cases",
    "modules": ["function add(a, b) { return a + b; }"]
  }
  ```
- **Response:**
  ```json
  {
    "testCases": [
      {
        "id": "1",
        "name": "Test addition",
        "steps": ["Call add(1, 2)"],
        "expected": "Should return 3"
      }
    ]
  }
  ```

### 2. Generate Test Code
- **Endpoint:** `POST /generate-tests`
- **Body:** Same as above + `testCases` array
- **Response:**
  ```json
  {
    "script": {
      "framework": "jest",
      "code": "test('Test addition', () => { expect(add(1, 2)).toBe(3); });"
    }
  }
  ```

### 3. Analyze Failure
- **Endpoint:** `POST /analyze-failure`
- **Body:**
  ```json
  {
    "error": "AssertionError: expected 5 to be 3",
    "test": "test('Test addition', () => { expect(add(2, 3)).toBe(3); });"
  }
  ```

---

## Deployment Guide

### Frontend Deployment (Website)

Options:
- **Netlify:** Drag and drop the `website` folder
- **Vercel:** Connect your GitHub repo
- **GitHub Pages:** Push the website files to the `gh-pages` branch
- **AWS S3 + CloudFront:** Upload files to an S3 bucket and use CloudFront
- **Traditional Hosting:** FTP upload to any static hosting provider

After deployment, update `website/config.js` to point to your production API URL.

### Backend Deployment

Options:
- **Render.com:** Push to GitHub and connect
- **Heroku:** `git push heroku main`
- **AWS EC2/Elastic Beanstalk:** Deploy Node.js application
- **DigitalOcean:** Deploy with App Platform or Droplets
- **Traditional VPS:** SSH into your server and run `npm start`

Set the `PORT` environment variable on your hosting platform (e.g., Heroku automatically sets it).

---

## Troubleshooting

### CORS Errors

**Issue:** "Access to XMLHttpRequest blocked by CORS policy"

**Solution:**
- The backend already has `cors` enabled, but verify:
  - Backend is running on the correct port
  - Frontend URL matches the CORS configuration
  - Check browser DevTools Network tab for the actual error

### Backend Not Responding

**Issue:** Cannot connect to `http://localhost:3000`

**Troubleshooting:**
1. Check that the backend server is running:
   ```bash
   curl http://localhost:3000/health
   ```
   Should return: `{"ok":true,"service":"intilitest-backend"}`

2. Check the `PORT` environment variable is correct

3. Look for error messages in the terminal where the server is running

### LLM Not Responding

**Issue:** Error like "Ollama request failed"

**Troubleshooting:**
1. If using Ollama:
   - Ensure Ollama is installed and running
   - Check `http://localhost:11434/api/chat` is accessible
   - Verify the model name in `.env` (e.g., `llama3.2`)

2. If using OpenAI:
   - Verify your API key is correct in `.env`
   - Check that your OpenAI account has available credits
   - Verify the API key is not expired or revoked

### Static Files Not Loading

**Issue:** CSS and images not loading on the website

**Troubleshooting:**
1. Ensure you're serving from the correct directory (`website`)
2. Check file paths use forward slashes: `/Views/Demo.html`
3. Verify `website/config.js` is correctly linked in HTML files

---

## Environment Variables

### Backend (Server/.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `LLM_PROVIDER` | ollama | LLM provider (`ollama` or `api`) |
| `OLLAMA_BASE_URL` | http://localhost:11434 | Ollama server URL |
| `OLLAMA_MODEL` | llama3.2 | Ollama model name |
| `API_BASE_URL` | - | OpenAI API base URL (required if using `api` provider) |
| `API_KEY` | - | OpenAI API key (required if using `api` provider) |
| `API_MODEL` | gpt-4o-mini | OpenAI model name |
| `NODE_ENV` | development | Environment mode |

### Frontend (website/config.js)

| Variable | Default | Description |
|----------|---------|-------------|
| `API_CONFIG.BASE_URL` | http://localhost:3000 | Backend API base URL |

---

## Quick Start (Development)

Terminal 1 - Backend:
```bash
cd Server
npm install
npm run dev
```

Terminal 2 - Website:
```bash
cd website
python -m http.server 8000
```

Then open: `http://localhost:8000/Landing/Landing.html`

---

## Next Steps

1. ✅ **Set up the backend and frontend** (this guide)
2. 📝 **Test the Demo page** with sample code
3. 🎨 **Customize the UI** to match your branding
4. 📊 **Add more programming languages** and frameworks
5. 🚀 **Deploy to production**

Good luck with IntelliTest!
