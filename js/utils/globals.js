export const API_ROOT = "https://adegdansk.pl/echo/techniplayer/controller/mytapi2.php";
const DEBUG = true;

// Logging
export function debug_log(...args) {
    if (DEBUG) { console.log(...args); }
}

export function debug_warn(...args) {
    if (DEBUG) { console.warn(...args); }
}

export function debug_error(...args) {
    if (DEBUG) { console.error(...args); }
}

// Notifications
export function send_notif(title_text, message_text) {
    const notif = document.createElement('div');
    notif.classList.add('notification', 'glass-card');
    
    const title = document.createElement('h3');
    const message = document.createElement('p');
    title.textContent = title_text;
    const lines = message_text.split('\n');
    lines.forEach((line, i) => {
        if (i > 0) message.appendChild(document.createElement('br'));
        message.appendChild(document.createTextNode(line));
    });

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

// Shuffle
export function fisher_yates_shuffle(arr) {
  	for (let i = arr.length - 1; i > 0; i--) {
    	const j = Math.floor(Math.random() * (i + 1));
    	[arr[i], arr[j]] = [arr[j], arr[i]];
  	}
  	return arr;
}