import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const locale = "de";
  const messages = (await import(`./de/common.json`)).default;
  return { locale, messages };
});
