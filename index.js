import p from './playlist';

const REDIS_URL = "https://precious-hog-22705.upstash.io";
const REDIS_TOKEN = "AVixAAIncDFlZTI3ZGMyYWI4ZDI0OGE4YThmMWI4NTA0ZGIwNjA5OXAxMjI3MDU";

// ⚠️ APNI STATIC HTML FILES KI SITE KA URL YAHA DALEN
const BASE_URL = "https://riotv.vercel.app"; 

const redis = async (cmd, ...args) => {
  try {
    const res = await fetch(`${REDIS_URL}/${cmd}/${args.join('/')}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    return await res.json();
  } catch (e) { return { result: null }; }
};

const render = async (fileName) => {
  try {
    const response = await fetch(`${BASE_URL}/${fileName}`);
    const html = await response.text();
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (e) {
    return new Response(`Error loading ${fileName}`, { status: 500 });
  }
};

const parseDeviceInfo = (ua) => {
    let model = "Unknown Device";
    let os = "Unknown OS";
    
    if (/android/i.test(ua)) {
        const match = ua.match(/\(([^;]+);([^;]+);?([^)]+)?\)/);
        if (match) {
            os = match[1].trim(); 
            if (os.includes("Android")) os = os.split("Android")[1] ? "Android " + os.split("Android")[1].trim() : "Android";
            model = match[2] ? match[2].trim() : os;
            if (model === "K" || model === "U") model = os;
        } else {
            os = "Android";
            model = "Android Device";
        }
    } else if (/iPhone/i.test(ua)) {
        const ver = ua.match(/OS (\d+)_(\d+)/);
        os = `iOS ${ver ? ver[1] : '?'}`;
        model = "iPhone";
    } else if (/Windows NT/i.test(ua)) {
        const ver = ua.match(/Windows NT ([\d.]+)/);
        os = `Windows ${ver ? ver[1] : ''}`;
        model = "PC";
    }

    const browser = ua.match(/(Chrome|Safari|Firefox|Edge|Opera|RioTV)/i)?.[0] || "Unknown Browser";
    const type = /Mobile|Android|iPhone/i.test(ua) ? "Mobile" : "Desktop";
    
    return { model, os, browser, type };
};

export default {
  async fetch(request, env, ctx) {
    const urlObj = new URL(request.url);
    const url = urlObj.pathname + urlObj.search;
    
    // Cloudflare pe true client IP nikalne ke liye
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const safeIp = ip.replace(/[:.]/g, '_');
    
    // URL Search Parameters
    const params = urlObj.searchParams;
    const queryName = params.get('name') || params.get('username');
    const password = params.get('password');
    const xunban = params.get('xunban');
    const xunbanips = params.get('xunbanips');
    const xbantokens = params.get('xbantokens');
    const xbanips = params.get('xbanips');
    const pass = params.get('pass');
    const xviewlog = params.get('xviewlog');

    // Agar /api/ggh path format hai to pathname se last part nikalne ke liye
    let pathNameParts = urlObj.pathname.split('/');
    let name = queryName || pathNameParts[pathNameParts.length - 1];
    if(name === 'get.php' || !name) {
      name = queryName;
    }

    const id = url.split(/\/(?:key|mpd|key1|sony|portal|ch|zee|mpd1|key2|mkd)\//).pop().split('?')[0];
    const uList = (env.USER_ID || '').split(',').map(e => e.split(':'));
    const u = uList.find(([n]) => n === name);
    const P = "Rio@123";
    const ua = request.headers.get('user-agent') || '';

    let ipData = {};
    try {
      const response = await fetch(`https://ipinfo.io/${ip}/json`);
      ipData = await response.json();
    } catch (e) { ipData = { org: "Unknown", country: "IN", timezone: "Asia/Kolkata" }; }

    const device = parseDeviceInfo(ua);
    const geo = {
      city: ipData.city || 'Unknown',
      region: ipData.region || 'Unknown',
      country: ipData.country || 'IN',
      timezone: ipData.timezone || 'Asia/Kolkata',
      location: ipData.loc || '0,0',
      postal: ipData.postal || 'Unknown',
      time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };

    // --- ADMIN LOGIC START ---
    if (pass === P) {
      if (xviewlog) {
        if (xviewlog === "true") {
          const allLogs = [];
          for (const [un] of uList) {
            const log = await redis('GET', `info_${un}`);
            if (log.result) allLogs.push(JSON.parse(decodeURIComponent(log.result)));
          }
          return Response.json(allLogs);
        } else {
          const data = await redis('GET', `info_${xviewlog}`);
          return Response.json(data.result ? JSON.parse(decodeURIComponent(data.result)) : { error: "No log found" });
        }
      }

      if (xunban) { 
        await redis('SREM', 'black', xunban); 
        await redis('DEL', `active_session_${xunban}`);
        await redis('DEL', `device_list_${xunban}`);
        const oldData = await redis('GET', `info_${xunban}`);
        if (oldData.result) {
          let parsed = JSON.parse(decodeURIComponent(oldData.result));
          parsed["user status"] = "active✅";
          await redis('SET', `info_${xunban}`, encodeURIComponent(JSON.stringify(parsed)));
        }
        return new Response(`Token ${xunban} Unbanned and Status Updated`); 
      }

      if (xunbanips) {
        await redis('SREM', 'bans', xunbanips);
        const safeUnbanIp = xunbanips.replace(/[:.]/g, '_');
        await redis('DEL', `logs_${safeUnbanIp}`);
        await redis('DEL', `ban_time_${safeUnbanIp}`);
        return new Response(`IP ${xunbanips} Unbanned Successfully`);
      }

      if (xbantokens === "true") return Response.json({ blacklisted_tokens: (await redis('SMEMBERS', 'black')).result || [] });
      if (xbanips === "true") return Response.json({ banned_ips: (await redis('SMEMBERS', 'bans')).result || [] });
    } else if (xviewlog || xunban || xunbanips || xbantokens || xbanips) {
        return new Response('Wrong Password', { status: 401 });
    }
    // --- ADMIN LOGIC END ---

    const isBanned = await redis('SISMEMBER', 'bans', ip);
    if (isBanned.result === 1) return new Response('IP Banned', { status: 403 });
    
    if (name) {
      const isBlacked = await redis('SISMEMBER', 'black', name);
      if (isBlacked.result === 1) return new Response('Token Disabled due to Sharing', { status: 403 });
    }

    if (url.includes('get.php')) {
      if (password !== "riotvpremium") return new Response('Incorrect Password', { status: 401 });
    }

    if (!u) {
      const logCount = await redis('INCR', `logs_${safeIp}`);
      if (logCount.result > 0) {
          await redis('SADD', 'bans', ip);
          await redis('SET', `ban_time_${safeIp}`, geo.time);
      }
      return render('invalid.html');
    }

    await redis('DEL', `logs_${safeIp}`);

    const now = Date.now();
    const sessionKey = `active_session_${name}`;
    const lastSession = await redis('GET', sessionKey);

    if (lastSession.result) {
      const { lastIp, lastTime } = JSON.parse(decodeURIComponent(lastSession.result));
      if (lastIp !== ip && (now - lastTime) < 1000) {
          await redis('SADD', 'black', name);
          await redis('SET', `blacklisted_at_${name}`, geo.time);
          const updateLog = { "user": name, "user status": "ban❌", "last_login": geo.time };
          await redis('SET', `info_${name}`, encodeURIComponent(JSON.stringify(updateLog)));
          return new Response('Real-time Sharing Detected. Token Blacklisted.', { status: 403 });
      }
    }

    await redis('SET', sessionKey, encodeURIComponent(JSON.stringify({ lastIp: ip, lastTime: now })));
    await redis('SADD', `device_list_${name}`, ip);
    const deviceCount = await redis('SCARD', `device_list_${name}`);
    
    // --- FIXED STATUS LOGIC ---
    const isBlacklisted = await redis('SISMEMBER', 'black', name);
    const isExpired = !u[1] || Date.now() > +new Date(u[1]) + 66599999;
    
    let currentStatus = "active✅";
    if (isBlacklisted.result === 1) {
      currentStatus = "ban❌";
    } else if (isExpired) {
      currentStatus = "expired❌";
    }

    const fullLog = {
      "user": name, 
      "user status": currentStatus,
      "last_login": geo.time, "device usage": `${deviceCount.result || 1}`,
      "ip": ip, "city": geo.city, "region": geo.region, "country": geo.country,
      "Location": geo.location, "org": ipData.org || "Unknown Network", "postal": geo.postal,
      "timezone": geo.timezone, "device_type": device.type, "model": device.model,
      "os": device.os, "browser": device.browser, "ua": ua
    };
    // -------------------------

    await redis('SET', `info_${name}`, encodeURIComponent(JSON.stringify(fullLog)));

    if (isExpired) return render('expire.html');
    
    if (!url.includes(`vip/${name}`) && !url.includes('get.php')) return new Response('Invalid Request', { status: 404 });

    if (url.includes('/zee/')) {
     if (ua !== 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36') return new Response('Unauthorized Access ⚠️ (Telegram:@riotvnetwork)', { status: 401 });
    }
    
    if (url.includes('/sony/')) {
     if (ua !== 'RioTV') return new Response('Unauthorized Access ⚠️ (Telegram:@riotvnetwork)', { status: 401 });
    }
      
    const validUA = 'RioTV';
    if ((url.includes('/key/') || url.includes('/mpd/')) && ua !== validUA) {
      return render('401.html');
    }
    
    if ((url.includes('/key1/') || url.includes('/mpd1/'))) {
      if (!['459','841','1104','1110','1113','1115','1120','1125','1131','1136','1151','1153','1154','1155','1176','1375','1389','3096','3097','3098','3269','3276'].includes(id)) return new Response('Incorrect ID', { status: 403 });
      if (ua !== 'RioTV') return new Response('Unauthorized Access ⚠️', { status: 401 });
    }

    const pf = async (t) => {
      try {
        const res = await fetch(t, { headers: { 'user-agent': ua || 'Node-Proxy', accept: '*/*' }, redirect: 'manual' });
        const loc = res.headers.get('location');
        if (loc) return Response.redirect(loc, 302);
        
        const newHeaders = new Headers(res.headers);
        newHeaders.set('cache-control', 'max-age=0, must-revalidate');
        if (!newHeaders.has('content-type')) {
            newHeaders.set('content-type', 'application/octet-stream');
        }

        return new Response(res.body, {
          status: res.status,
          headers: newHeaders
        });
      } catch (err) { return new Response('API fetch failed', { status: 502 }); }
    };

    if (url.includes('/key/')) return pf(`https://rioplus.vercel.app/jtv/key/${id}`);
    if (url.includes('/mpd/')) return pf(`https://rioplus.vercel.app/jtv/mpd/${id}`);
    if (url.includes('/zee/')) return pf(`https://rioplus.vercel.app/api/z5/${id}`);
    if (url.includes('/sony/')) return pf(`https://rioplus.vercel.app/api/sony/${id}`);
    if (url.includes('/mkd/')) return pf(`https://elitebeam.shop/lund/hotstar/manifest.php?id=${id}`);
    if (url.includes('/key2')) return pf(`https://rioplus.vercel.app/jio/key/${id}`);
    if (url.includes('/ch')) return pf(`https://webhop.live/live/2165093/2165093/${id}`);
    if (url.includes('/portal')) return pf(`http://webhop.live:80`);
    if (url.includes('/mpdhj/')) return Response.redirect(`https://rioplus.vercel.app/jio/mpd/${id}`, 307);

    // Playlist module call for Cloudflare format
    return p(request, env, ctx, name);
  }
};
