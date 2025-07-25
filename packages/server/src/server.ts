import app from './app.js';

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 API endpoints: http://localhost:${PORT}/api`);
  console.log(`📍 Process Info:`, {
    platform: process.platform,
    cwd: process.cwd(),
    nodeVersion: process.version,
    isElevated: process.platform === 'win32' && (process.env.USERNAME === 'Administrator' || false),
    appDataLocal: process.env.LOCALAPPDATA,
    userProfile: process.env.USERPROFILE,
  });
});