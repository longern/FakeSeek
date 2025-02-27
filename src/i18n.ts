import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      Copy: "Copy",
      Delete: "Delete",
      "New Chat": "New Chat",
      Research: "Research",
      Retry: "Retry",
      Search: "Search",
      "Select Text": "Select Text",
      Send: "Send",
      "Send message...": "Send message...",
    },
  },
  "zh-CN": {
    translation: {
      Copy: "复制",
      Delete: "删除",
      "New Chat": "开启新对话",
      Research: "研究",
      Retry: "重试",
      Search: "搜索",
      "Select Text": "选择文本",
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
