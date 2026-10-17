const DEFAULT_SITE = "https://check-thai-news-today.ruby-hippo-1728.chatgpt.site";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "check-thai-news",
    title: "ตรวจข่าวนี้กับ Thai Check News",
    contexts: ["selection", "page"]
  });
});

async function openChecker(text = "", pageUrl = "") {
  const stored = await chrome.storage.sync.get({ siteUrl: DEFAULT_SITE });
  const url = new URL(stored.siteUrl || DEFAULT_SITE);
  if (text) url.searchParams.set("q", text.slice(0, 1800));
  if (pageUrl && /^https:\/\//i.test(pageUrl)) url.searchParams.set("sourceUrl", pageUrl.slice(0, 2048));
  url.searchParams.set("from", "extension");
  url.hash = "search";
  await chrome.tabs.create({ url: url.toString() });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "check-thai-news") openChecker(info.selectionText || "", info.pageUrl || tab?.url || "");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_CHECKER" && (message.text || message.pageUrl)) {
    openChecker(message.text || "", message.pageUrl || "").then(() => sendResponse({ ok: true }));
    return true;
  }
});
