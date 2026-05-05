# IntelliTest Website Structure

## Overview

The website folder contains the frontend application that communicates with the backend API.

## Folder Structure

```
website/
├── config.js              # API configuration (backend URL)
├── Nav/
│   ├── Nav.html           # Shared top header markup
│   ├── Nav.css            # Shared top header styling
│   └── Nav.js             # Shared header loader
├── Landing/
│   ├── Landing.html       # Home page content
│   └── Landing.css        # Landing page styling
├── Views/
│   ├── Demo.html          # "Try it yourself" page
│   ├── Demo.js            # Demo page bootstrap entrypoint
│   └── Demo.css           # Demo page styling
├── Controller/
│   └── DemoController.js  # Demo page UI state, rendering, and event handling
└── Route/
  └── DemoRoute.js       # Demo page API routing and request helpers
```

## Key Files

### 1. `config.js` - API Configuration
- **Purpose:** Centralized configuration for API endpoints
- **Usage:** Import and use `getApiUrl()` to get full endpoint URLs
- **Customization:** Change `BASE_URL` based on your environment

### 2. `Views/Demo.html` - Main Demo Page
- **Purpose:** Form interface for the "Try it yourself" section
- **Features:**
  - Language and framework selection
  - Code input textarea
  - Test prompt input
  - Results display area

### 3. `Views/Demo.js` - Demo Bootstrap
- **Purpose:** Initializes the demo page controller

### 4. `Controller/DemoController.js` - Demo Page UI Logic
- **Purpose:** Handles DOM state, rendering, clipboard actions, and form events
- **Key Functions:**
  - `initializeDemoPage()` - Sets up the demo page interactions

### 5. `Route/DemoRoute.js` - Demo API Routing
- **Purpose:** Encapsulates backend request URLs and fetch calls
- **Key Functions:**
  - `requestTestCases()` - Calls `/generate-testcases` endpoint
  - `requestTestCode()` - Calls `/generate-tests` endpoint

### 6. `Views/Demo.css` - Demo Page Styling
- **Purpose:** Provides styling for the demo page
- **Features:**
  - Responsive design
  - Dark code block styling
  - Loading spinner
  - Error styling

### 7. `Landing/Landing.html` - Home Page
- **Purpose:** Landing page with navigation
- **Links:**
  - Home → Landing.html
  - Try yourself → Views/Demo.html

## How It Works

1. **User visits Landing page** (`Landing.html`)
2. **User clicks "Try yourself"** → Navigates to Demo page (`Demo.html`)
3. **User fills the form:**
   - Selects language and framework
   - Pastes function code
   - Enters test prompt
4. **User clicks "Generate Test Cases":**
  - `DemoController.js` gathers the form data
  - `DemoRoute.js` calls the backend `/generate-testcases` endpoint
   - Backend processes and returns test cases
  - `DemoController.js` renders the results
5. **User can click "Generate Test Code":**
  - `DemoController.js` gathers the form data and generated test cases
  - `DemoRoute.js` calls the backend `/generate-tests` endpoint
   - Backend generates test code
  - `DemoController.js` renders the code
   - User can copy the code

## Supported Languages & Frameworks

### Languages
- JavaScript
- Python
- Java
- TypeScript
- C#
- Go

### Testing Frameworks
- Jest (JavaScript)
- Mocha (JavaScript)
- Vitest (TypeScript/JavaScript)
- Pytest (Python)
- JUnit (Java)
- Unittest (Python)
- xUnit (C#)
- TestNG (Java)

Add more by editing the `<select>` elements in `Views/Demo.html`.

## Deployment

### Development
```bash
# Terminal 1: Backend
cd Server && npm run dev

# Terminal 2: Website
cd website && python -m http.server 8000
```

### Production
1. **Frontend:** Deploy `website` folder to static hosting (Netlify, Vercel, etc.)
2. **Backend:** Deploy `Server` folder to server (Render, Heroku, AWS, etc.)
3. **Update Config:** Change `API_CONFIG.BASE_URL` in `config.js` to production API URL

## Adding New Features

### Adding a New Language
1. Edit `Views/Demo.html` - Add option to language `<select>`
2. Update backend framework support if needed

### Customizing Styling
1. Edit `Views/Demo.css` for demo page styling
2. Edit `Nav/Nav.css` for shared header styling

### Adding New API Endpoints
1. Update `config.js` with new endpoint
2. Add API call function in `Route/DemoRoute.js`
3. Add form section in `Views/Demo.html`

## Troubleshooting

**API calls failing:**
- Check backend is running on correct port
- Verify `API_CONFIG.BASE_URL` in `config.js`
- Check browser DevTools Network tab

**Styling issues:**
- Clear browser cache
- Check file paths in HTML (use absolute paths from website root)

**Form validation:**
- All fields are required
- Browser will show validation messages
- Check console for JavaScript errors

---

See `SETUP_GUIDE.md` for detailed setup and deployment instructions.
