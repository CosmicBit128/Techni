import { send_notif } from "./utils/globals.js";
// import { initFromCover, swapCover } from "./background.js";

// send_notif("Błąd!", "Piosenka x nie działa! y, napraw ją.")

const activeBgRef = { current: null };

window.addEventListener("load", () => {
    const cover = document.getElementById("song-cover");
    const titles = document.getElementById("titles");
    const slider = document.getElementById("seek");

    

    const output = document.getElementById("debug");

    function showEvent(text) {
        output.textContent = text;
    }

    // Keyboard input (for testing arrows / buttons)
    window.addEventListener("keydown", (event) => {
        showEvent(`Key Down: ${event.key}`);
    });

    // Mouse click
    window.addEventListener("click", (event) => {
        showEvent(`Mouse Click: ${event.button}`);
    });

    titles.addEventListener("click", () => {
        for (let i = 0; i < titles.children.length; i++) {
            let title = titles.children[i];
            if (title.dataset.text === "Techniplayer") {
                title.dataset.text = "Techn!player";
                title.textContent = "Techn!player";
                // title.style.margin = '0 6px';
            } else {
                title.dataset.text = "Techniplayer";
                title.textContent = "Techniplayer";
                // title.style.margin = '0 5px';
            }
        }
    });

    slider.addEventListener("change", () => {
        let percent = slider.value / slider.max * 100.0;
        slider.style.background = `linear-gradient( 90deg, rgba(255, 255, 255, 0.9) ${percent-0.1}%, rgba(255, 255, 255, 0.4) ${percent+0.1}%)`;
    });

    const colorThief = new ColorThief();
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