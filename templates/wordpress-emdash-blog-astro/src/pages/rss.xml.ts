import rss from "@astrojs/rss";
import { getPublishedPosts, postDate, postExcerpt, postTitle, postUrl } from "../lib/posts";
import { siteDescription, siteTitle } from "../lib/site";

export async function GET(context: { site?: URL }) {
  const posts = await getPublishedPosts();
  const site = context.site?.toString() || "http://localhost:4321";

  return rss({
    title: siteTitle,
    description: siteDescription,
    site,
    items: posts.map((post) => ({
      title: postTitle(post),
      pubDate: postDate(post) || new Date(),
      description: postExcerpt(post),
      link: postUrl(post),
    })),
  });
}
