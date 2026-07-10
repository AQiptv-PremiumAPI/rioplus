export default async function handler(request, env) {
  const urlObj = new URL(request.url), q = Object.fromEntries(urlObj.searchParams.entries());
  const name = q.username || q.name || urlObj.pathname.split('/').filter(Boolean)[0] || '';
  const ua = request.headers.get('user-agent') || '', base = `https://${request.headers.get('host')}`;
  
  const u = (env.USER_ID || '').split(',').map(e => e.split(':')).find(([n]) => n === name);
  if (!u || !u[1]) return new Response('User Not Found or Expired', { status: 404 });

  if (/Chrome|Safari|Firefox|Edge|OPR/i.test(ua) && !/NSPlayer/i.test(ua)) {
    return new Response(`<html><head><title>RioTV Active</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>✨ RioTV Premium Status ✨</h1><p>Playlist active aur running hai!</p></body></html>`, { headers: { 'Content-Type': 'text/html' } });
  }

  const [username, expiry] = u, exp = Math.floor(new Date(expiry).getTime() / 1000);

  const m3u = `#EXTM3U billed-till="${exp}" billed-msg="✨ RioTV Premium ✨"

#EXTM3U × "RioTV Premium"

// © API Script by @riotvnetwork //

#EXTM3U x-tvg-url="https://tsepg.cf/epg.xml.gz"
#EXTM3U x-tvg-url="https://avkb.short.gy/tsepg.xml.gz"

#EXTINF:-1 group-logo="https://i.ibb.co/Z6cSjRKv/TG-Rio-Iptv.png" tvg-logo="https://riotv.vercel.app/assets/logo.png" group-title="Contact Us",TELEGRAM: @riotvnetwork
#EXTVLCOPT:http-user-agent=RioTV
#KODIPROP:inputstream.adaptive.manifest_type=mpd
https://riotv.vercel.app/intro.ts

#EXTINF:-1 tvg-id="1069" group-title="Educational" tvg-logo="https://jiotv.catchup.cdn.jio.com/dare_images/images/Vande_Gujarat_1.png",Vande Gujarat 1
#KODIPROP:inputstream.adaptive.license_type=clearkey
#KODIPROP:inputstream.adaptive.license_key=${base}/vip/${username}/licence.php?id=1069
#EXTVLCOPT:http-user-agent=RioTV
#KODIPROP:inputstream.adaptive.manifest_type=mpd
${base}/vip/${username}/manifest.php?id=1069
`;

  return new Response(m3u, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
