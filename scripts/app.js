const postsContainer = document.getElementById("posts")
const tagFilter = document.getElementById("tag-filter")
const searchInput = document.getElementById("search")
const emptyState = document.getElementById("empty-state")
const tableBody = document.getElementById("post-rows")
const emptyTable = document.getElementById("empty-table")
const resultCount = document.getElementById("result-count")

async function loadPosts() {
  try {
    const res = await fetch("./posts/posts.json")
    if (!res.ok) throw new Error("Failed to load posts.json")
    const posts = await res.json()
    return posts
  } catch (err) {
    console.error(err)
    emptyState.textContent = "Unable to load posts. Check posts/posts.json."
    emptyState.hidden = false
    return []
  }
}

function formatDate(date) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function renderTags(tags) {
  return tags.map((tag) => `<span class="post-tag">${tag}</span>`).join("")
}

// Card markup must stay aligned with the Codex layout (.post, .meta, .tags)
function renderCard(post) {
  const { title, date, summary, tags } = post
  return `
    <article class="post">
      <div class="meta">
        <span>${formatDate(date)}</span>
        <span>${tags.slice(0, 2).join(" · ")}</span>
      </div>
      <h3>${title}</h3>
      <p>${summary}</p>
      <div class="tags">${renderTags(tags)}</div>
    </article>
  `
}

function renderTableRow(post) {
  const { title, date, summary, tags } = post
  return `
    <tr>
      <td>${title}</td>
      <td>${formatDate(date)}</td>
      <td>${tags.map((tag) => `<span class="table-tag">${tag}</span>`).join("")}</td>
      <td>${summary}</td>
    </tr>
  `
}

function populateTags(posts) {
  const unique = new Set()
  posts.forEach((post) => post.tags.forEach((tag) => unique.add(tag)))
  Array.from(unique)
    .sort()
    .forEach((tag) => {
      if (tagFilter.querySelector(`option[value="${tag}"]`)) return
      const opt = document.createElement("option")
      opt.value = tag
      opt.textContent = tag
      tagFilter.appendChild(opt)
    })
}

function filterPosts(posts, { term, tag }) {
  const query = term.trim().toLowerCase()
  return posts.filter((post) => {
    const matchesTag = !tag || post.tags.includes(tag)
    const matchesQuery =
      !query ||
      post.title.toLowerCase().includes(query) ||
      post.summary.toLowerCase().includes(query) ||
      post.tags.some((t) => t.toLowerCase().includes(query))
    return matchesTag && matchesQuery
  })
}

function renderCards(posts) {
  if (!posts.length) {
    postsContainer.innerHTML = ""
    emptyState.hidden = false
    emptyState.textContent = "No posts yet. Add entries in posts/posts.json."
    return
  }

  emptyState.hidden = true
  postsContainer.innerHTML = posts.map(renderCard).join("")
}

function renderTable(posts) {
  if (!tableBody) return
  if (!posts.length) {
    tableBody.innerHTML = ""
    emptyTable.hidden = false
    return
  }
  emptyTable.hidden = true
  tableBody.innerHTML = posts.map(renderTableRow).join("")
}

function updateCount(filtered, total) {
  if (!resultCount) return
  const label = filtered === total ? `${total} posts` : `${filtered} of ${total} posts`
  resultCount.textContent = label
}

async function init() {
  const posts = await loadPosts()
  if (!posts.length) return

  populateTags(posts)
  renderCards(posts)
  renderTable(posts)
  updateCount(posts.length, posts.length)

  const handleFilter = () => {
    const term = searchInput.value
    const tag = tagFilter.value
    const filtered = filterPosts(posts, { term, tag })
    renderCards(filtered)
    renderTable(filtered)
    updateCount(filtered.length, posts.length)
  }

  searchInput.addEventListener("input", handleFilter)
  tagFilter.addEventListener("change", handleFilter)
}

init()
