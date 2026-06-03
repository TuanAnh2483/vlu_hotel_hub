const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? "hotel";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET     ?? "hotel_upload";

export async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload ảnh thất bại");
  return data.secure_url;
}