import adapter from "@sveltejs/adapter-cloudflare";

export default {
  kit: {
    adapter: adapter({
      platformProxy: {
        configPath: "wrangler.jsonc",
        persist: true
      }
    })
  }
};
