const cors = { "Access-Control-Allow-Origin": "https://watching.mojocolony.com", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-region, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status,headers: {...cors,"Content-Type":"application/json"}});
Deno.serve(async req => {
  const requestedHeaders = req.headers.get("access-control-request-headers");
  if (requestedHeaders) cors["Access-Control-Allow-Headers"] = requestedHeaders;
  if (req.method === "OPTIONS") return new Response(null, {status:204,headers:cors});
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const secret = Deno.env.get("WATCHING_TMDB_TOKEN");
  if (!secret) return json({error:"Provider lookup not configured"},503);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({error:"Authentication required"},401);
  const endpoint = Deno.env.get("SUPABASE_URL");
  const pub = Deno.env.get("SUPABASE_ANON_KEY");
  if (!endpoint || !pub) return json({error:"Authentication unavailable"},503);
  const userRes = await fetch(endpoint + "/auth/v1/user", {headers: {Authorization:auth,apikey:pub}});
  if (!userRes.ok) return json({error:"Invalid session"},401);
  const user = await userRes.json();
  if (!user?.id) return json({error:"Invalid session"},401);
  const access = await fetch(endpoint + "/rest/v1/watching_access?user_id=eq." + encodeURIComponent(user.id) + "&select=user_id&limit=1", {headers:{Authorization:auth,apikey:pub,Accept:"application/json"}});
  if (!access.ok || !(await access.json()).length) return json({error:"Watching access required"},403);
  let title = "";
  let sourceShowId = 0;
  try {
    const body = await req.json();
    title = String(body.title || "").trim().slice(0, 150);
    sourceShowId = Number(body.sourceShowId);
  } catch {}
  if (!title) return json({error:"Title required"},400);
  const api = "https://api.themoviedb.org/3";
  const headers = {Authorization:"Bearer " + secret,Accept:"application/json"};
  const norm = (v: string) => String(v || "").trim().toLocaleLowerCase("en-CA");
  const eligible = new Map<string, string>([
    ["netflix", "Netflix"], ["netflix standard with ads", "Netflix"],
    ["crave", "Crave"],
    ["prime video", "Prime"], ["amazon prime video", "Prime"],
    ["amazon prime video with ads", "Prime"], ["prime video with ads", "Prime"],
    ["prime", "Prime"],
    ["paramount+", "Paramount+"], ["paramount plus", "Paramount+"],
    ["paramount plus premium", "Paramount+"], ["paramount plus basic with ads", "Paramount+"],
    ["disney+", "Disney+"], ["disney plus", "Disney+"],
    ["apple tv", "AppleTV"], ["apple tv+", "AppleTV"],
    ["apple tv plus", "AppleTV"], ["appletv", "AppleTV"],
  ]);
  const subscribed = (name: string | null) => eligible.get(norm(name)) ?? null;
  // Original Apple TV shows can be identifiable before a Canadian TMDB
  // provider is published. Verify the supplied TVmaze show ID and title.
  let tvmazeShow: {name?: string; premiered?: string; webChannel?: {name?: string}} | null = null;
  if (Number.isSafeInteger(sourceShowId) && sourceShowId > 0) {
    try {
      const response = await fetch("https://api.tvmaze.com/shows/" + sourceShowId, {
        headers: {Accept: "application/json"}
      });
      if (response.ok) {
        const candidate = await response.json();
        if (norm(candidate.name) === norm(title)) tvmazeShow = candidate;
      }
    } catch { /* TVmaze unavailable; no fallback. */ }
  }
  const appleFallback = () => {
    const channel = norm(tvmazeShow?.webChannel?.name);
    return ['apple tv', 'apple tv+', 'apple tv plus'].includes(channel) ? "AppleTV" : null;
  };
  const search = await fetch(api + "/search/tv?query=" + encodeURIComponent(title),{headers});
  if (!search.ok) return json({error:"Provider service unavailable"},502);
  const results = (await search.json()).results || [];
  const candidates = results.filter((entry: {name:string}) => norm(entry.name) === norm(title));
  const sourceYear = tvmazeShow?.premiered?.slice(0, 4);
  const match = sourceYear
    ? candidates.find((entry: {first_air_date?:string}) => entry.first_air_date?.slice(0, 4) === sourceYear)
    : candidates[0];
  if (!match) return json({provider:appleFallback(), attribution:"TVmaze"});
  const providers = await fetch(api + "/tv/" + encodeURIComponent(match.id) + "/watch/providers",{headers});
  if (!providers.ok) return json({error:"Provider service unavailable"},502);
  const options = (await providers.json())?.results?.CA?.flatrate || [];
  // Filter before ranking: never substitute StackTV, BritBox, Starz or any
  // other separately billed Amazon/Apple channel for the base subscription.
  const matched = options.filter((item: {provider_name?:string}) => subscribed(item.provider_name ?? null))
    .sort((a: {display_priority?:number},b:{display_priority?:number}) =>
      (a.display_priority ?? 999) - (b.display_priority ?? 999));
  const first = matched[0];
  const provider = subscribed(first?.provider_name ?? null) || appleFallback();
  return json({provider:provider || null, attribution:first ? "JustWatch" : "TVmaze"});
});