# claude-config
Experimental "vibe coded" application for managing Claude Code configuration

# Docker Quick Start

## Prerequisites
- Docker installed and running
- Ports 3000 and 3001 available

## Quick Start Commands

```bash
# 1. Build the Docker image
sudo docker build -t claude-config .

# 2. Run the container
sudo docker run -d --name claude-config-app -p 3000:3000 -p 3001:3001 claude-config

# 3. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001

# 4. View logs (optional)
sudo docker logs -f claude-config-app

# 5. Stop the container
sudo docker stop claude-config-app

# 6. Remove the container (when done)
sudo docker rm claude-config-app
```

## What's Included
- React frontend (port 3000)
- Express backend (port 3001)
- TypeScript monorepo structure
- All dependencies containerized

## Troubleshooting
- If build fails: Ensure Docker daemon is running
- If ports conflict: Change the port mapping (e.g., `-p 8080:3000`)
- If container exits: Check logs with `sudo docker logs claude-config-app`