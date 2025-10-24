import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import mainResources from "./locale";
import fineTuningResources from "./fine-tuning/locale";

const resources = Object.fromEntries(
  Object.entries(mainResources).map(([lang, res]) => {
    return [lang, { ...(fineTuningResources as any)[lang], ...res }];
  })
);

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
    ns: ["translation", "fineTuning"],
    fallbackNS: "translation",
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });
