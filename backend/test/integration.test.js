import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { createApp } from "../src/app.js"
import { createContentService } from "../src/service.js"
import { normalizePost } from "../src/postsStore.js"

const post = { id: "one", title: "A note", date: "2024-02-29", summary: "", tags: ["ai"], url: "https://example.com/source" }

test("normalization validates calendar dates and field types", () => {
  for (const date of ["2023-02-29", "2024-02-30", "2024-13-01", "2024-1-01", "bad", 42]) {
    assert.throws(() => normalizePost({ ...post, date }), /date/)
  }
  for (const invalid of [null, [], {}, { ...post, title: 4 }, { ...post, title: " " },
    { ...post, tags: [42] }, { ...post, tags: "ai" }, { ...post, summary: {} },
    { ...post, id: " " }, { ...post, url: 5 }]) {
    assert.throws(() => normalizePost(invalid))
  }
  assert.equal(normalizePost(post).url, post.url)
  assert.deepEqual(normalizePost({ ...post, tags: [" ai ", "ai"] }).tags, ["ai"])
})

test("HTTP routes persist URLs, filter posts, and return JSON errors", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "silov0-http-"))
  const storagePath = path.join(dir, "posts.json")
  await writeFile(storagePath, JSON.stringify([post]))
  const service = createContentService({ storagePath })
  const server = createApp({ service, apiToken: "test-token-abcdefghijklmnopqrstuvwxyz" }).listen(0, "127.0.0.1")
  await new Promise(resolve => server.once("listening", resolve))
  t.after(async () => {
    await new Promise(resolve => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  })
  const base = `http://127.0.0.1:${server.address().port}`
  async function request(route, options) {
    const response = await fetch(base + route, options)
    assert.match(response.headers.get("content-type"), /application\/json/)
    return { status: response.status, body: await response.json() }
  }
  const send = data => ({ method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test-token-abcdefghijklmnopqrstuvwxyz" }, body: JSON.stringify(data) })
  assert.deepEqual(await request("/health"), { status: 200, body: { ok: true } })
  assert.deepEqual((await request("/api/posts?q=missing")).body, [post])
  assert.deepEqual((await request("/api/posts/filter?tag=ai&q=NOTE")).body, [post])
  assert.deepEqual((await request("/api/posts/filter?tag=AI")).body, [])
  assert.deepEqual((await request("/api/posts/filter?q=missing")).body, [])
  assert.equal((await request("/api/posts/filter?q=a&q=b")).status, 400)
  const created = await request("/api/posts", send({ ...post, id: "two", date: "2024-03-01" }))
  assert.equal(created.status, 201)
  assert.deepEqual(created.body.map(p => p.id), ["two", "one"])
  assert.equal(JSON.parse(await readFile(storagePath, "utf8"))[0].url, post.url)
  assert.equal((await request("/api/posts", send(post))).status, 409)
  for (const payload of [{ ...post, date: "2024-02-30" }, {}, []]) {
    const result = await request("/api/posts", send(payload))
    assert.equal(result.status, 400)
    assert.equal(typeof result.body.error, "string")
  }
  assert.equal((await request("/api/posts", { ...send(post), body: "{" })).status, 400)
  assert.deepEqual(await request("/tags"), { status: 404, body: { error: "Route not found" } })
  await rm(storagePath)
  await assert.rejects(service.refresh())
  // A fresh service must forward async read failures through the JSON error handler.
  const failing = createApp({ service: createContentService({ storagePath }), apiToken: "test-token-abcdefghijklmnopqrstuvwxyz" }).listen(0, "127.0.0.1")
  await new Promise(resolve => failing.once("listening", resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${failing.address().port}/api/posts`)
    assert.equal(response.status, 500)
    assert.deepEqual(await response.json(), { error: "Internal server error" })
    await writeFile(storagePath, JSON.stringify([{ ...post, date: "bad" }]))
    const invalidStorage = await fetch(`http://127.0.0.1:${failing.address().port}/api/posts`)
    assert.equal(invalidStorage.status, 500)
    assert.deepEqual(await invalidStorage.json(), { error: "Internal server error" })
  } finally {
    await new Promise(resolve => failing.close(resolve))
  }
})

test("CLI exports sample posts and source links from another working directory", () => {
  const cli = fileURLToPath(new URL("../bin/silov0-digest.js", import.meta.url))
  const output = execFileSync(process.execPath, [cli], { cwd: tmpdir(), encoding: "utf8" })
  assert.match(output, /# silov0 digest/)
  assert.match(output, /## First Demo Post/)
  assert.match(output, /\[Source\]\(https:\/\/example.com\/first-demo\)/)
})
