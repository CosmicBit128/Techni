import {
    debug_log,
    debug_warn,
    debug_error,
    send_notif,
    fisher_yates_shuffle,
    format_time
} from "./utils/globals.js";
import {
    add_played,
    get_playlist_songs,
    get_playlists,
    get_song_by_id,
    get_users,
    init_session,
} from "./utils/api.js";

const QUALITY_PREFERENCE = [
    "highres",
    "hd2160",
    "hd1440",
    "hd1080",
    "hd720",
    "large",
    "medium",
    "small",
    "tiny",
    "default",
];

const yt = {
    player: null,
    ready: false,
};

const listen_tracker = {
    playing: false,
    last_tick: 0,
    set_dur: false,
};

const badIds = new Set();

// Matches original loadYouTubeApi exactly
function load_youtube_api() {
    return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
            resolve();
            return;
        }
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
        window.onYouTubeIframeAPIReady = () => resolve();
    });
}

// Matches original initYouTubePlayer exactly
function init_youtube(initial_video_id, on_state_change_cb) {
    return new Promise((resolve) => {
        let container = document.getElementById("youtube-player");
        if (!container) {
            container = document.createElement("div");
            container.id = "youtube-player";
            document.body.appendChild(container);
        }

        yt.player = new YT.Player("youtube-player", {
            host: "https://www.youtube-nocookie.com",
            width: "100%",
            height: "100%",
            videoId: initial_video_id,
            playerVars: {
                autoplay: 0,
                controls: 0,
                playsinline: 1,
                modestbranding: 1,
                rel: 0,
                origin: window.location.origin,
            },
            events: {
                onReady: (event) => {
                    yt.ready = true;
                    resolve();

                    const iframe = event.target.getIframe();
                    iframe.style.width = "100%";
                    iframe.style.height = "100%";
                    iframe.style.border = "0";
                    iframe.style.pointerEvents = "none";

                    set_best_quality();
                },
                onStateChange: on_state_change_cb,
                onError: (e) => {
                    // Matches original — just log, no auto-skip here
                    debug_error("YT ERROR", e.data, "for video:", initial_video_id);
                },
            },
        });
    });
}

function set_best_quality() {
    if (!yt.player || typeof yt.player.getAvailableQualityLevels !== "function") return;
    const levels = yt.player.getAvailableQualityLevels();
    if (!levels || !levels.length) return;
    const best = QUALITY_PREFERENCE.find((q) => levels.includes(q)) || levels[0];
    try {
        yt.player.setPlaybackQuality(best);
        document.body.dataset.ytQuality = best;
    } catch (e) {
        debug_warn("Unable to set playback quality:", e);
    }
}

// Matches original loadVideoForTrack exactly
function load_video_for_track(track, autoplay) {
    if (!track || !track.video_id) return;
    if (!yt.player || !yt.ready) return;

    if (autoplay) {
        yt.player.loadVideoById(track.video_id);
        yt.player.playVideo();
    } else {
        yt.player.cueVideoById(track.video_id);
    }
}


window.addEventListener("load", () => {
    const titles = document.getElementById("titles");
    const slider = document.getElementById("seek");
    const elapsed = document.getElementById("elapsed");
    const remaining = document.getElementById("remaining");
    const prev_song_btn = document.getElementById("prev-song-btn");
    const pause_btn = document.getElementById("pause-btn");
    const next_song_btn = document.getElementById("next-song-btn");
    const return_latest = document.getElementById("return-latest");
    const history_wrap = document.getElementById("history-wrap");
    const open_video_btn = document.getElementById("open-video");
    const song_cover = document.getElementById("song-cover");
    const song_title = document.getElementById("song-title");
    const song_author = document.getElementById("song-author");
    const song_adder = document.getElementById("song-adder");
    const song_plays = document.getElementById("song-plays");

    const assets = {
        back: "assets/back-arrow.svg",
        forward: "assets/forward-arrow.svg",
        play: "assets/play.svg",
        pause: "assets/pause.svg",
        note: "assets/note.svg",
        user: "assets/user.svg",
        volume: "assets/volume.svg",
        open_vid: "assets/open-vid.svg",
    };

    let sid = null;
    let users = [];
    let all_songs = [];
    let pages = [];
    let selected_playlist = "3";

    let cursor = { page: 0, position: 0 };
    let latest = { page: 0, position: 0 };

    let state = {
        playing: false,
        duration: 0,
        current_video_id: null,
    };


    // ================== //
    //   UI Helpers       //
    // ================== //

    function set_play_visual(is_playing) {
        if (!pause_btn) return;
        pause_btn.dataset.state = is_playing ? "playing" : "paused";
        pause_btn.children.item(0).src = is_playing ? assets.pause : assets.play;
    }

    function update_slider_gradient() {
        const val = Number(slider.value) || 0;
        const max = Number(slider.max)   || 1;
        const percent = (val / max) * 100;
        slider.style.background =
            `linear-gradient(90deg, rgba(255,255,255,0.9) ${percent + 0.3}%, rgba(255,255,255,0.4) ${percent + 0.4}%)`;
    }

    function is_at_latest() {
        return cursor.page === latest.page && cursor.position === latest.position;
    }

    function set_browse_mode(browsing) {
        const show = browsing && !is_at_latest();
        history_wrap.classList.toggle("is-visible", show);
    }


    // ================== //
    //   Events/Buttons   //
    // ================== //

    window.addEventListener("keydown", (event) => {
        switch (event.key) {
            case "ArrowLeft":  previous_song(); break;
            case "Enter":      toggle_play();   break;
            case "ArrowRight": next_song();     break;
        }
    });

    prev_song_btn.addEventListener("click", () => previous_song());
    next_song_btn.addEventListener("click", () => next_song());
    pause_btn.addEventListener("click",     () => toggle_play());

    return_latest.addEventListener("click", () => {
        cursor.page     = latest.page;
        cursor.position = latest.position;
        history_wrap.classList.remove("is-visible");
        load_current_song(true);
    });

    titles.addEventListener("click", () => {
        for (let i = 0; i < titles.children.length; i++) {
            const title = titles.children[i];
            const text  = title.dataset.text === "Techniplayer" ? "Techn!player" : "Techniplayer";
            title.dataset.text = text;
            title.textContent  = text;
        }
    });

    slider.addEventListener("change", () => {
        const v = Number(slider.value) || 0;
        if (yt.player && yt.ready) yt.player.seekTo(v, true);
        update_slider_gradient();
    });
    slider.addEventListener("input", update_slider_gradient);


    // ================== //
    //   Song Controls    //
    // ================== //

    function toggle_play() {
        if (!yt.player || !yt.ready || typeof YT === "undefined") return;
        const s = yt.player.getPlayerState();
        if (s === YT.PlayerState.PLAYING || s === YT.PlayerState.BUFFERING) {
            yt.player.pauseVideo();
        } else {
            yt.player.playVideo();
        }
    }

    function next_song() {
        cursor.position++;
        if (cursor.position >= all_songs.length) {
            cursor.position = 0;
            cursor.page++;
            if (!pages[cursor.page]) pages.push(create_page());
        }
        if (cursor.page > latest.page) {
            latest.page     = cursor.page;
            latest.position = cursor.position;
        } else if (cursor.page === latest.page && cursor.position > latest.position) {
            latest.position = cursor.position;
        }
        listen_tracker.set_dur = false;
        set_browse_mode(false);
        load_current_song(true);
    }

    function previous_song() {
        cursor.position--;
        if (cursor.position < 0) {
            cursor.page--;
            if (cursor.page < 0) {
                cursor.page     = 0;
                cursor.position = 0;
                return;
            }
            cursor.position = all_songs.length - 1;
        }
        set_browse_mode(true);
        load_current_song(true);
    }


    // =================== //
    //   Song Management   //
    // =================== //

    // Matches original playSongById
    async function play_song_by_id(video_id, autoplay = true) {
        if (!video_id) return null;
        if (badIds.has(video_id)) {
            debug_warn("Skipping known bad ID:", video_id);
            next_song();
            return null;
        }

        let track;
        try {
            track = await get_song_by_id(video_id);
        } catch (err) {
            debug_warn("Failed to load song:", video_id, err);
            badIds.add(video_id);
            next_song();
            return null;
        }

        state.current_video_id = video_id;
        apply_track_to_ui(track, autoplay);
        return track;
    }

    // Matches original applyTrackToUI
    function apply_track_to_ui(track, autoplay) {
        if (!track) return;

        listen_tracker.set_dur = false;

        const meta     = track.meta_data || {};
        const video_id = track.video_id || state.current_video_id;

        // Open-video link
        if (open_video_btn) {
            const anchor = open_video_btn.querySelector("a");
            if (anchor) anchor.href = `https://www.youtube.com/watch?v=${video_id}`;
        }

        // Cover
        const cover_url = meta.cover_url;
        song_cover.src = (cover_url && cover_url !== "on")
            ? cover_url
            : "https://adegdansk.pl/winrar/techni/public/icons/invalid_cover.jpg";

        // Text
        song_title.textContent  = meta.title  || "Nieznany utwór";
        song_author.textContent = meta.author || "Nieznany autor";

        // Pills
        const adder = users[track.added_by - 1];
        song_adder.innerHTML = `<img src="${assets.user}">${adder ? adder.username : "?"}`;

        const entry = all_songs.find(s => s.video_id === String(video_id));
        song_plays.innerHTML = `<img src="${assets.note}">${entry ? entry.played : 0}`;

        // Hand off to YouTube — matches original
        load_video_for_track({ video_id }, autoplay);
    }


    // ======================== //
    //   YouTube State Change   //
    // ======================== //

    function on_youtube_state_change(event) {
        if (typeof YT === "undefined") return;
        const s = event.data;

        if (s === YT.PlayerState.PLAYING) {
            state.playing = true;
            listen_tracker.playing   = true;
            listen_tracker.last_tick = performance.now();
            set_play_visual(true);
            set_browse_mode(false);
        }

        if (s === YT.PlayerState.PAUSED) {
            state.playing          = false;
            listen_tracker.playing = false;
            set_play_visual(false);
        }

        if (s === YT.PlayerState.ENDED) {
            state.playing          = false;
            listen_tracker.playing = false;
            set_play_visual(false);
            next_song();
        }
    }


    // ================== //
    //   Initialization   //
    // ================== //

    function create_page() {
        const map = [];
        for (let i = 0; i < all_songs.length; i++) map.push(i);
        fisher_yates_shuffle(map);
        debug_log("New shuffle page:", map);
        return map;
    }

    function load_current_song(autoplay = true) {
        if (!pages[cursor.page]) { debug_warn("No page at", cursor.page); return; }
        const song_index = pages[cursor.page][cursor.position];
        const song       = all_songs[song_index];
        if (!song) { debug_warn("No song at index", song_index); return; }
        play_song_by_id(song.video_id, autoplay);
    }

    async function bootstrap() {
        // Matches original bootApi — individual try/catch per call
        try { sid = await init_session(); } catch (_) { debug_warn("Failed to init session"); }

        try {
            const raw = await get_users();
            users = raw.users || [];
        } catch (err) { debug_warn("Failed to load users", err); }

        // Matches original loadPlaylist
        const { entries } = await get_playlist_songs(selected_playlist);
        all_songs = entries || [];

        if (!all_songs.length) {
            debug_warn("Playlist is empty");
            return;
        }

        // Pick random first video — matches original exactly
        const random_index   = Math.floor(Math.random() * all_songs.length);
        const first_video_id = all_songs[random_index].video_id;

        // Init YouTube with real first video, no placeholder — matches original
        if (!yt.ready || !yt.player) {
            await load_youtube_api();
            await init_youtube(first_video_id, on_youtube_state_change);
        }

        // Build shuffle
        pages           = [create_page()];
        cursor.page     = 0;
        cursor.position = 0;
        latest.page     = 0;
        latest.position = 0;

        // Point cursor at the song that was already loaded into the player
        const idx_in_page = pages[0].findIndex(i => all_songs[i].video_id === first_video_id);
        if (idx_in_page !== -1) cursor.position = idx_in_page;

        // autoplay = false on first load, matches original — no browser autoplay fight
        await play_song_by_id(first_video_id, false);
    }

    bootstrap().catch((err) => {
        debug_error("Bootstrap failed:", err);
        send_notif("Błąd!", "Nie udało się załadować odtwarzacza.");
    });


    // ======== //
    //   Tick   //
    // ======== //

    function tick() {
        if (yt.player && yt.ready) {
            const dur = yt.player.getDuration();
            const cur = yt.player.getCurrentTime();

            if (!listen_tracker.set_dur && Number.isFinite(dur) && dur > 0) {
                state.duration         = dur;
                slider.max             = String(Math.floor(dur));
                listen_tracker.set_dur = true;
            }

            if (!slider.matches(":active") && Number.isFinite(cur) && cur >= 0) {
                slider.value = String(Math.floor(cur));
                update_slider_gradient();
            }

            const cur_display = Number(slider.value) || 0;
            const dur_display = Number(slider.max)   || 0;

            if (elapsed)   elapsed.textContent   = format_time(cur_display);
            if (remaining) remaining.textContent  = dur_display > 0
                ? `-${format_time(dur_display - cur_display)}`
                : "-0:00";
        }

        requestAnimationFrame(tick);
    }

    tick();
});
