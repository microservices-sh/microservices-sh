export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: ["media_files", "upload_tickets"]
  },
  {
    type: "r2",
    binding: "MEDIA_BUCKET"
  }
] as const;
