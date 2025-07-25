# claude-config
Experimental "vibe coded" application for managing Claude Code configuration

## Development Setup

For detailed setup instructions, see [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md).

### Quick Start

```bash
# Clone and install
git clone <repository-url>
cd claude-config
npm install

# Build all packages
npm run build

# Start development servers
npm run dev
```

### Troubleshooting

If you encounter issues like "Cannot read properties of undefined", try:

```bash
rm -rf node_modules packages/*/node_modules package-lock.json
npm install
npm run build
```
