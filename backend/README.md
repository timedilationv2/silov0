# @timedilationv2/silov0-backend

Local Express API and reusable content helpers for silov0. Requires Node.js 18+.

```sh
npm ci
npm test
npm run dev
```

The server listens on port 3001 (override with `PORT`) and uses
`../posts/posts.json`. Routes: `GET /api/posts`, `GET /api/posts/filter?tag=ai&q=digest`,
`POST /api/posts`, and `GET /health`. Successful post responses are arrays;
POST returns the updated array with status 201. Errors use `{"error":"message"}`.
No authentication is implemented; run the writable API locally.

Print a digest from any working directory with:

```sh
node /path/to/silov0/backend/bin/silov0-digest.js
```

The CLI resolves the repository data relative to its module, not the working directory.
Source URLs are included in Markdown output. See the [main README](../README.md)
for verified requests, validation rules, responses, demo setup, and troubleshooting.
