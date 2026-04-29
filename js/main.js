import {
    debug_log,
    debug_warn,
    debug_error,
    send_notif,
    fisher_yates_shuffle
} from "./utils/globals.js";
import {
    add_played,
    get_playlist_songs,
    get_playlists,
    get_song_by_id,
    get_users,
    init_session,
} from "./utils/api.js";
// import { initFromCover, swapCover } from "./background.js";

// send_notif("Błąd!", "Piosenka x nie działa! y, napraw ją.")

const activeBgRef = { current: null };

// YouTube
const yt = {
    player: null,
    ready: false
}
const listen_tracker = {
    playing: false,
    last_tick: 0,
    set_dur: false
}

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


// On Load
window.addEventListener("load", () => {
    const titles = document.getElementById("titles");
    const slider = document.getElementById("seek");
    const prev_song_btn = document.getElementById("prev-song-btn");
    const pause_btn = document.getElementById("pause-btn");
    const next_song_btn = document.getElementById("next-song-btn");
    
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

    // Initialize variables
    let sid = -1;
    let users = [];
    let playlists = [];
    var all_songs = [];
    var cache = {};
    var pages = [];
    var cursor = { page: 0, position: 0 };
    var latest = { page: 0, position: 0 };
    var state = {
        playing: false,
        duration: 0,
        current_video_id: ""
    };
    var selected_playlist = "3";
    var song_playing = 0;



    // ================== //
    //   Events/Buttons   //
    // ================== //

    // Listen For Events (Back, Pause, Skip)
    window.addEventListener("keydown", (event) => {
        switch (event.key) {
            case "ArrowLeft":
                previous_song();
                break;
            case "Enter":
                debug_log("Pause / Unpause");
                break;
            case "ArrowRight":
                next_song();
                break;
            default:
                break;
        }
    });

    // Control Buttons
    function set_play_visual(is_playing) {
        if (!pause_btn) return;
        pause_btn.dataset.state = is_playing ? "playing" : "paused";
        pause_btn.children.item(0).src = is_playing ? assets.pause : assets.play;
    }

    prev_song_btn.addEventListener("click", () => { previous_song(); });
    next_song_btn.addEventListener("click", () => { next_song(); });
    pause_btn.addEventListener("click", () => { toggle_play(); });

    // Move Between Songs
    function next_song() {
        cursor.position++;
        if (cursor.position >= all_songs.length) {
            cursor.position = 0;
            cursor.page++;
            if (!pages[cursor.page]) pages.push(create_page());
        }
        if (cursor.page > latest.page) latest.page = cursor.page;
        else if (cursor.page == latest.page && cursor.position > latest.position) latest.position = cursor.position;
        listen_tracker.set_dur = false;

        load_current_song();
    }
    function previous_song() {
        cursor.position--;
        if (cursor.position < 0) {
            cursor.page--;
            if (cursor.page < 0) {
                cursor.page = 0;
                cursor.position = 0;
                return;
            }
            cursor.position = all_songs.length - 1;
        }

        load_current_song();
    }
    function toggle_play() {
        if (!yt.player || !yt.ready || typeof YT === "undefined") return;

        state.playing = !state.playing;
        set_play_visual(state.playing);
        const s = yt.player.getPlayerState();
        if (s === YT.PlayerState.PLAYING || s === YT.PlayerState.BUFFERING) {
            yt.player.pauseVideo();
            state.playing = false;
            set_play_visual(false);
        } else {
            yt.player.playVideo();
            state.playing = true;
            set_play_visual(true);
        }
    }

    // Title Swap
    titles.addEventListener("click", () => {
        for (let i = 0; i < titles.children.length; i++) {
            let title = titles.children[i];
            let text = title.dataset.text === "Techniplayer" ? "Techn!player" : "Techniplayer"
            title.dataset.text = text;
            title.textContent = text;
        }
    });



    // =================== //
    //   Song Management   //
    // =================== //

    // Progress update
    slider.addEventListener("change", () => {
        const v = Number(slider.value) || 0;
        if (yt.player && yt.ready) {
            yt.player.seekTo(v, true);
        }
        let percent = v / slider.max * 100.0;
        slider.style.background = `linear-gradient( 90deg, rgba(255, 255, 255, 0.9) ${percent+0.3}%, rgba(255, 255, 255, 0.4) ${percent+0.4}%)`;
    });

    // Load a single song
    function load_song_data(song_id, plays) {
        state.current_video_id = song_id;
        get_song_by_id(song_id).then((song_data) => {
            debug_log(song_data.meta_data.cover_url);
            if (song_data.meta_data.cover_url != "on") song_cover.src = song_data.meta_data.cover_url;
            else song_cover.src = "https://adegdansk.pl/winrar/techni/public/icons/invalid_cover.jpg";
            song_title.textContent = song_data.meta_data.title;
            song_author.textContent = song_data.meta_data.author;
            song_adder.innerHTML = `<img src="${assets.user}">${users[song_data.added_by-1].username}`;
            song_plays.innerHTML = `<img src="${assets.note}">${plays}`;
        });
    }

    // Load playlist with the given ID
    async function load_playlist(id) {
        const data = await get_playlist_songs(id)
        let songs = data.entries;

        if (!yt.ready  || !yt.player) {
            await load_youtube_api();
            await init_youtube()
        }
        return songs;
    }



    // =========== //
    //   YouTube   //
    // =========== //

    // Initialize YouTube Player
    async function init_youtube(init_video) {
        return new Promise((resolve) => {
            let container = document.getElementById('youtube-player');
            if (!container) {
                container = document.createElement('div');
                container.id = 'youtube-player';
                document.body.appendChild(container);
            }

            yt.player = new YT.Player("yt-player-container", {
                host: "https://www.youtube-nocookie.com",
                width: "100%",
                height: "100%",
                videoId: init_video,
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

                        setBestPlaybackQuality();
                    },
                    onStateChange: on_state_change,
                    onError: (e) => {
                        debug_error("YouTube Error", e.data, "for video:", init_video);
                        send_notif("YouTube Error", `Error code: ${e} (${init_video})\nSkipping song`);
                    },
                },
            });
        });
    }

    // Set YouTube Video
    function load_video(track, autoplay) {
        if (!track || !track.video_id) return;
        if (!yt.player || !yt.ready) return;

        if (autoplay) {
            yt.player.loadVideoById(track.video_id);
            yt.player.playVideo();
            state.playing = true;
            set_play_visual(true);
        } else {
            yt.player.cueVideoById(track.video_id);
            state.playing = false;
            set_play_visual(false);
        }
    }

    function on_state_change(event) {
        if (typeof YT === "undefined") return;
        const playerState = event.data;

        if (playerState === YT.PlayerState.PLAYING) {
            state.playing = true;
            listen_tracker.playing = true;
            listen_tracker.last_tick = performance.now();
            set_play_visual(true);
            set_browse_mode(false);
        }

        if (
            playerState === YT.PlayerState.PAUSED ||
            playerState === YT.PlayerState.BUFFERING
        ) {
            state.playing = false;
            listen_tracker.playing = false;
            set_play_visual(false);
            set_browse_mode(true);
        }

        if (playerState === YT.PlayerState.ENDED) {
            state.playing = false;
            listen_tracker.playing = false;
            set_play_visual(false);
            set_browse_mode(true);
            next_song();
        }
    }



    // ================== //
    //   Initialization   //
    // ================== //
    init_session().then((data) => {
        sid = data.id;
    });
    get_users().then((data) => {
        users = data.users;
    });
    get_playlists().then((data) => {
        playlists = data.playlists;
    });
    load_playlist(selected_playlist).then((data) => {
        all_songs = data;
        pages = [create_page()];
        cursor.page = 0;
        cursor.position = 0;
        load_current_song();
    });

    // Create Random Mapping
    function create_page() {
        let map = [];
        for (let i = 0; i < all_songs.length; i++) map.push(i);
        fisher_yates_shuffle(map);
        return map;
    }

    // Load Song
    function load_current_song() {
        if (!pages[cursor.page]) {debug_log(pages); return};
        let songIndex = pages[cursor.page][cursor.position];
        let song = all_songs[songIndex];
        load_song_data(song.id, song.played);
    }


    
    // ======== //
    //   Tick   //
    // ======== //
    function tick() {
        if (!listen_tracker.set_dur && yt.player && yt.ready && slider && elapsed && remaining) {
            const dur = yt.player.getDuration();
            const cur = yt.player.getCurrentTime();

            if (Number.isFinite(dur) && dur > 0) {
                state.duration = dur;
                slider.max = String(Math.floor(dur));
            }
            listen_tracker.set_dur = true;
        }

        requestAnimationFrame(tick);
    }
});