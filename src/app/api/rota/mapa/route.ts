import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin") || "";
  const destination = searchParams.get("destination") || "";
  const waypoints = searchParams.get("waypoints") || "";

  const embedUrl = new URL("https://www.google.com/maps/embed/v1/directions");
  embedUrl.searchParams.set("key", apiKey);
  embedUrl.searchParams.set("origin", origin);
  embedUrl.searchParams.set("destination", destination);
  if (waypoints) {
    embedUrl.searchParams.set("waypoints", waypoints);
  }
  embedUrl.searchParams.set("mode", "driving");
  embedUrl.searchParams.set("language", "pt-BR");

  return NextResponse.json({ url: embedUrl.toString() });
}
