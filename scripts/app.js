
const postsGrid = document.getElementById("posts-grid")
const tableBody = document.getElementById("post-rows")
const emptyState = document.getElementById("empty-state")
const emptyTable = document.getElementById("empty-table")
const searchInput = document.getElementById("search")
const tagFilter = document.getElementById("tag-filter")
const filterTags = document.getElementById("filter-tags")
const filterCount = document.getElementById("filter-count")

// Keep the public demo self-contained, including on GitHub Pages project paths.
const POSTS_URL = "posts/posts.json"

let allPosts = []
let currentFiltered = []

function formatDate(dateString) {
  // Use UTC so dates from JSON don't shift across timezones.
  const date = new Date(dateString)

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function tagsFor(post, className) {
  return (Array.isArray(post.tags) ? post.tags : [])
    .map(tag => element("span", className, tag))
}

function renderCards(filtered) {
  if (!postsGrid) return
  postsGrid.replaceChildren()
  for (const post of filtered) {
    const card = element("article", "post-card")
    const tags = element("div", "post-tags")
    tags.append(...tagsFor(post, "post-tag"))
    card.append(element("h3", "post-title", post.title),
      element("p", "post-meta", formatDate(post.date)),
      element("p", "post-summary", post.summary || ""), tags)
    appendSourceLink(card, post)
    postsGrid.append(card)
  }
}

function renderTable(filtered) {
  if (!tableBody) return
  tableBody.replaceChildren()
  for (const post of filtered) {
    const row = element("tr")
    const title = element("td")
    title.append(element("strong", "", post.title))
    appendSourceLink(title, post)
    const date = element("td", "", formatDate(post.date))
    date.style.whiteSpace = "nowrap"
    date.style.color = "var(--muted)"
    const tags = element("td")
    tags.append(...tagsFor(post, "table-tag"))
    const summary = element("td", "", post.summary || "")
    summary.style.color = "var(--muted)"
    row.append(title, date, tags, summary)
    tableBody.append(row)
  }
}

// Static JSON is also untrusted. Relative HTTP(S) sources remain supported.
function safeSourceUrl(value) {
  if (typeof value !== "string" || !value.trim() || /[\u0000-\u0020\u007f]/.test(value)) return null
  try {
    const url = new URL(value, "https://silov0.invalid/")
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? value.replace(/[()<>"\\]/g, c => encodeURIComponent(c).replace(/\(/g, "%28").replace(/\)/g, "%29")) : null
  } catch { return null }
}

function appendSourceLink(parent, post) {
  const url = safeSourceUrl(post.url)
  if (!url) return
  const link = element("a", "sample-link", "Read sample →")
  link.href = url
  link.rel = "noopener noreferrer"
  parent.append(link)
}

function markdownText(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/[\\`*_[\]{}()!#]/g, "\\$&")
}

function updateEmptyStates(filtered) {
  const hasResults = filtered.length > 0

  if (emptyState) emptyState.hidden = hasResults
  if (emptyTable) emptyTable.hidden = hasResults
}

function updateResultCount(filtered) {
  if (!filterCount) return

  if (!allPosts.length) {
    filterCount.textContent = ""
    return
  }

  if (filtered.length === allPosts.length) {
    filterCount.textContent = `${allPosts.length} samples`
  } else {
    filterCount.textContent =
      `Showing ${filtered.length} of ${allPosts.length} samples`
  }
}

function applyFilters() {
  const query = (searchInput?.value || "").trim().toLowerCase()
  const selectedTag = tagFilter?.value || ""

  updateActiveTag(selectedTag)

  const filtered = allPosts.filter((post) => {
    const tags = Array.isArray(post.tags) ? post.tags : []
    const matchesTag = selectedTag
      ? tags.includes(selectedTag)
      : true

    const haystack =
      `${post.title || ""} ${post.summary || ""} ${tags.join(" ")}`
        .toLowerCase()

    const matchesSearch = query
      ? haystack.includes(query)
      : true

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

  // Preserve the first "All topics" option.
  while (tagFilter.options.length > 1) {
    tagFilter.remove(1)
  }

  if (filterTags) {
    filterTags.replaceChildren()

    const allButton = document.createElement("button")
    allButton.type = "button"
    allButton.className = "tag-chip active"
    allButton.dataset.tag = ""
    allButton.textContent = "All"

    allButton.addEventListener("click", () => {
      tagFilter.value = ""
      updateActiveTag("")
      applyFilters()
    })

    filterTags.appendChild(allButton)
  }

  const sortedTags = [...tagCounts.keys()].sort()

  sortedTags.forEach((tag) => {
    const option = document.createElement("option")
    option.value = tag
    option.textContent = `${tag} (${tagCounts.get(tag)})`

    tagFilter.appendChild(option)

    if (filterTags) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "tag-chip"
      btn.dataset.tag = tag
      btn.textContent = `${tag} (${tagCounts.get(tag)})`

      btn.addEventListener("click", () => {
        tagFilter.value = tag
        updateActiveTag(tag)
        applyFilters()
      })

      filterTags.appendChild(btn)
    }
  })
}

function updateActiveTag(selectedTag) {
  if (!filterTags) return

  const buttons = filterTags.querySelectorAll("button")

  buttons.forEach((btn) => {
    const matches = btn.dataset.tag === selectedTag
    btn.classList.toggle("active", matches)
  })
}

// The local Express API remains available separately at /api/posts.
async function fetchPosts() {
  try {
    const response = await fetch(POSTS_URL)

    if (!response.ok) {
      throw new Error(`Posts request failed: HTTP ${response.status}`)
    }

    const posts = await response.json()

    if (!Array.isArray(posts)) {
      throw new Error("Posts response must be an array of posts")
    }

    return posts
  } catch (error) {
    console.error("Unable to load posts from static JSON", error)

    for (const state of [emptyState, emptyTable]) {
      if (state) {
        state.textContent = "Unable to load posts/posts.json. Serve the site over HTTP and try again."
        state.hidden = false
      }
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
    .map((post) => {
      const date = formatDate(post.date)

      const tags =
        post.tags && post.tags.length
          ? ` _(tags: ${post.tags.map(markdownText).join(", ")})_`
          : ""

      const source = safeSourceUrl(post.url)
      const link = source
        ? `\n[Source](${source})`
        : ""

      const summary = markdownText(post.summary)

      return (
        `## ${markdownText(post.title)}\n` +
        `${date}${tags}\n\n` +
        `${summary}${link}\n`
      )
    })
    .join("\n")

  return header + body
}

async function exportDigest() {
  // Export exactly the currently displayed posts,
  // including an empty result set.
  const posts = currentFiltered
  const markdown = buildMarkdownDigest(posts)

  try {
    await navigator.clipboard.writeText(markdown)

    if (filterCount) {
      const count = posts.length

      filterCount.textContent =
        `Copied digest for ${count} sample` +
        (count === 1 ? "" : "s") +
        " to clipboard."
    }
  } catch (error) {
    console.error("Clipboard write failed", error)

    if (filterCount) {
      filterCount.textContent =
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
