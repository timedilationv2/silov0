const postsContainer = document.getElementById("posts")
const tagFilter = document.getElementById("tag-filter")
const searchInput = document.getElementById("search")
const emptyState = document.getElementById("empty-state")

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

function renderTags(tags) {
  return tags.map((tag) => `<span class="post-tag">${tag}</span>`).join("")
}

function renderPost(post) {
  const { title, date, summary, tags } = post
  const formattedDate = new Date(date).toLocaleDateString()
  return `
    <article class="post-card">
      <p class="post-meta">${formattedDate} · ${tags.slice(0, 3).join(" · ")}</p>
      <h3 class="post-title">${title}</h3>
      <p class="post-summary">${summary}</p>
      <div class="post-tags">${renderTags(tags)}</div>
    </article>
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

function render(posts) {
  if (!posts.length) {
    postsContainer.innerHTML = ""
    emptyState.hidden = false
    emptyState.textContent = "No posts yet. Add entries in posts/posts.json."
    return
  }

  emptyState.hidden = true
  postsContainer.innerHTML = posts.map(renderPost).join("")
}

async function init() {
  const posts = await loadPosts()
  if (!posts.length) return

  populateTags(posts)
  render(posts)

  const handleFilter = () => {
    const term = searchInput.value
    const tag = tagFilter.value
    const filtered = filterPosts(posts, { term, tag })
    render(filtered)
  }

  searchInput.addEventListener("input", handleFilter)
  tagFilter.addEventListener("change", handleFilter)
}

init()
