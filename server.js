import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || process.env.WEBSITES_PORT || 8080;

// Log startup information
console.log('Starting server...');
console.log('Current directory:', __dirname);
console.log('Port:', port);
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

// Check if dist directory exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.warn('Warning: dist directory not found at:', distPath);
  console.warn('Creating basic index.html...');
  
  // Create a basic fallback
  fs.mkdirSync(distPath, { recursive: true });
  fs.writeFileSync(path.join(distPath, 'index.html'), `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Loading...</title>
    </head>
    <body>
        <h1>Application is starting...</h1>
        <p>Please wait while the application builds.</p>
    </body>
    </html>
  `);
} else {
  console.log('Found dist directory at:', distPath);
}

// Security and HTTPS middleware
app.use((req, res, next) => {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  
  // Security headers for microphone access
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy for microphone access
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
  
  // Content Security Policy - allow microphone access
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "media-src 'self' blob:; " +
    "connect-src 'self' wss: https:; " +
    "font-src 'self'; " +
    "frame-src 'none';"
  );
  
  next();
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: port,
    distExists: fs.existsSync(path.join(__dirname, 'dist'))
  });
});

// API endpoint for testing
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Handle client-side routing by serving index.html for all non-API routes
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  console.log(`Request for: ${req.url}, serving index.html from: ${indexPath}`);
  
  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found at:', indexPath);
    return res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Application Error</h1>
          <p>The application is not properly built. Please check the deployment logs.</p>
          <p>Looking for: ${indexPath}</p>
        </body>
      </html>
    `);
  }
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Internal Server Error');
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).send('Something went wrong!');
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${port}`);
  console.log(`🌐 Health check: http://localhost:${port}/health`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'dist')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
