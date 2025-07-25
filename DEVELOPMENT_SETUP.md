# Development Setup Guide

## Prerequisites

- Node.js v18.20.0 or higher (LTS recommended, see `.nvmrc`)
- npm v8.x or higher

If using nvm:
```bash
nvm install
nvm use
```

## Initial Setup

When cloning the repository for the first time or pulling new changes:

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd claude-config
   ```

2. **Clean install dependencies**
   ```bash
   # Remove existing node_modules and lock file
   rm -rf node_modules packages/*/node_modules package-lock.json
   
   # Fresh install with lock file generation
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

## Common Issues

### "Cannot read properties of undefined (reading 'createContext')"

This error typically occurs when:
- Dependencies are out of sync
- The `package-lock.json` file is missing or outdated
- Different npm versions were used

**Solution:**
```bash
# Clean everything
rm -rf node_modules packages/*/node_modules package-lock.json

# Reinstall
npm install

# Rebuild
npm run build
```

### Ensuring Consistent Environments

Always:
1. Commit the `package-lock.json` file
2. Run `npm ci` instead of `npm install` when you have a lock file
3. Use the same Node.js version (check `.nvmrc` if present)

## Development Commands

- `npm run dev` - Start both server and app in development mode
- `npm run build` - Build all packages
- `npm test` - Run all tests
- `npm run lint` - Run linting

## Workspace Structure

This is a monorepo using npm workspaces:
- `/packages/shared` - Shared types and utilities
- `/packages/core` - Core business logic
- `/packages/server` - Express server
- `/packages/app` - React frontend