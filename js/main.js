import {
    debug_log,
    debug_warn,
    debug_error,
    send_notif
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

window.addEventListener("load", () => {
    const titles = document.getElementById("titles");
    const slider = document.getElementById("seek");
    
    const song_cover = document.getElementById("song-cover");
    const song_author = document.getElementById("song-author");
    const song_adder = document.getElementById("song-adder");
    const song_plays = document.getElementById("song-plays");

    // Listen For Events (Back, Pause, Skip)
    window.addEventListener("keydown/", (event) => {
        switch (event.key) {
            case "ArrowLeft":
                debug_log("Back");
                break;
            case "Enter":
                debug_log("Pause / Unpause");
                break;
            case "ArrowRight":
                debug_log("Skip");
                break;
            default:
                break;
        }
    });

    // Title Swap
    titles.addEventListener("click", () => {
        for (let i = 0; i < titles.children.length; i++) {
            let title = titles.children[i];
            let text = title.dataset.text === "Techniplayer" ? "Techn!player" : "Techniplayer"
            title.dataset.text = text;
            title.textContent = text;
        }
    });

    // Progress update
    slider.addEventListener("change", () => {
        let percent = slider.value / slider.max * 100.0;
        slider.style.background = `linear-gradient( 90deg, rgba(255, 255, 255, 0.9) ${percent-0.1}%, rgba(255, 255, 255, 0.4) ${percent+0.1}%)`;
    });

    // Initialize session
    const SID = init_session();
    
    const colorThief = new ColorThief();
    // const initArgs = {
    //     cover,
    //     titleScope,
    //     liquid,
    //     bgA,
    //     bgB,
    //     activeRef: activeBgRef,
    //     colorThief
    // };
    
    function load_song_data(song_id) {
        let song_data = get_song_by_id()
        song_author = song_data['']
    }

    // function applyTrackToUI(track, autoplay) {
    //     if (!track) return;


    // }
    load_song_data('0mcmXqehXE4');
});