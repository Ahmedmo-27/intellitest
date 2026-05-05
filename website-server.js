import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const websiteRoot = path.join(__dirname, 'website');
const landingRoot = path.join(websiteRoot, 'Landing');

// Serve only the assets the landing page needs.
app.use('/Landing', express.static(landingRoot));
app.use('/Nav', express.static(path.join(websiteRoot, 'Nav')));
app.use('/static', express.static(path.join(websiteRoot, 'static')));
app.use('/Views', express.static(path.join(websiteRoot, 'Views')));
app.use('/Controller', express.static(path.join(websiteRoot, 'Controller')));
app.use('/Route', express.static(path.join(websiteRoot, 'Route')));

// Catch-all: send Landing.html for every other URL.
app.get('*', (_req, res) => {
  res.sendFile(path.join(landingRoot, 'Landing.html'));
});

const port = process.env.WEBSITE_PORT || 8000;
app.listen(port, () => {
  console.log(`Website server running at http://localhost:${port}`);
  console.log(`Visit: http://localhost:${port}`);
});
