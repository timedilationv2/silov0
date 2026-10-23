import { createApp } from "./app.js"

const port = process.env.PORT || 3001
createApp().listen(port, "127.0.0.1", () => {
  console.log(`silov0 backend listening on http://localhost:${port}`)
})
