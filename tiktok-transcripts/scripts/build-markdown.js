// Paste into javascript_tool after bulk-fetch has finished (window.__all is full).
// Builds window.__md: an index table (all videos, newest first) and one section per video that has text.
// The date comes from the video id (the top bits of a TikTok id are a unix timestamp).
(() => {
  const dt = id => new Date(Number(BigInt(id) >> 32n) * 1000).toISOString().slice(0, 10);
  const vids = Object.values(window.__all).filter(v => !v.err).sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1));
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const withText = vids.filter(v => v.txt);
  let md = '# TikTok transcripts\n\n' +
    'Source: TikTok auto-generated English captions, fetched ' + new Date().toISOString().slice(0, 10) +
    ' from the public profile (' + vids.length + ' videos; ' + withText.length + ' have captions, ' +
    (vids.length - withText.length) + ' have none). Nothing was transcribed from audio. Wording is as captioned and uncorrected, ' +
    'so expect mishearings of names and jargon. Claims in the videos are the creator\'s own and unverified. For personal reference only.\n\n' +
    '## Index\n\n| Date | Length | Title / first words | Link |\n|---|---|---|---|\n';
  for (const v of vids) {
    let t = clean(v.desc);
    if (t.length < 14 && v.txt) t = '[' + v.txt.slice(0, 80) + '…]';
    if (!v.txt) t += ' (no captions)';
    md += `| ${dt(v.id)} | ${v.dur}s | ${t.replace(/\|/g, '/').slice(0, 110)} | ${v.url || ''} |\n`;
  }
  md += '\n## Transcripts\n\n';
  for (const v of withText) {
    md += `### ${dt(v.id)} (${v.dur}s): ${clean(v.desc) || '(no title)'}\n${v.url || ''}\n\n${clean(v.txt)}\n\n`;
  }
  window.__md = md;
  return JSON.stringify({ chars: md.length, videosWithText: withText.length, videosTotal: vids.length });
})()
