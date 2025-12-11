
# @timedilationv2/silov0-backend

# silov0-backend


Backend helpers for the **silov0** AI news micro-blog.

- Stores posts in `../posts/posts.json`
- Provides pure functions for loading, filtering, and tagging
- Exposes an optional Express server for `/api/posts`

- Ships a small `silov0-digest` CLI to print a Markdown digest from `posts.json`





```bash
cd backend
npm install
npm run dev   # Starts Express on http://localhost:3001
```


CLI:

```bash
cd backend
npm install
npx silov0-digest
```


Routes:
- GET /api/posts – full list
- GET /api/posts/filter?tag=models&q=latency – filtered view
- POST /api/posts – add a new post (JSON body)

That's enough backend to look like a real, reusable package.
