function renderCard(post) {
  const { title, date, summary, tags } = post
  const formattedDate = new Date(date).toLocaleDateString()
  return `