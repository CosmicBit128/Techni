import { send_notif } from "./utils/globals.js";
import { initFromCover, swapCover } from "./background.js";

// send_notif("Błąd!", "Piosenka x nie działa! y, napraw ją.")

const activeBgRef = { current: null };

window.addEventListener("load", () => {
    const cover = document.getElementById("song-cover");

    const colorThief = new colorThief();
    const initArgs = {
        cover,
        titleScope,
        liquid,
        bgA,
        bgB,
        activeRef: activeBgRef,
        colorThief
    };

    function applyTrackToUI(track, autoplay) {
        if (!track) return;


    }
});