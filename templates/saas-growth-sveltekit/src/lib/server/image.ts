import {
  createD1ImageStore,
  createMemoryImageStore,
  createR2ObjectStorage,
  createMemoryObjectStorage,
  createMemoryImageProvider,
  buildProviders,
  type ImageStore,
  type ObjectStorage,
  type ProviderRegistry,
} from "@microservices-sh/image-generation";

// Dev singletons: persist generated images across requests in a single dev
// session when no D1/R2 binding is configured.
const memoryImageStore = createMemoryImageStore();
const memoryImageStorage = createMemoryObjectStorage();

// The image-generation env keys ride alongside the D1 binding on App.Platform.
// Cast locally so the routes stay self-contained (no app.d.ts surgery).
type ImageEnv = NonNullable<App.Platform["env"]> & {
  IMAGE_BUCKET?: R2Bucket;
  KIEAI_API_KEY?: string;
  GEMINI_ENDPOINT?: string;
  GEMINI_AUTH_TOKEN?: string;
  OPENAI_API_KEY?: string;
};

export interface ImageDeps {
  store: ImageStore;
  storage: ObjectStorage;
  providers: ProviderRegistry;
}

export function resolveImageDeps(platform: App.Platform | undefined): ImageDeps {
  const env = (platform?.env ?? {}) as ImageEnv;
  const store = env.DB ? createD1ImageStore(env.DB) : memoryImageStore;
  const storage = env.IMAGE_BUCKET ? createR2ObjectStorage(env.IMAGE_BUCKET) : memoryImageStorage;
  let providers = buildProviders(env);
  // Dev fallback: with no real provider keys, use a deterministic stub so the
  // generate → gallery → delete flow is exercisable locally without secrets.
  if (Object.keys(providers).length === 0) providers = { "kie-ai": createMemoryImageProvider() };
  return { store, storage, providers };
}

export const tenantOf = (locals: App.Locals): string => locals.user?.id ?? "demo-tenant";
