import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      Delete: "Delete",
      "New Chat": "New Chat",
      Research: "Research",
      Search: "Search",
      Send: "Send",
      "Send message...": "Send message...",
    },
  },
  "zh-CN": {
    translation: {
      Delete: "删除",
      "New Chat": "开启新对话",
      Research: "研究",
      Search: "搜索",
      Send: "发送",
      "Send message...": "发送消息...",
    },
  },
};

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .use({
    type: "languageDetector",
    async: true,
    detect: (cb: (lang: string) => void) =>
      cb(typeof window !== "undefined" ? window.navigator.language : "en"),
    init: () => {},
    cacheUserLanguage: () => {},
  })
  .init({
    resources: resources,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });
