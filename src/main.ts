// todo
const app: HTMLDivElement = document.querySelector("#app")!;

const gameName = "Raul's D3";

document.title = gameName;

const header = document.createElement("h1");
header.innerHTML = gameName;

const button = document.createElement("button");
app.appendChild(header);
app.appendChild(button);
button.innerHTML = "Click me";

button.onclick = () => {
  alert("The button has been clicked");
};
