import { getEmDashCollection } from "emdash";

type DateLike = Date | string | number | null | undefined;

export type BlogEntry = {
  id: string;
  data: {
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: unknown;
    publishedAt?: DateLike;
    date?: DateLike;
    featured_image?: unknown;
    featuredImage?: unknown;
    author?: string;
  };
  edit?: Record<string, unknown>;
};

export async function getPublishedPosts() {
  const { entries, error } = await getEmDashCollection("posts", {
    status: "published",
  });

  if (error) {
    throw error;
  }

  return (entries as BlogEntry[]).sort((a, b) => timestamp(b) - timestamp(a));
}

export function timestamp(post: BlogEntry) {
  const value = post.data.publishedAt || post.data.date;
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

export function postDate(post: BlogEntry) {
  const value = post.data.publishedAt || post.data.date;
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

export function postSlug(post: BlogEntry) {
  return post.data.slug || post.id;
}

export function postUrl(post: BlogEntry) {
  return `/blog/${postSlug(post)}`;
}

export function postTitle(post: BlogEntry) {
  return post.data.title || "Untitled";
}

export function postExcerpt(post: BlogEntry) {
  return post.data.excerpt || "";
}

export function formatDate(value: DateLike) {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
