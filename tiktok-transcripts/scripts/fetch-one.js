// Paste into javascript_tool (action javascript_exec) on a tiktok.com/@name/video/<id> tab.
// Returns the title, duration and plain caption text for the open video.
(async () => {
  const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
  if (!el) return 'no page data (is this a video page? has it finished loading?)';
  const d = JSON.parse(el.textContent);
  const item = d['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct;
  if (!item) return 'no video in page data: ' + JSON.stringify(Object.keys(d['__DEFAULT_SCOPE__'] || {}));
  const caps = item.video?.claInfo?.captionInfos || [];
  const subs = item.video?.subtitleInfos || [];
  const urls = caps[0]?.urlList || (subs[0] ? [subs[0].Url] : []);
  const out = { id: item.id, author: item.author?.uniqueId, desc: item.desc, seconds: item.video?.duration, noCaption: urls.length === 0 };
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const t = await r.text();
      if (t.includes('WEBVTT')) {
        out.text = t.split('\n').filter(l => l && !l.startsWith('WEBVTT') && !/-->/.test(l)).join(' ');
        break;
      }
    } catch (e) { /* try the next URL */ }
  }
  if (!out.text && !out.noCaption) out.error = 'caption URLs found but none loaded';
  return JSON.stringify(out);
})()
