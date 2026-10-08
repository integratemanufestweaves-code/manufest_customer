/** Hands a downloaded file to the browser as a normal file download. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked a moment later: iOS Safari reads the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
