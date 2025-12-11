const postsContainer = document.getElementById("posts")
const tableBody = document.getElementById("post-rows")
const emptyState = document.getElementById("empty-state")
const emptyTable = document.getElementById("empty-table")
const searchInput = document.getElementById("search")
const tagFilter = document.getElementById("tag-filter")
const resultCount = document.getElementById("result-count")

let allPosts = []
let currentFiltered = []

function formatDate(dateString) {
  // Use UTC so dates from JSON don't shift across timezones
  const date = new Date(dateString)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function renderCards(filtered) {
  if (!postsContainer) return

  postsContainer.innerHTML = ""

  filtered.forEach((post) => {
    const card = document.createElement("article")
    card.className = "post-card"
    card.innerHTML = `
      <h3 class="post-title">${post.title}</h3>
      <p class="post-meta">${formatDate(post.date)}</p>
      <p class="post-summary">${post.summary}</p>
      <div class="post-tags">
        ${Array.isArray(post.tags)
          ? post.tags.map((tag) => `<span class="post-tag">${tag}</span>`).join("")
          : ""}
      </div>
    `
    postsContainer.appendChild(card)
  })
}

function renderTable(filtered) {
  if (!tableBody) return

  tableBody.innerHTML = ""

  filtered.forEach((post) => {
    const row = document.createElement("tr")
    row.innerHTML = `
      <td><strong>${post.title}</strong></td>
      <td style="white-space: nowrap; color: var(--muted);">${formatDate(
        post.date
      )}</td>
      <td>
        ${
          Array.isArray(post.tags)
            ? post.tags.map((tag) => `<span class="table-tag">${tag}</span>`).join("")
            : ""
        }
      </td>
      <td style="color: var(--muted);">${post.summary}</td>
    `
    tableBody.appendChild(row)
  })
}

function updateEmptyStates(filtered) {
  const hasResults = filtered.length > 0

  if (emptyState) emptyState.hidden = hasResults
  if (emptyTable) emptyTable.hidden = hasResults
}

function updateResultCount(filtered) {
  if (!resultCount) return

  if (!allPosts.length) {
    resultCount.textContent = ""
    return
  }

  if (filtered.length === allPosts.length) {
    resultCount.textContent = `${allPosts.length} posts`
  } else {
    resultCount.textContent = `Showing ${filtered.length} of ${allPosts.length} posts`
  }
}

function applyFilters() {
  const query = (searchInput?.value || "").trim().toLowerCase()
  const selectedTag = tagFilter?.value || ""

  const filtered = allPosts.filter((post) => {
    const tags = Array.isArray(post.tags) ? post.tags : []
    const matchesTag = selectedTag ? tags.includes(selectedTag) : true

    const haystack = `${post.title || ""} ${post.summary || ""} ${tags.join(" ")}`
      .toLowerCase()
    const matchesSearch = query ? haystack.includes(query) : true

    return matchesTag && matchesSearch
  })

  currentFiltered = filtered
  renderCards(filtered)
  renderTable(filtered)
  updateEmptyStates(filtered)
  updateResultCount(filtered)
}

function buildTagFilterOptions() {
  if (!tagFilter) return

  const tagCounts = new Map()

  allPosts.forEach((post) => {
    const tags = Array.isArray(post.tags) ? post.tags : []
    tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    })
  })

  // Clear everything except the first "All topics" option
  while (tagFilter.options.length > 1) {
    tagFilter.remove(1)
  }

  const sortedTags = [...tagCounts.keys()].sort()

  sortedTags.forEach((tag) => {
    const option = document.createElement("option")
    option.value = tag
    option.textContent = `${tag} (${tagCounts.get(tag)})`
    tagFilter.appendChild(option)
  })
}

async function fetchPosts() {
  try {
    // For now: local JSON file. Later you can swap this to a remote CONTENT_URL.
    const response = await fetch("./posts/posts.json")

    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.status}`)
    }

    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error("Unable to load posts", error)
    if (emptyState) {
      emptyState.textContent = "Unable to load posts from posts/posts.json."
      emptyState.hidden = false
    }
    return []
  }
}

function buildMarkdownDigest(posts) {
  if (!posts || posts.length === 0) {
    return "# silov0 digest\n\n_No posts match your filters._\n"
  }

  const header =
    `# silov0 digest\n\n` +
    `Generated from ${posts.length} post` +
    (posts.length === 1 ? "" : "s") +
    ".\n\n"

  const body = posts
    .map((p) => {
      const date = formatDate(p.date)
      const tags =
        p.tags && p.tags.length ? ` _(tags: ${p.tags.join(", ")})_` : ""
      const link = p.url ? `\n[Source](${p.url})` : ""
      const summary = p.summary || ""
      return `## ${p.title}\n${date}${tags}\n\n${summary}${link}\n`
    })
    .join("\n")

  return header + body
}

async function exportDigest() {
  const posts = currentFiltered && currentFiltered.length
    ? currentFiltered
    : allPosts

  const markdown = buildMarkdownDigest(posts)

  try {
    await navigator.clipboard.writeText(markdown)
    if (resultCount) {
      const count = posts.length
      resultCount.textContent =
        `Copied digest for ${count} post` +
        (count === 1 ? "" : "s") +
        " to clipboard."
    }
  } catch (err) {
    console.error("Clipboard write failed", err)
    if (resultCount) {
      resultCount.textContent =
        "Could not copy digest – clipboard permissions denied."
    }
  }
}

async function init() {
  allPosts = await fetchPosts()

  buildTagFilterOptions()
  applyFilters()

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters)
  }
  if (tagFilter) {
    tagFilter.addEventListener("change", applyFilters)
  }
  const exportButton = document.getElementById("export-markdown")
  if (exportButton) {
    exportButton.addEventListener("click", exportDigest)
  }
}

init()
