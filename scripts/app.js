const postsContainer = document.getElementById('posts')
const tableBody = document.getElementById('post-rows')
const emptyState = document.getElementById('empty-state')
const emptyTable = document.getElementById('empty-table')
const searchInput = document.getElementById('search')
const tagFilter = document.getElementById('tag-filter')
const resultCount = document.getElementById('result-count')
const activeFilters = document.getElementById('active-filters')
const tagCloud = document.getElementById('tag-cloud')
const archiveList = document.getElementById('archive-list')

let posts = []
let selectedTag = ''
let selectedMonth = ''
let tagCounts = new Map()
let archiveGroups = []

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

function renderActiveFilters() {
  activeFilters.innerHTML = ''

  if (!selectedTag && !selectedMonth) return

  if (selectedTag) {
    const pill = document.createElement('span')
    pill.className = 'filter-pill'
    pill.innerHTML = `Tag: ${selectedTag} <button aria-label="Clear tag filter">×</button>`
    pill.querySelector('button').addEventListener('click', () => {
      selectedTag = ''
      tagFilter.value = ''
      applyFilters()
    })
    activeFilters.appendChild(pill)
  }

  if (selectedMonth) {
    const pill = document.createElement('span')
    pill.className = 'filter-pill'
    const label = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(`${selectedMonth}-01`))
    pill.innerHTML = `Month: ${label} <button aria-label="Clear month filter">×</button>`
    pill.querySelector('button').addEventListener('click', () => {
      selectedMonth = ''
      applyFilters()
    })
    activeFilters.appendChild(pill)
  }
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase()

  const filtered = posts.filter((post) => {
    const matchesTag = selectedTag ? post.tags.includes(selectedTag) : true
    const matchesMonth = selectedMonth ? post.date.startsWith(selectedMonth) : true
    const haystack = `${post.title} ${post.summary} ${post.tags.join(' ')}`.toLowerCase()
    const matchesSearch = haystack.includes(query)
    return matchesTag && matchesMonth && matchesSearch
  })

  renderCards(filtered)
  renderTable(filtered)
  updateEmptyStates(filtered)
  updateResultCount(filtered)
  renderTagCloud(tagCounts)
  renderArchive(archiveGroups)
  renderActiveFilters()
}

function buildTagFilterOptions(tagsWithCounts) {
  tagFilter.innerHTML = '<option value="">All topics</option>'
  const sortedTags = [...tagsWithCounts.keys()].sort()
  sortedTags.forEach((tag) => {
    const option = document.createElement('option')
    option.value = tag
    option.textContent = `${tag} (${tagsWithCounts.get(tag)})`
    tagFilter.appendChild(option)
  })
}

function renderTagCloud(tagsWithCounts) {
  tagCloud.innerHTML = ''

  const sorted = [...tagsWithCounts.entries()].sort((a, b) => b[1] - a[1])
  sorted.forEach(([tag, count]) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `tag-chip${selectedTag === tag ? ' active' : ''}`
    btn.innerHTML = `${tag} <span class="tag-count">${count}</span>`
    btn.addEventListener('click', () => {
      selectedTag = selectedTag === tag ? '' : tag
      tagFilter.value = selectedTag
      applyFilters()
    })
    tagCloud.appendChild(btn)
  })
}

function renderArchive(groups) {
  archiveList.innerHTML = ''
  const formatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })

  groups.forEach(({ monthKey, count }) => {
    const label = formatter.format(new Date(`${monthKey}-01`))
    const item = document.createElement('li')
    item.className = `archive-item${selectedMonth === monthKey ? ' active' : ''}`
    item.innerHTML = `<span>${label}</span><span class="archive-count">${count} posts</span>`
    item.addEventListener('click', () => {
      selectedMonth = selectedMonth === monthKey ? '' : monthKey
      applyFilters()
    })
    archiveList.appendChild(item)
  })
}

function deriveMetadata() {
  tagCounts = new Map()
  const archiveCounts = new Map()

  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    })

    const monthKey = post.date.slice(0, 7) // YYYY-MM
    archiveCounts.set(monthKey, (archiveCounts.get(monthKey) || 0) + 1)
  })

  buildTagFilterOptions(tagCounts)
  renderTagCloud(tagCounts)

  archiveGroups = [...archiveCounts.entries()]
    .map(([monthKey, count]) => ({ monthKey, count }))
    .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1))
  renderArchive(archiveGroups)
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

  deriveMetadata()

  applyFilters()

  searchInput.addEventListener('input', applyFilters)
  tagFilter.addEventListener('change', (event) => {
    selectedTag = event.target.value
    applyFilters()
  })
}

init()
