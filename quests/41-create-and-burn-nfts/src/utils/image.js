export const dataURLtoFile = (dataURL, filename) => {
  const arr = dataURL.split(","), mime = arr[0].match(/:(.*?);/)[1];
  const b64String = atob(arr[1])
  const n = b64String.length;
  const u8arr = new Uint8Array(n);
  let i = n;
  while (i--) {
    u8arr[i] = b64String.charCodeAt(i);
  }
  return new File([u8arr], filename, { type:mime });
}
