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
  return tags.map((tag) => `<span class="tag">${tag}</span>`).join("")
}

function renderPost(post) {
  const { title, date, summary, tags } = post
  return `
    <article class="post">
      <div class="meta">
        <span>${new Date(date).toLocaleDateString()}</span>
        <span>${tags.slice(0, 2).join(" · ")}</span>
      </div>
      <h3>${title}</h3>
      <p>${summary}</p>
      <div class="tags">${renderTags(tags)}</div>
    </article>
  `
}

function populateTags(posts) {
  const unique = new Set()
  posts.forEach((post) => post.tags.forEach((tag) => unique.add(tag)))
  Array.from(unique)
    .sort()
    .forEach((tag) => {
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
