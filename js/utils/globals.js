const API_ROOT = "https://adegdansk.pl/echo/techniplayer/controller/mytapi2.php";
const DEBUG = false;

export function debug_log(message) {
    if (DEBUG) { console.log(message); }
}

export function debug_warn(message) {
    if (DEBUG) { console.warn(message); }
}

export function debug_error(message) {
    if (DEBUG) { console.error(message); }
}

export function send_notif(title_text, message_text) {
    const notif = document.createElement('div');
    notif.classList.add('notification');
    notif.classList.add('w3-animate-left');

    const title = document.createElement('h3');
    const message = document.createElement('p');
    title.textContent = title_text;
    message.textContent = message_text;

    notif.appendChild(title);
    notif.appendChild(message);
    document.getElementById('notifications').appendChild(notif);

    setTimeout(function() { hide_notif(notif) }, 4000);
}

function hide_notif(notif) {
    notif.style.animation = 'slide-out 0.4s';
    const clone = notif.cloneNode(true);
    notif.parentNode.replaceChild(clone, notif);
    setTimeout(function() { document.getElementById('notifications').removeChild(clone); }, 400);
}