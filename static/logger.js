export function logToServer(msg) {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/log", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(JSON.stringify({ msg }));
}
