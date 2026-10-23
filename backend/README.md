# @timedilationv2/silov0-backend

Local Express API and reusable content helpers for silov0. Requires Node.js 18+.

```sh
npm ci
npm test
# In this same terminal:
export API_TOKEN="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
export CORS_ORIGINS=http://localhost:8000
npm run dev
```

The server listens on port 3001 (override with `PORT`) and uses
`../posts/posts.json`. Routes: `GET /api/posts`, `GET /api/posts/filter?tag=reference&q=filter`,
`POST /api/posts`, and `GET /health`. Successful post responses are arrays;
POST returns the updated array with status 201. Errors use `{"error":"message"}`.
Writes require an Authorization: Bearer token matching server-side API_TOKEN.
Startup rejects missing, short, or placeholder tokens. The server binds 127.0.0.1;
keep it local. See ../.env.example (not loaded automatically) and ../SECURITY.md.

Print a digest from any working directory with:

```sh
node /path/to/silov0/backend/bin/silov0-digest.js
```

The CLI resolves the repository data relative to its module, not the working directory.
Source URLs are included in Markdown output. See the [main README](../README.md)
for verified requests, validation rules, responses, demo setup, and troubleshooting.
