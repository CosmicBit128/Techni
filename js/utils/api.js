import {
    API_ROOT,
    debug_log,
    debug_warn,
    debug_error,
} from "./globals.js";

async function fetch_json(baseUrl) {
    const cacheBust = `_ts=${Date.now()}`;
    const url = baseUrl.includes("?")
        ? `${baseUrl}&${cacheBust}`
        : `${baseUrl}?${cacheBust}`;

    const res = await fetch(url, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        headers: {
            Accept: "application/json",
        },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data.code === "error") throw new Error(data.reason || "Unknown API error");
    return data;
}


// Init session, returns { id } (session_id)
export async function init_session() {
    const url = `${API_ROOT}?init`;
    const data = await fetch_json(url);
    debug_log("Init:", data);
    return data.id;
}

// get_rndt_user={user_id}
// Returns random tracks for given user.
// { code: "ok", tracks: [track, ...], track_count: n }
export async function get_tracks_for_user(userId) {
  const url = `${API_ROOT}?get_rndt_user=${encodeURIComponent(userId)}`;
  const data = await fetch_json(url);
  debug_log("Tracks for user:", userId, data);
  return {
    tracks: data.tracks || [],
    count: data.track_count ?? (data.tracks ? data.tracks.length : 0),
  };
}

// Returns list of users:
// { code: "ok", users: [{ user_id, username, ... }], users_count: n }
export async function get_users() {
  const url = `${API_ROOT}?get_users`;
  const data = await fetch_json(url);
  debug_log("All Users:", data);
  return data;
}

// Returns playlists, e.g.:
// Api return: { code: "ok", playlists: [{ id / playlist_id, name / playlist_name / title, ... }], playlist_count: n }
// Normalized: { count: number, playlists: [{ id: string, name: string, ...original }]}
export async function get_playlists() {
    const url = `${API_ROOT}?get_playlists`;
    const data = await fetch_json(url);
    debug_log("All Playlists:", data);

    const raw = Array.isArray(data.playlists)
        ? data.playlists
        : Array.isArray(data)
        ? data
        : [];

    const playlists = raw.map((pl, idx) => {
        const id = pl.id ?? pl.playlist_id ?? idx;
        const name = pl.name ?? pl.playlist_name ?? pl.title ?? `Playlista ${id}`;

        return { id: String(id), name, ...pl };
    });

    return {
        count: data.playlist_count ?? data.count ?? playlists.length,
        playlists,
    };
}

// Returns all songs in a playlist along with a play count for each song
// Api return: { code: "ok", songs: [{ id, played }, ...], song_count: n }
// or just the array [{ id, played }, ...] (who the fuck made this system bro wtf you mean "or"?)
// Normalized: { entries: [{ id: string, played: number, ...raw }], count: number }
export async function get_playlist_songs(playlistId) {
    const url = `${API_ROOT}?get_all_songs_in_playlist=${encodeURIComponent(
        playlistId
    )}`;
    const data = await fetch_json(url);
    debug_log("All songs in playlist:", playlistId, data);

    const raw = Array.isArray(data.songs)
        ? data.songs
        : Array.isArray(data.tracks)
        ? data.tracks
        : Array.isArray(data)
        ? data
        : [];

  // REAL full tracks must have meta_data, not just video_id
  const looksLikeFullTrack = raw[0] && raw[0].meta_data;

  let preloadTracks = null;
  let entries;

  if (looksLikeFullTrack) {
    // current backend: full track objects already here
    preloadTracks = raw;
    entries = raw.map((track, idx) => {
      const videoId =
        track.video_id || track.id || track.song_id || track.track_id || idx;

      const played = Number(
        track.played ?? track.plays ?? track.play_count ?? 0
      );

      return {
        id: String(videoId), // id == video_id
        video_id: String(videoId),
        played,
        ...track,
      };
    });
  } else {
    // IDs + played only (no meta_data yet)
    entries = raw.map((item, idx) => {
      const videoId =
        item.video_id || item.id || item.song_id || item.track_id || idx;

      const played = Number(item.played ?? item.plays ?? item.play_count ?? 0);

      return {
        id: String(videoId), // id == video_id
        video_id: String(videoId),
        played,
        ...item,
      };
    });
  }

  const count =
    data.song_count ?? data.track_count ?? data.count ?? entries.length;

  return {
    entries,
    count,
    tracks: preloadTracks, // null?
  };
}

/**
 * Expected shape (single track):
 * {
 *   "video_id": "{youtube video id}",
 *   "duration": "{reserved}",
 *   "meta_data": {
 *     "title": "{title}",
 *     "author": "{credited person/object}",
 *     "cover_url": "{url to image}",
 *     "meta": { ... free shape json }
 *   },
 *   "added_by": "{user id}"
 * }
 */
export async function get_song_by_id(songId) {
  const url = `${API_ROOT}?get_song_by_id=${encodeURIComponent(songId)}`;
  const data = await fetch_json(url);

  debug_log("Raw song by ID response:", data);
  return data;
}


// API?add_played={videoId}&playlist_id={playlistId}
// Registers a valid play, and why tf is there no verification?
export async function add_played(videoId, playlistId) {
    if (!videoId || !playlistId) return;

    try {
        const body = new URLSearchParams({
            add_played: videoId,
            playlist_id: playlistId,
        });

        const res = await fetch(ROOT, {
            method: "POST",
            mode: "cors",
            cache: "no-store",
            credentials: "omit",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                Accept: "application/json",
            },
            body,
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data.code === "error") {
            throw new Error(data.reason || "Unknown API error");
        }

        debug_log("Add Played:", videoId, playlistId, data);
        return data;
  } catch (err) {
        debug_warn("add_played failed:", err);
  }
}
