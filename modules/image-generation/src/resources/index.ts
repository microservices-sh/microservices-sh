export const resources = [
  {
    type: "d1",
    binding: "DB",
    tables: ["image_generations"],
  },
  {
    type: "r2",
    binding: "IMAGE_BUCKET",
  },
] as const;
