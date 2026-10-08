/** Hands the player a text file (deck lists, logs) through the browser's download. */
export function downloadText(fileName: string, text: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // the download has started from the link; the object URL can go once the click has been handled
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
