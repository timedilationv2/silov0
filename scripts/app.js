const postsContainer = document.getElementById('posts')
const tableBody = document.getElementById('post-rows')
const emptyState = document.getElementById('empty-state')
const emptyTable = document.getElementById('empty-table')
const searchInput = document.getElementById('search')
const tagFilter = document.getElementById('tag-filter')
const resultCount = document.getElementById('result-count')

let posts = []

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function renderCards(filtered) {
  postsContainer.innerHTML = ''

  filtered.forEach((post) => {
    const card = document.createElement('article')
    card.className = 'post-card'
    card.innerHTML = `
      <h3 class="post-title">${post.title}</h3>
      <p class="post-meta">${formatDate(post.date)}</p>
      <p class="post-summary">${post.summary}</p>
      <div class="post-tags">
        ${post.tags.map((tag) => `<span class="post-tag">${tag}</span>`).join('')}
      </div>
    `
    postsContainer.appendChild(card)
  })
}

function renderTable(filtered) {
  tableBody.innerHTML = ''

  filtered.forEach((post) => {
    const row = document.createElement('tr')
    row.innerHTML = `
      <td data-label="Title">${post.title}</td>
      <td data-label="Date">${formatDate(post.date)}</td>
      <td data-label="Tags">${post.tags.join(', ')}</td>
      <td data-label="Summary">${post.summary}</td>
    `
    tableBody.appendChild(row)
  })
}

function updateEmptyStates(filtered) {
  const hasResults = filtered.length > 0
  emptyState.hidden = hasResults
  emptyTable.hidden = hasResults
}

function updateResultCount(filtered) {
  if (!posts.length) {
    resultCount.textContent = ''
    return
  }

  resultCount.textContent = `Showing ${filtered.length} of ${posts.length} posts`
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase()
  const selectedTag = tagFilter.value

  const filtered = posts.filter((post) => {
    const matchesTag = selectedTag ? post.tags.includes(selectedTag) : true
    const haystack = `${post.title} ${post.summary} ${post.tags.join(' ')}`.toLowerCase()
    const matchesSearch = haystack.includes(query)
    return matchesTag && matchesSearch
  })

  renderCards(filtered)
  renderTable(filtered)
  updateEmptyStates(filtered)
  updateResultCount(filtered)
}

async function fetchPosts() {
  try {
    const response = await fetch('./posts/posts.json')
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Unable to load posts', error)
    emptyState.textContent = 'Unable to load posts from posts/posts.json.'
    emptyState.hidden = false
    emptyTable.hidden = false
    return []
  }
}

async function init() {
  posts = await fetchPosts()

  applyFilters()

  searchInput.addEventListener('input', applyFilters)
  tagFilter.addEventListener('change', applyFilters)
}

init()
