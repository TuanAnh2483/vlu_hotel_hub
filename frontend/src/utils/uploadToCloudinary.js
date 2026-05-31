export async function uploadToCloudinary(file) {
    const formData = new FormData();

    formData.append("file", file); // 👈 file gốc (KHÔNG base64)
    formData.append("upload_preset", "hotel_upload"); // 👈 đúng tên preset

    const res = await fetch("https://api.cloudinary.com/v1_1/hotel/image/upload", {
        method: "POST",
        body: formData,
    });

    const data = await res.json();

    if (!data.secure_url) {
        throw new Error("Upload ảnh thất bại");
    }

    return data.secure_url;
}