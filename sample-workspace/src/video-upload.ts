export interface UploadedVideo {
  id: string;
  filename: string;
  bytes: number;
}

export function validateVideoUpload(file: UploadedVideo) {
  if (!file.filename.endsWith('.mp4')) {
    throw new Error('Only mp4 uploads are supported in the sample workspace');
  }
  if (file.bytes <= 0) {
    throw new Error('Upload is empty');
  }
  return {
    ok: true,
    storageKey: `uploads/${file.id}/${file.filename}`,
  };
}
