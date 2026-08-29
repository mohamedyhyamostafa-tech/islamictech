import { requireAdmin } from '../../_lib/auth.js';
import { json, error } from '../../_lib/response.js';

export async function onRequestGet({ request, env }) {
  try { await requireAdmin(request, env); }
  catch (e) { return error(e.message, e.status || 403); }

  const result = {};

  if (env.YOUTUBE_API_KEY && env.YOUTUBE_CHANNEL_ID) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${env.YOUTUBE_CHANNEL_ID}&key=${env.YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      if (data.items && data.items.length) {
        const stats = data.items[0].statistics;
        result.youtube = {
          channelTitle: data.items[0].snippet.title,
          subscribers: stats.subscriberCount, views: stats.viewCount, videos: stats.videoCount
        };
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO social_stats (platform, metric, value) VALUES ('YouTube','subscribers',?)`).bind(stats.subscriberCount),
          env.DB.prepare(`INSERT INTO social_stats (platform, metric, value) VALUES ('YouTube','views',?)`).bind(stats.viewCount)
        ]);
      }
    } catch { result.youtube = { error: 'تعذر جلب بيانات يوتيوب' }; }
  }

  if (env.FACEBOOK_PAGE_ID && env.FACEBOOK_PAGE_ACCESS_TOKEN) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}?fields=followers_count,fan_count,name&access_token=${env.FACEBOOK_PAGE_ACCESS_TOKEN}`
      );
      const data = await res.json();
      if (!data.error) {
        result.facebook = { pageName: data.name, followers: data.followers_count, fans: data.fan_count };
        await env.DB.prepare(`INSERT INTO social_stats (platform, metric, value) VALUES ('Facebook','followers',?)`)
          .bind(data.followers_count || data.fan_count || 0).run();
      }
    } catch { result.facebook = { error: 'تعذر جلب بيانات فيسبوك' }; }
  }

  return json({ ok: true, ...result });
}
