# Claude Config Server

Express.js API server for the Claude Configuration Manager application.

## Features

- RESTful API for file system operations
- Security controls for file access
- Support for configuration file operations
- CORS enabled for client integration

## Security

### File System Access Control

The server implements path validation and access control to prevent unauthorized file access:

- **Path Validation**: All file paths are validated and normalized to prevent directory traversal attacks
- **Allowed Base Paths**: File access is restricted to configured base directories
- **Null Byte Protection**: Prevents null byte injection attacks

### Configuration

Set the `ALLOWED_BASE_PATHS` environment variable to control which directories the server can access:

```bash
# Allow access to specific directories (recommended for production)
ALLOWED_BASE_PATHS="/var/www/projects,/opt/app/data"

# Development - allow access to user directories
ALLOWED_BASE_PATHS="/Users/username/projects,/Users/username/Documents"
```

If `ALLOWED_BASE_PATHS` is not set, the server defaults to allowing access to the user's home directory.

## API Endpoints

### File System Operations

- `GET /api/filesystem/directory?path={path}` - List directory contents
- `GET /api/filesystem/file?path={path}` - Read file content
- `POST /api/filesystem/file` - Create or update file
- `DELETE /api/filesystem/file?path={path}` - Delete file
- `POST /api/filesystem/directory` - Create directory
- `POST /api/filesystem/search` - Search files
- `GET /api/filesystem/tree?path={path}` - Get file tree

### Health Check

- `GET /health` - Server health status

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

- `PORT` - Server port (default: 5001)
- `CLIENT_URL` - Allowed client origin for CORS (default: http://localhost:3000)
- `ALLOWED_BASE_PATHS` - Comma-separated list of allowed base paths for file access
