const root = document.documentElement;
const locale = root.dataset.locale || "en";
const preferenceKey = "agent2cursor.language";
if (root.dataset.entry) {
  let preferred;
  try {
    preferred = localStorage.getItem(preferenceKey);
  } catch {
    /* Storage is optional. */
  }
  const language = ["en", "zh"].includes(preferred)
    ? preferred
    : navigator.language?.toLowerCase().startsWith("zh")
      ? "zh"
      : "en";
  location.replace(`/${language}/${location.search}${location.hash}`);
}
document.querySelectorAll("[data-language]").forEach((link) => {
  link.href += location.hash;
  link.addEventListener("click", () => {
    link.href = `/${link.dataset.language}/${location.hash}`;
    try {
      localStorage.setItem(preferenceKey, link.dataset.language);
    } catch {
      /* Links work without storage. */
    }
  });
});
let toastTimer;
function notify(message) {
  const toast = document.querySelector(".toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2500);
}
document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const code = document.getElementById(button.dataset.copy);
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.querySelector("span").textContent =
        document.body.dataset.copiedLabel;
      notify(document.body.dataset.copiedLabel);
      setTimeout(() => {
        button.querySelector("span").textContent =
          document.body.dataset.copyLabel;
      }, 2000);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
      notify(document.body.dataset.copyFailed);
    }
  });
});
const tabs = [...document.querySelectorAll("[data-input]")];
function chooseInput(tab, focus = false) {
  for (const item of tabs) {
    item.setAttribute("aria-selected", String(item === tab));
    item.tabIndex = item === tab ? 0 : -1;
  }
  const input = {
    claude: ".claude/agents",
    codex: ".codex/agents",
    skills: ".agents/skills",
  }[tab.dataset.input];
  document.getElementById("commands").setAttribute("aria-labelledby", tab.id);
  document.getElementById("command-0").textContent =
    `agent2cursor inspect ${input} --lang ${locale}`;
  document.getElementById("command-1").textContent =
    `agent2cursor convert ${input} --out ./my-agent --lang ${locale}`;
  if (focus) tab.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => chooseInput(tab));
  tab.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      chooseInput(tabs[next], true);
    }
  });
});
const demoVideo = document.getElementById("demo-video");
document.querySelector(".demo")?.addEventListener("toggle", (event) => {
  if (!event.target.open) demoVideo?.pause();
});
