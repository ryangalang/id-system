/**
 * Converts any Google Drive share URL to a direct-display URL.
 * Supports both /file/d/FILE_ID/view and open?id=FILE_ID formats.
 * Also handles already-direct URLs and non-Drive URLs (pass through).
 */
export function toDirectImageUrl(url) {
  if (!url || typeof url !== 'string') return url

  url = url.trim()

  // Already a direct Drive thumbnail/uc link — leave alone
  if (url.includes('drive.google.com/uc') || url.includes('drive.google.com/thumbnail')) {
    return url
  }

  // Format 1: https://drive.google.com/file/d/FILE_ID/view?...
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) {
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`
  }

  // Format 2: https://drive.google.com/open?id=FILE_ID
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/)
  if (openMatch) {
    return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`
  }

  // Format 3: https://docs.google.com/... (sometimes used)
  const docsMatch = url.match(/docs\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/)
  if (docsMatch) {
    return `https://drive.google.com/uc?export=view&id=${docsMatch[1]}`
  }

  // Not a Drive URL — return as-is (Supabase Storage, direct JPG/PNG, etc.)
  return url
}

/**
 * Checks if a string looks like a Google Drive URL
 */
export function isGoogleDriveUrl(url) {
  return typeof url === 'string' && (
    url.includes('drive.google.com') ||
    url.includes('docs.google.com')
  )
}
