export type LocalizedMarketDisplay = {
  title: string;
  location: string;
};

const LOCATION_ZH_BY_CODE: Record<string, string> = {
  NYC: "\u7ebd\u7ea6",
  CHI: "\u829d\u52a0\u54e5",
  LA: "\u6d1b\u6749\u77f6",
  LND: "\u4f26\u6566",
};

const LOCATION_ZH_BY_NAME: Record<string, string> = {
  "New York": "\u7ebd\u7ea6",
  "New York City": "\u7ebd\u7ea6",
  Chicago: "\u829d\u52a0\u54e5",
  "Los Angeles": "\u6d1b\u6749\u77f6",
  London: "\u4f26\u6566",
  Atlanta: "\u4e9a\u7279\u5170\u5927",
  Seoul: "\u9996\u5c14",
  Wellington: "\u60e0\u7075\u987f",
  "Buenos Aires": "\u5e03\u5b9c\u8bfa\u65af\u827e\u5229\u65af",
  "Sao Paulo": "\u5723\u4fdd\u7f57",
  Toronto: "\u591a\u4f26\u591a",
  Seattle: "\u897f\u96c5\u56fe",
  Miami: "\u8fc8\u963f\u5bc6",
  Polymarket: "\u5e73\u53f0",
};

const MONTH_TO_NUMBER: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

export const MARKET_LOCALIZED_BY_ID: Record<string, LocalizedMarketDisplay> = {
  NYC_GT_85: { title: "\u7ebd\u7ea6 > 29.4\u00B0C", location: "\u7ebd\u7ea6" },
  NYC_75_85: { title: "\u7ebd\u7ea6 23.9\u00B0C-29.4\u00B0C", location: "\u7ebd\u7ea6" },
  NYC_LT_75: { title: "\u7ebd\u7ea6 < 23.9\u00B0C", location: "\u7ebd\u7ea6" },
  CHI_GT_80: { title: "\u829d\u52a0\u54e5 > 26.7\u00B0C", location: "\u829d\u52a0\u54e5" },
  LA_GT_90: { title: "\u6d1b\u6749\u77f6 > 32.2\u00B0C", location: "\u6d1b\u6749\u77f6" },
  LND_GT_20: { title: "\u4f26\u6566 > 20\u00B0C", location: "\u4f26\u6566" },
  LND_LT_15: { title: "\u4f26\u6566 < 15\u00B0C", location: "\u4f26\u6566" },
};

function fahrenheitToCelsius(value: number): number {
  return ((value - 32) * 5) / 9;
}

function formatCelsius(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}\u00B0C` : `${rounded.toFixed(1)}\u00B0C`;
}

function normalizeBrokenTemperatureUnit(title: string): string {
  return title
    .replace(/\u2103/g, "\u00B0C")
    .replace(/\u2109/g, "\u00B0F")
    .replace(/\u00BA/g, "\u00B0")
    .replace(/Â\u00B0/g, "\u00B0")
    .replace(/([0-9.])\s*[?��]+o\s*([FC])\b/gi, "$1\u00B0$2")
    .replace(/([0-9.])\s*[?��]+([FC])\b/gi, "$1\u00B0$2")
    .replace(/(\d)\s*[\uFFFD�?]{1,3}\s*([FC])\b/gi, "$1\u00B0$2")
    .replace(/(\d)\s*[\uFFFD�?]{1,3}\s*\u00B0\s*([FC])\b/gi, "$1\u00B0$2")
    .replace(/(\d)\s*[^0-9A-Za-z\s]{1,2}\s*([FC])\b/gi, "$1\u00B0$2")
    .replace(/\u00B0{2,}/g, "\u00B0");
}

function toChineseMonth(monthToken: string): string {
  const monthNumber = MONTH_TO_NUMBER[monthToken.toLowerCase()];
  if (!monthNumber) {
    return monthToken;
  }
  return `${monthNumber}\u6708`;
}

function ordinalWordToChinese(raw: string): string | null {
  const normalized = raw.toLowerCase();
  const map: Record<string, string> = {
    "1st": "\u7b2c1",
    "2nd": "\u7b2c2",
    "3rd": "\u7b2c3",
    "4th": "\u7b2c4",
    "5th": "\u7b2c5",
    "6th": "\u7b2c6",
    "7th": "\u7b2c7",
    "8th": "\u7b2c8",
    "9th": "\u7b2c9",
    "10th": "\u7b2c10",
    second: "\u7b2c2",
    third: "\u7b2c3",
    fourth: "\u7b2c4",
    fifth: "\u7b2c5",
    sixth: "\u7b2c6",
    seventh: "\u7b2c7",
    eighth: "\u7b2c8",
    ninth: "\u7b2c9",
    tenth: "\u7b2c10",
  };
  return map[normalized] ?? null;
}

export function normalizeMarketTitleToCelsius(title: string): string {
  const cleanedTitle = normalizeBrokenTemperatureUnit(title);

  const normalizedRange = cleanedTitle.replace(
    /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\u00B0?\s*F\b/gi,
    (_, leftRaw: string, rightRaw: string) => {
      const left = Number(leftRaw);
      const right = Number(rightRaw);
      return `${formatCelsius(fahrenheitToCelsius(left))}-${formatCelsius(fahrenheitToCelsius(right))}`;
    },
  );

  const normalizedFahrenheit = normalizedRange.replace(
    /([<>]=?)\s*(\d+(?:\.\d+)?)\s*\u00B0?\s*F\b/gi,
    (_, operator: string, valueRaw: string) => {
      const value = Number(valueRaw);
      return `${operator} ${formatCelsius(fahrenheitToCelsius(value))}`;
    },
  );

  const normalizedSingleFahrenheit = normalizedFahrenheit.replace(
    /(-?\d+(?:\.\d+)?)\s*\u00B0?\s*F\b/gi,
    (_, valueRaw: string) => {
      const value = Number(valueRaw);
      return formatCelsius(fahrenheitToCelsius(value));
    },
  );

  return normalizedSingleFahrenheit.replace(/(\d+(?:\.\d+)?)\s*\u00B0?\s*C\b/gi, (_, valueRaw: string) => {
    const value = Number(valueRaw);
    return formatCelsius(value);
  });
}

function normalizeCityName(rawCity: string): string {
  return rawCity.replace(/\s+/g, " ").trim();
}

function resolveCityChinese(rawCity: string): string {
  const city = normalizeCityName(rawCity);
  return LOCATION_ZH_BY_NAME[city] ?? city;
}

function toChineseDate(monthToken: string, dayToken: string): string {
  const monthNumber = MONTH_TO_NUMBER[monthToken.toLowerCase()];
  if (!monthNumber) {
    return `${monthToken} ${dayToken}`;
  }
  return `${monthNumber}\u6708${Number(dayToken)}\u65e5`;
}

function localizeQuestionToChinese(title: string): string | null {
  const rangeMatch = title.match(
    /^Will the highest temperature in ([A-Za-z\s.'-]+?) be between (-?\d+(?:\.\d+)?)\u00B0C\s*-\s*(-?\d+(?:\.\d+)?)\u00B0C on ([A-Za-z]+)\s+(\d{1,2})\?$/i,
  );
  if (rangeMatch) {
    const [, cityRaw, left, right, monthRaw, dayRaw] = rangeMatch;
    const city = resolveCityChinese(cityRaw);
    const date = toChineseDate(monthRaw, dayRaw);
    return `${city}${date}\u6700\u9ad8\u6c14\u6e29\u4f1a\u5728${left}\u00B0C\u81f3${right}\u00B0C\u4e4b\u95f4\u5417\uff1f`;
  }

  const boundMatch = title.match(
    /^Will the highest temperature in ([A-Za-z\s.'-]+?) be (-?\d+(?:\.\d+)?)\u00B0C or (below|above|higher|lower) on ([A-Za-z]+)\s+(\d{1,2})\?$/i,
  );
  if (boundMatch) {
    const [, cityRaw, value, direction, monthRaw, dayRaw] = boundMatch;
    const city = resolveCityChinese(cityRaw);
    const date = toChineseDate(monthRaw, dayRaw);
    if (direction.toLowerCase() === "below" || direction.toLowerCase() === "lower") {
      return `${city}${date}\u6700\u9ad8\u6c14\u6e29\u4f1a\u4f4e\u4e8e\u6216\u7b49\u4e8e${value}\u00B0C\u5417\uff1f`;
    }
    return `${city}${date}\u6700\u9ad8\u6c14\u6e29\u4f1a\u9ad8\u4e8e\u6216\u7b49\u4e8e${value}\u00B0C\u5417\uff1f`;
  }

  const exactMatch = title.match(
    /^Will the highest temperature in ([A-Za-z\s.'-]+?) be (-?\d+(?:\.\d+)?)\u00B0C on ([A-Za-z]+)\s+(\d{1,2})\?$/i,
  );
  if (exactMatch) {
    const [, cityRaw, value, monthRaw, dayRaw] = exactMatch;
    const city = resolveCityChinese(cityRaw);
    const date = toChineseDate(monthRaw, dayRaw);
    return `${city}${date}\u6700\u9ad8\u6c14\u6e29\u4f1a\u8fbe\u5230${value}\u00B0C\u5417\uff1f`;
  }

  const earthquakeMatch = title.match(/^(\d+(?:\.\d+)?)\s+or above earthquake before (\d{4})\?$/i);
  if (earthquakeMatch) {
    const [, magnitude, year] = earthquakeMatch;
    return `${year}\u5e74\u524d\u4f1a\u53d1\u751f${magnitude}\u7ea7\u53ca\u4ee5\u4e0a\u5730\u9707\u5417\uff1f`;
  }

  const hottestRankMatch = title.match(/^Where will (\d{4}) rank among the hottest years on record\?$/i);
  if (hottestRankMatch) {
    const [, year] = hottestRankMatch;
    return `${year}\u5e74\u5728\u6709\u8bb0\u5f55\u4ee5\u6765\u6700\u70ed\u5e74\u4efd\u4e2d\u4f1a\u6392\u7b2c\u51e0\uff1f`;
  }

  const hottestYearMatch = title.match(/^Will (\d{4}) be the hottest year on record\?$/i);
  if (hottestYearMatch) {
    const [, year] = hottestYearMatch;
    return `${year}\u5e74\u4f1a\u6210\u4e3a\u6709\u8bb0\u5f55\u4ee5\u6765\u6700\u70ed\u7684\u4e00\u5e74\u5417\uff1f`;
  }

  const nthHottestYearMatch = title.match(
    /^Will (\d{4}) be the (second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)-hottest year on record\?$/i,
  );
  if (nthHottestYearMatch) {
    const [, year, ordinalRaw] = nthHottestYearMatch;
    const ordinal = ordinalWordToChinese(ordinalRaw) ?? ordinalRaw;
    return `${year}\u5e74\u4f1a\u6210\u4e3a\u6709\u8bb0\u5f55\u4ee5\u6765${ordinal}\u70ed\u7684\u4e00\u5e74\u5417\uff1f`;
  }

  const nthHottestMonthMatch = title.match(/^Will ([A-Za-z]+)\s+(\d{4}) be the (\d+(?:st|nd|rd|th)) hottest on record\?$/i);
  if (nthHottestMonthMatch) {
    const [, monthRaw, year, ordinalRaw] = nthHottestMonthMatch;
    const month = toChineseMonth(monthRaw);
    const ordinal = ordinalWordToChinese(ordinalRaw) ?? `\u7b2c${ordinalRaw}`;
    return `${year}\u5e74${month}\u4f1a\u6210\u4e3a\u6709\u8bb0\u5f55\u4ee5\u6765${ordinal}\u70ed\u5417\uff1f`;
  }

  const naturalDisasterMatch = title.match(/^Natural Disaster in (\d{4})\?$/i);
  if (naturalDisasterMatch) {
    const [, year] = naturalDisasterMatch;
    return `${year}\u5e74\u4f1a\u53d1\u751f\u91cd\u5927\u81ea\u7136\u707e\u5bb3\u5417\uff1f`;
  }

  const meteorMegatonMatch = title.match(/^(\d+(?:\.\d+)?)\s*megaton meteor strike in (\d{4})\?$/i);
  if (meteorMegatonMatch) {
    const [, megaton, year] = meteorMegatonMatch;
    return `${year}\u5e74\u4f1a\u53d1\u751f${megaton}\u5146\u5428\u7ea7\u9668\u77f3\u649e\u51fb\u5417\uff1f`;
  }

  const meteorKtMajorMatch = title.match(/^Major meteor strike \((\d+(?:\.\d+)?)kt\+\) in (\d{4})\?$/i);
  if (meteorKtMajorMatch) {
    const [, kt, year] = meteorKtMajorMatch;
    return `${year}\u5e74\u4f1a\u53d1\u751f\u91cd\u5927\u9668\u77f3\u649e\u51fb\uff08${kt}\u5343\u5428\u7ea7\u53ca\u4ee5\u4e0a\uff09\u5417\uff1f`;
  }

  const meteorKtMatch = title.match(/^(\d+(?:\.\d+)?)kt meteor strike in (\d{4})\?$/i);
  if (meteorKtMatch) {
    const [, kt, year] = meteorKtMatch;
    return `${year}\u5e74\u4f1a\u53d1\u751f${kt}\u5343\u5428\u7ea7\u9668\u77f3\u649e\u51fb\u5417\uff1f`;
  }

  const volcanoMatch = title.match(/^Major volcano eruption \(VEI .*?(\d+)\) in (\d{4})\?$/i);
  if (volcanoMatch) {
    const [, vei, year] = volcanoMatch;
    return `${year}\u5e74\u4f1a\u53d1\u751f\u706b\u5c71\u7206\u53d1\u6307\u6570${vei}\u7ea7\u7684\u91cd\u5927\u706b\u5c71\u55b7\u53d1\u5417\uff1f`;
  }

  const megaquakeMatch = title.match(/^Megaquake by ([A-Za-z]+)\s+(\d{1,2})\?$/i);
  if (megaquakeMatch) {
    const [, monthRaw, dayRaw] = megaquakeMatch;
    const date = toChineseDate(monthRaw, dayRaw);
    return `${date}\u524d\u4f1a\u53d1\u751f\u7279\u5927\u5730\u9707\u5417\uff1f`;
  }

  const earthquakeExactCountMatch = title.match(
    /^Will there be exactly (\d+) earthquakes of magnitude (\d+(?:\.\d+)?) or higher worldwide by ([A-Za-z]+)\s+(\d{1,2})\?$/i,
  );
  if (earthquakeExactCountMatch) {
    const [, count, magnitude, monthRaw, dayRaw] = earthquakeExactCountMatch;
    const date = toChineseDate(monthRaw, dayRaw);
    return `${date}\u524d\u5168\u7403\u4f1a\u53d1\u751f\u6070\u597d${count}\u6b21${magnitude}\u7ea7\u53ca\u4ee5\u4e0a\u5730\u9707\u5417\uff1f`;
  }

  const earthquakeRangeCountMatch = title.match(
    /^Will there be between (\d+) and (\d+) earthquakes of magnitude (\d+(?:\.\d+)?) or higher worldwide in (\d{4})\?$/i,
  );
  if (earthquakeRangeCountMatch) {
    const [, left, right, magnitude, year] = earthquakeRangeCountMatch;
    return `${year}\u5e74\u5168\u7403\u4f1a\u53d1\u751f${left}\u5230${right}\u6b21${magnitude}\u7ea7\u53ca\u4ee5\u4e0a\u5730\u9707\u5417\uff1f`;
  }

  const earthquakeAtLeastCountMatch = title.match(
    /^Will there be (\d+) or more earthquakes of magnitude (\d+(?:\.\d+)?) or higher worldwide by ([A-Za-z]+)\s+(\d{1,2})\?$/i,
  );
  if (earthquakeAtLeastCountMatch) {
    const [, count, magnitude, monthRaw, dayRaw] = earthquakeAtLeastCountMatch;
    const date = toChineseDate(monthRaw, dayRaw);
    return `${date}\u524d\u5168\u7403\u4f1a\u53d1\u751f${count}\u6b21\u6216\u4ee5\u4e0a${magnitude}\u7ea7\u53ca\u4ee5\u4e0a\u5730\u9707\u5417\uff1f`;
  }

  const globalTempIncreaseMatch = title.match(
    /^Will global temperature increase by more than (-?\d+(?:\.\d+)?)\u00B0?C in ([A-Za-z]+)\s+(\d{4})\?$/i,
  );
  if (globalTempIncreaseMatch) {
    const [, threshold, monthRaw, year] = globalTempIncreaseMatch;
    const month = toChineseMonth(monthRaw);
    return `${year}\u5e74${month}\u5168\u7403\u6c14\u6e29\u6da8\u5e45\u4f1a\u8d85\u8fc7${threshold}\u00B0C\u5417\uff1f`;
  }

  return null;
}

function extractCityFromTitle(title: string): string | null {
  const match = title.match(/in ([A-Za-z\s.'-]+?) be/i);
  if (!match) {
    return null;
  }
  return normalizeCityName(match[1]);
}

function localizeCodeTokensInTitle(title: string): string {
  let localized = title;
  for (const [code, zh] of Object.entries(LOCATION_ZH_BY_CODE)) {
    localized = localized.replace(new RegExp(`\\b${code}\\b`, "g"), zh);
  }
  return localized;
}

export function normalizeMarketLocationToChinese(location: string, marketId?: string, title?: string): string {
  if (marketId) {
    const code = marketId.split("_")[0];
    if (code && LOCATION_ZH_BY_CODE[code]) {
      return LOCATION_ZH_BY_CODE[code];
    }
  }

  if (LOCATION_ZH_BY_NAME[location]) {
    return LOCATION_ZH_BY_NAME[location];
  }

  if (title) {
    const city = extractCityFromTitle(title);
    if (city) {
      return resolveCityChinese(city);
    }
  }

  return location;
}

export function resolveLocalizedMarketDisplay(input: {
  id: string;
  title: string;
  location: string;
}): LocalizedMarketDisplay {
  const localized = MARKET_LOCALIZED_BY_ID[input.id];
  if (localized) {
    return localized;
  }

  const normalizedTitle = normalizeMarketTitleToCelsius(input.title);
  const localizedTitle = localizeQuestionToChinese(normalizedTitle) ?? localizeCodeTokensInTitle(normalizedTitle);

  return {
    title: localizedTitle,
    location: normalizeMarketLocationToChinese(input.location, input.id, normalizedTitle),
  };
}
