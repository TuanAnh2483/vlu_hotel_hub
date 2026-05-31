export function createExistingImageItems(imageUrls) {
  return (Array.isArray(imageUrls) ? imageUrls : [])
    .filter(Boolean)
    .map((url, index) => ({
      id: `existing-${index}-${url}`,
      url,
    }));
}

export function createPendingImageItems(fileList) {
  const files = Array.from(fileList || []);
  const createdAt = Date.now();

  return files.map((file, index) => ({
    id: `pending-${createdAt}-${index}-${file.name}-${file.size}-${file.lastModified}`,
    url: URL.createObjectURL(file),
    file,
  }));
}

export function imageItemUrl(item) {
  if (typeof item === "string") return item;
  return item?.url || "";
}

export function existingImageUrlsFromItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => !item?.file)
    .map(imageItemUrl)
    .filter(Boolean);
}

export function pendingImageFilesFromItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.file)
    .map((item) => item.file);
}

export function revokePendingImageUrls(items) {
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (item?.file && typeof item.url === "string" && item.url.startsWith("blob:")) {
      URL.revokeObjectURL(item.url);
    }
  });
}
