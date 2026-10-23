import { createApp } from "./app.js"

const port = process.env.PORT || 3001
createApp().listen(port, () => {
  console.log(`silov0 backend listening on http://localhost:${port}`)
})
