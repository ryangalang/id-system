// Maps font keys to actual CSS font-family strings
// 'canva-sans' = closest to Canva Sans = DM Sans (already loaded) 
// 'montserrat' = Montserrat (loaded in index.html)

export function getFontFamily(fontKey) {
  switch (fontKey) {
    case 'montserrat': return "'Montserrat', Arial, sans-serif"
    case 'canva-sans': return "'DM Sans', 'Plus Jakarta Sans', Arial, sans-serif"
    default:           return "'Plus Jakarta Sans', Arial, sans-serif"
  }
}
