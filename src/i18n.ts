import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      Copy: "Copy",
      Delete: "Delete",
      "Generate Image": "Generate Image",
      "New Chat": "New Chat",
      Rename: "Rename",
      Research: "Research",
      Retry: "Retry",
      Search: "Search",
      "Select Text": "Select Text",
      Send: "Send",
      "Send message...": "Send message...",
      Settings: "Settings",
      "Thinking...": "Thinking...",
      "Thinking finished": "Thinking finished",
      Today: "Today",
      Yesterday: "Yesterday",
    },
  },
  "zh-CN": {
    translation: {
      Copy: "复制",
      Delete: "删除",
      "Generate Image": "生图",
      "New Chat": "开启新对话",
      Rename: "重命名",
      Research: "研究",
      Retry: "重试",
      Search: "搜索",
      "Select Text": "选择文本",
      Send: "发送",
      "Send message...": "发送消息...",
      Settings: "设置",
      "Thinking...": "思考中...",
      "Thinking finished": "思考完成",
      Today: "今天",
      Yesterday: "昨天",
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
