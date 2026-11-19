// Paste into javascript_tool ONCE on the creator's profile tab, after window.__links is set
// (an array of full https://www.tiktok.com/@name/video/<id> URLs).
// It defines window.__run(budgetMs). Then call: (async () => JSON.stringify(await window.__run(30000)))()
// again and again until `have` equals `total`. Results accumulate in window.__all (keyed by video id).
// Keep budgetMs at or under about 32000: the tool times out at 45 s.
window.__all = window.__all || {};
window.__run = async (budgetMs) => {
  async function one(url) {
    const id = url.split('/').pop();
    try {
      const r = await fetch(url, { credentials: 'include' });
      const html = await r.text();
      const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) return { id, url, err: 'no page data, status ' + r.status };
      const d = JSON.parse(m[1]);
      const item = d['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct;
      if (!item) return { id, url, err: 'no video in page data' };
      const caps = item.video?.claInfo?.captionInfos || [];
      const subs = item.video?.subtitleInfos || [];
      const urls = caps[0]?.urlList || (subs[0] ? [subs[0].Url] : []);
      let txt = null;
      for (const u of urls) {
        try {
          const rr = await fetch(u);
          if (rr.ok) {
            const t = await rr.text();
            if (t.includes('WEBVTT')) {
              txt = t.split('\n').filter(l => l && !l.startsWith('WEBVTT') && !/-->/.test(l)).join(' ');
              break;
            }
          }
        } catch (e) { /* next URL */ }
      }
      return { id, url, desc: item.desc, dur: item.video?.duration, txt, noCaption: urls.length === 0 };
    } catch (e) { return { id, url, err: String(e) }; }
  }
  const t0 = Date.now();
  for (const u of window.__links) {
    if (Date.now() - t0 > budgetMs) break;
    const id = u.split('/').pop();
    if (window.__all[id] && !window.__all[id].err) continue;   // done (retry errors)
    window.__all[id] = await one(u);
    await new Promise(r => setTimeout(r, 200));                 // gentle pace
  }
  const vals = Object.values(window.__all);
  return {
    total: window.__links.length,
    have: vals.filter(v => !v.err).length,
    withText: vals.filter(v => v.txt).length,
    noCaption: vals.filter(v => v.noCaption).length,
    errors: vals.filter(v => v.err).map(v => v.err).slice(0, 5),
  };
};
'bulk-fetch ready'
