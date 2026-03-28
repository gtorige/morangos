import { prisma } from "./prisma";

/**
 * Get a configuration value from the database, falling back to environment variables.
 */
export async function getConfig(chave: string, envFallback?: string): Promise<string | null> {
  try {
    const config = await prisma.configuracao.findUnique({
      where: { chave },
    });
    if (config?.valor) return config.valor;
  } catch {
    // DB not available, fall through to env
  }
  return envFallback || null;
}

/**
 * Get the Google API key for Routes, checking DB first then .env
 */
export async function getGoogleRoutesApiKey(): Promise<string | null> {
  return getConfig("google_routes_api_key", process.env.GOOGLE_ROUTES_API_KEY);
}

/**
 * Get the Google API key for Maps Embed, checking DB first then falling back to Routes key
 */
export async function getGoogleEmbedApiKey(): Promise<string | null> {
  const embedKey = await getConfig("google_embed_api_key");
  if (embedKey) return embedKey;
  // Fallback to routes key
  return getGoogleRoutesApiKey();
}
