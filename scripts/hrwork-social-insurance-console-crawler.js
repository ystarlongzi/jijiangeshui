/*
 * Hrwork 社保/公积金规则浏览器控制台采集脚本。
 *
 * 使用方式：
 * 1. 在浏览器打开 https://web.hrwork.com。
 * 2. 打开开发者工具 Console，把本文件完整粘贴进去。
 * 3. 一键采集全部城市：
 *
 *    const result = await crawlAllHrworkSocialInsuranceRules();
 *
 *    或者只采集指定城市：
 *
 *    const result = await crawlHrworkSocialInsuranceRules({ cityFilter: "杭州" });
 *
 * 4. 使用 result 导入后台，或使用脚本自动下载的 JSON 文件。
 */
(function () {
  const API_BASE = "https://gw.hrwork.com/pcommon-service/shebao/open";

  const DEFAULT_OPTIONS = {
    // 限制采集城市数量。null 表示不限制，也就是采集全部城市。
    limit: null,

    // 城市过滤条件。可以传字符串，例如 "杭州"；也可以传函数，例如 area => area.areaName.includes("州")。
    cityFilter: null,

    // 同时并发采集的城市数量。太高可能触发接口限流，建议 3 到 5。
    concurrency: 3,

    // 每个城市请求之间的等待时间，单位毫秒。
    delayMs: 250,

    // 政策年度。目标接口没有明确年度时，默认使用当前年份。
    policyYear: String(new Date().getFullYear()),

    // 政策生效开始日期。undefined 表示自动使用 `${policyYear}-01-01`。
    effectiveFrom: undefined,

    // 是否在采集完成后自动下载 JSON 文件。
    download: true,

    // 触发方式。手动在浏览器控制台执行时默认为 manual。
    triggerType: "manual"
  };

  const ITEM_MAPPINGS = [
    { includes: ["补充工伤"], itemCode: "supplementInjury", systemType: "social" },
    { includes: ["养老"], itemCode: "pension", systemType: "social" },
    { includes: ["大病", "大额"], itemCode: "majorMedical", systemType: "social" },
    { includes: ["医疗"], itemCode: "medical", systemType: "social" },
    { includes: ["失业"], itemCode: "unemployment", systemType: "social" },
    { includes: ["工伤"], itemCode: "injury", systemType: "social" },
    { includes: ["生育"], itemCode: "maternity", systemType: "social" },
    { includes: ["公积金"], itemCode: "housingFund", systemType: "housingFund" },
    { includes: ["残疾人", "残保金", "保障金"], itemCode: "disabledEmploymentSecurityFund", systemType: "employerCost" }
  ];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function durationMs(startTime) {
    return Math.round(performance.now() - startTime);
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function toStringOrNull(value) {
    return value === null || value === undefined || value === "" ? null : String(value);
  }

  function unwrapData(response) {
    return response && typeof response === "object" && response.data !== undefined ? response.data : response;
  }

  function compactObject(value) {
    const output = {};
    Object.entries(value).forEach(([key, item]) => {
      if (item !== undefined) output[key] = item;
    });
    return output;
  }

  function createErrorResponse(status, message, responseBody) {
    return compactObject({
      status: String(status ?? "error"),
      message: message || "请求失败",
      responseBody
    });
  }

  function createCrawlJob(endpoint, startedAt, startTime, status, triggerType, errorResponse) {
    return compactObject({
      endpoint,
      startedAt,
      finishedAt: nowIso(),
      status,
      triggerType,
      durationMs: durationMs(startTime),
      errorMessage: errorResponse ? errorResponse.message : undefined,
      errorResponse: endpoint === "getInsOrg" || endpoint === "calculator" ? errorResponse : undefined
    });
  }

  function walk(value, visitor) {
    if (value === null || value === undefined) return;
    visitor(value);
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, visitor));
      return;
    }
    if (typeof value === "object") {
      Object.values(value).forEach((item) => walk(item, visitor));
    }
  }

  function findObjects(value, predicate) {
    const list = [];
    walk(value, (node) => {
      if (node && typeof node === "object" && !Array.isArray(node) && predicate(node)) list.push(node);
    });
    return list;
  }

  function extractNumbers(value) {
    const numbers = [];
    walk(value, (node) => {
      if (typeof node === "number" && Number.isFinite(node)) numbers.push(node);
      if (typeof node === "string") {
        (node.match(/-?\d+(?:\.\d+)?/g) || []).forEach((item) => {
          const parsed = Number(item);
          if (Number.isFinite(parsed)) numbers.push(parsed);
        });
      }
    });
    return numbers.filter((item) => item > 0);
  }

  function getLastArrayItem(value) {
    return Array.isArray(value) && value.length ? value[value.length - 1] : null;
  }

  function extractBaseRange(lastItem) {
    if (!lastItem) return { baseMin: null, baseMax: null, rawData: null };
    const min = toNumber(lastItem.minBase ?? lastItem.baseMin ?? lastItem.min ?? lastItem.lowerLimit);
    const max = toNumber(lastItem.maxBase ?? lastItem.baseMax ?? lastItem.max ?? lastItem.upperLimit);
    if (min !== null && max !== null) return { baseMin: min, baseMax: max, rawData: lastItem };
    const numbers = extractNumbers(lastItem);
    return {
      baseMin: numbers.length >= 2 ? Math.min(...numbers) : null,
      baseMax: numbers.length >= 2 ? Math.max(...numbers) : null,
      rawData: lastItem
    };
  }

  function normalizeArea(area) {
    const areaId = area.areaId ?? area.id ?? area.value;
    const areaCode = area.areaCode ?? area.code ?? area.pinyin ?? area.key;
    const name = area.areaName ?? area.name ?? area.label ?? area.text;
    if (areaId === undefined || !name) return null;

    return {
      areaId: String(areaId),
      areaName: String(name),
      parentAreaId: toStringOrNull(area.parentAreaId ?? area.parentId ?? area.pid),
      parentAreaName: toStringOrNull(area.parentAreaName ?? area.parentName),
      areaCode: toStringOrNull(areaCode),
      shortName: toStringOrNull(area.shortName ?? area.short_name ?? area.abbr),
      rawData: area
    };
  }

  function extractAreas(areaResponse) {
    const data = unwrapData(areaResponse);
    const candidates = findObjects(data, (node) => {
      const hasId = node.areaId !== undefined || node.id !== undefined || node.value !== undefined;
      const hasName = node.areaName !== undefined || node.name !== undefined || node.label !== undefined;
      return hasId && hasName;
    });
    const seen = new Set();
    return candidates.map(normalizeArea).filter(Boolean).filter((area) => {
      if (seen.has(area.areaId)) return false;
      seen.add(area.areaId);
      return true;
    });
  }

  function extractPlans(insOrgResponse) {
    const data = unwrapData(insOrgResponse);
    const shebaoLast = getLastArrayItem(data && data.shebao);
    const gjjLast = getLastArrayItem(data && data.gjj);
    const socialBaseRange = extractBaseRange(shebaoLast);
    const housingBaseRange = extractBaseRange(gjjLast);

    const socialPlan = shebaoLast ? {
      planType: "social",
      externalPlanCode: toStringOrNull(shebaoLast.code ?? shebaoLast.sbCode),
      externalPlanName: toStringOrNull(shebaoLast.name ?? shebaoLast.sbTypeText),
      baseMin: socialBaseRange.baseMin,
      baseMax: socialBaseRange.baseMax,
      calculatorCode: toStringOrNull(shebaoLast.code ?? shebaoLast.sbCode),
      calculatorBase: toNumber(shebaoLast.base ?? shebaoLast.sbBase ?? shebaoLast.minBase ?? shebaoLast.baseMin ?? shebaoLast.min),
      rawData: shebaoLast
    } : null;

    const housingPlan = gjjLast ? {
      planType: "housingFund",
      externalPlanCode: toStringOrNull(gjjLast.code ?? gjjLast.gjjCode),
      externalPlanName: toStringOrNull(gjjLast.name ?? gjjLast.gjjTypeText),
      baseMin: housingBaseRange.baseMin,
      baseMax: housingBaseRange.baseMax,
      calculatorCode: toStringOrNull(gjjLast.code ?? gjjLast.gjjCode),
      calculatorBase: toNumber(gjjLast.base ?? gjjLast.gjjBase ?? gjjLast.minBase ?? gjjLast.baseMin ?? gjjLast.min),
      rawData: gjjLast
    } : null;

    return {
      socialPlan,
      housingPlan,
      rawData: data
    };
  }

  function mapItemName(itemName) {
    const text = String(itemName || "");
    return ITEM_MAPPINGS.find((item) => item.includes.some((keyword) => text.includes(keyword))) || {
      itemCode: `unknown_${text || "item"}`,
      systemType: "social"
    };
  }

  function parseCalcProp(propText, fee) {
    const text = String(propText ?? "").trim();
    const numericFee = toNumber(fee);
    if (!text || text === "-") return { calcMethod: "none", rate: null, fixedAmount: null, warning: null };
    if (text.includes("固定")) return { calcMethod: "fixed", rate: null, fixedAmount: numericFee, warning: numericFee === null ? `无法从 ${text} 推断固定金额` : null };
    const rateMatch = text.match(/x\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
    const plusMatch = text.match(/\+\s*([0-9]+(?:\.[0-9]+)?)/);
    if (rateMatch && plusMatch) return { calcMethod: "ratePlusFixed", rate: Number(rateMatch[1]) / 100, fixedAmount: Number(plusMatch[1]), warning: null };
    if (rateMatch) return { calcMethod: "rate", rate: Number(rateMatch[1]) / 100, fixedAmount: null, warning: null };
    return { calcMethod: "none", rate: null, fixedAmount: null, warning: `无法识别表达式：${text}` };
  }

  function extractCalcDetails(calculatorResponse) {
    const data = unwrapData(calculatorResponse);
    const socialDetails = data && data.shebao && Array.isArray(data.shebao.calcDetails) ? data.shebao.calcDetails : [];
    const housingDetails = data && data.gjj && Array.isArray(data.gjj.calcDetails) ? data.gjj.calcDetails : [];
    return [
      ...socialDetails.map((detail) => ({ detail, fallbackSystemType: "social" })),
      ...housingDetails.map((detail) => ({ detail, fallbackSystemType: "housingFund" }))
    ];
  }

  function convertDetailToItemRule(detail, fallbackSystemType) {
    const itemName = String(detail.itemName || "");
    const mapped = mapItemName(itemName);
    const employee = parseCalcProp(detail.empProp, detail.empFee);
    const employer = parseCalcProp(detail.orgProp, detail.orgFee);
    const systemType = fallbackSystemType || mapped.systemType;

    return compactObject({
      systemType,
      itemCode: mapped.itemCode,
      itemName,
      employeeCalcMethod: employee.calcMethod,
      employeeRate: employee.rate,
      employeeFixedAmount: employee.fixedAmount,
      employerCalcMethod: employer.calcMethod,
      employerRate: employer.rate,
      employerFixedAmount: employer.fixedAmount,
      rawData: detail
    });
  }

  function buildCalculatorPayload(area, socialPlan, housingPlan) {
    return compactObject({
      areaName: area.areaName,
      areaCode: area.areaCode,
      areaId: toNumber(area.areaId) ?? area.areaId,
      sbFlag: 1,
      sbCode: socialPlan && socialPlan.calculatorCode,
      sbBase: socialPlan && socialPlan.calculatorBase,
      gjjFlag: 1,
      gjjCode: housingPlan && housingPlan.calculatorCode,
      gjjBase: housingPlan && housingPlan.calculatorBase,
      loginFlag: 0
    });
  }

  function buildBaseRules(plans) {
    return [
      plans.socialPlan ? {
        baseType: "social",
        baseMin: plans.socialPlan.baseMin,
        baseMax: plans.socialPlan.baseMax,
        rawData: plans.socialPlan.rawData
      } : null,
      plans.housingPlan ? {
        baseType: "housingFund",
        baseMin: plans.housingPlan.baseMin,
        baseMax: plans.housingPlan.baseMax,
        rawData: plans.housingPlan.rawData
      } : null
    ].filter(Boolean);
  }

  function buildPolicyResult(area, calculatorResponse, options, baseRulesInfo, itemRulesCrawlJob) {
    const details = extractCalcDetails(calculatorResponse);
    const itemRules = details.map(({ detail, fallbackSystemType }) => convertDetailToItemRule(detail, fallbackSystemType));
    const baseRules = baseRulesInfo.list;
    const baseWarnings = [];
    const itemWarnings = [];
    if (!itemRules.length) itemWarnings.push("calculator 未返回 calcDetails。");
    baseRules.forEach((rule) => {
      if (rule.baseMin === null || rule.baseMax === null) baseWarnings.push(`${rule.baseType} 基数上下限需要人工确认。`);
    });
    const effectiveFrom = options.effectiveFrom === undefined ? `${options.policyYear}-01-01` : options.effectiveFrom;
    const nextBaseRulesInfo = {
      list: baseRulesInfo.list,
      crawlJob: baseWarnings.length && baseRulesInfo.crawlJob.status === "success" ? {
        ...baseRulesInfo.crawlJob,
        status: "parseFailed",
        errorMessage: baseWarnings.join("; ")
      } : baseRulesInfo.crawlJob
    };
    const itemRulesInfo = {
      list: itemRules,
      crawlJob: itemWarnings.length && itemRulesCrawlJob.status === "success" ? {
        ...itemRulesCrawlJob,
        status: "parseFailed",
        errorMessage: itemWarnings.join("; ")
      } : itemRulesCrawlJob
    };

    return {
      areaId: area.areaId,
      areaName: area.areaName,
      policyYear: String(options.policyYear),
      effectiveFrom,
      baseRulesInfo: nextBaseRulesInfo,
      itemRulesInfo
    };
  }

  async function postJson(endpoint, payload, requestLogs, triggerType) {
    const startedAt = nowIso();
    const startTime = performance.now();
    let response;
    let responseBody = null;
    try {
      response = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json"
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        credentials: "include",
        mode: "cors"
      });
      const text = await response.text();
      responseBody = text ? JSON.parse(text) : null;
      const failedByHttp = !response.ok;
      const failedByBody = responseBody && responseBody.status === false;
      if (failedByHttp || failedByBody) {
        const message = responseBody && responseBody.message ? responseBody.message : `${endpoint} 请求失败：HTTP ${response.status}`;
        const errorResponse = createErrorResponse(response.status, message, responseBody);
        const crawlJob = createCrawlJob(endpoint, startedAt, startTime, "failed", triggerType, errorResponse);
        requestLogs.push(compactObject({
          endpoint,
          startedAt: crawlJob.startedAt,
          finishedAt: crawlJob.finishedAt,
          status: crawlJob.status,
          durationMs: crawlJob.durationMs,
          requestPayload: payload ?? null,
          errorResponse
        }));
        const error = new Error(message);
        error.crawlJob = crawlJob;
        error.responseBody = responseBody;
        throw error;
      }

      const crawlJob = createCrawlJob(endpoint, startedAt, startTime, "success", triggerType);
      requestLogs.push(compactObject({
        endpoint,
        startedAt: crawlJob.startedAt,
        finishedAt: crawlJob.finishedAt,
        status: crawlJob.status,
        durationMs: crawlJob.durationMs,
        requestPayload: payload ?? null
      }));
      return { responseBody, crawlJob };
    } catch (error) {
      if (error && error.crawlJob) throw error;
      const errorResponse = createErrorResponse(response ? response.status : "network", error && error.message ? error.message : String(error));
      const crawlJob = createCrawlJob(endpoint, startedAt, startTime, "failed", triggerType, errorResponse);
      requestLogs.push(compactObject({
        endpoint,
        startedAt: crawlJob.startedAt,
        finishedAt: crawlJob.finishedAt,
        status: crawlJob.status,
        durationMs: crawlJob.durationMs,
        requestPayload: payload ?? null,
        errorResponse
      }));
      error.crawlJob = crawlJob;
      throw error;
    }
  }

  async function mapLimit(items, concurrency, mapper) {
    const results = new Array(items.length);
    let index = 0;
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (index < items.length) {
        const current = index++;
        results[current] = await mapper(items[current], current);
      }
    });
    await Promise.all(workers);
    return results;
  }

  async function crawlCity(area, options, requestLogs) {
    const makeSkippedJob = (endpoint, message) => {
      const job = createCrawlJob(endpoint, nowIso(), performance.now(), "skipped", options.triggerType);
      job.errorMessage = message;
      return job;
    };
    const makeFailedJob = (endpoint, error) => error && error.crawlJob ? error.crawlJob : createCrawlJob(endpoint, nowIso(), performance.now(), "failed", options.triggerType, createErrorResponse("error", error && error.message ? error.message : String(error)));
    let baseRulesInfo = null;
    let plans = null;

    try {
      const insOrgResult = await postJson("getInsOrg", { areaId: toNumber(area.areaId) ?? area.areaId, loginFlag: 0 }, requestLogs, options.triggerType);
      plans = extractPlans(insOrgResult.responseBody);
      baseRulesInfo = {
        list: buildBaseRules(plans),
        crawlJob: insOrgResult.crawlJob
      };
    } catch (error) {
      const policy = {
        areaId: area.areaId,
        areaName: area.areaName,
        policyYear: String(options.policyYear),
        effectiveFrom: options.effectiveFrom === undefined ? `${options.policyYear}-01-01` : options.effectiveFrom,
        baseRulesInfo: {
          list: [],
          crawlJob: makeFailedJob("getInsOrg", error)
        },
        itemRulesInfo: {
          list: [],
          crawlJob: makeSkippedJob("calculator", "getInsOrg 失败，未调用 calculator")
        }
      };
      return {
        areaId: area.areaId,
        areaCode: area.areaCode,
        areaName: area.areaName,
        status: "requestFailed",
        errorMessage: error && error.message ? error.message : String(error),
        policy
      };
    }

    try {
      const payload = buildCalculatorPayload(area, plans.socialPlan, plans.housingPlan);
      const calculatorResult = await postJson("calculator", payload, requestLogs, options.triggerType);
      const policy = buildPolicyResult(area, calculatorResult.responseBody, options, baseRulesInfo, calculatorResult.crawlJob);
      const status = policy.itemRulesInfo.crawlJob.status === "success" && policy.baseRulesInfo.crawlJob.status === "success" ? "success" : "parseFailed";
      return {
        areaId: area.areaId,
        areaCode: area.areaCode,
        areaName: area.areaName,
        status,
        errorMessage: status === "success" ? null : policy.itemRulesInfo.crawlJob.errorMessage,
        policy
      };
    } catch (error) {
      const policy = {
        areaId: area.areaId,
        areaName: area.areaName,
        policyYear: String(options.policyYear),
        effectiveFrom: options.effectiveFrom === undefined ? `${options.policyYear}-01-01` : options.effectiveFrom,
        baseRulesInfo,
        itemRulesInfo: {
          list: [],
          crawlJob: makeFailedJob("calculator", error)
        }
      };
      return {
        areaId: area.areaId,
        areaCode: area.areaCode,
        areaName: area.areaName,
        status: "requestFailed",
        errorMessage: error && error.message ? error.message : String(error),
        policy
      };
    }
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function runHrworkSocialInsuranceCrawler(userOptions = {}) {
    const options = { ...DEFAULT_OPTIONS, ...userOptions };
    const requestLogs = [];
    const warnings = [];
    const startedAt = nowIso();
    const startTime = performance.now();

    if (!location.hostname.endsWith("hrwork.com")) {
      warnings.push("建议在 https://web.hrwork.com 页面运行，避免浏览器跨域限制。");
      console.warn(warnings[warnings.length - 1]);
    }

    let getAreaResult;
    try {
      getAreaResult = await postJson("getArea", undefined, requestLogs, options.triggerType);
    } catch (error) {
      const finishedAt = nowIso();
      const crawlJob = {
        endpoint: "all",
        startedAt,
        finishedAt,
        status: "failed",
        triggerType: options.triggerType,
        durationMs: durationMs(startTime),
        errorMessage: error && error.message ? error.message : String(error)
      };
      const result = {
        options,
        cityInfo: {
          list: [],
          crawlJob: error && error.crawlJob ? error.crawlJob : createCrawlJob("getArea", startedAt, startTime, "failed", options.triggerType, createErrorResponse("error", crawlJob.errorMessage))
        },
        socialInsurancePolicy: {
          list: []
        },
        crawlJob,
        requestLogs
      };
      console.log("Hrwork 社保/公积金采集失败：", crawlJob);
      if (options.download) downloadJson(`hrwork-social-insurance-${new Date().toISOString().slice(0, 10)}.json`, result);
      return result;
    }

    let areas = extractAreas(getAreaResult.responseBody);
    if (typeof options.cityFilter === "function") {
      areas = areas.filter(options.cityFilter);
    } else if (options.cityFilter) {
      const keyword = String(options.cityFilter);
      areas = areas.filter((area) => area.areaName.includes(keyword) || String(area.areaCode || "").includes(keyword) || String(area.areaId).includes(keyword));
    }
    if (options.limit) areas = areas.slice(0, options.limit);

    const cityResults = await mapLimit(areas, options.concurrency, async (area, index) => {
      console.log(`[${index + 1}/${areas.length}] 采集 ${area.areaName}`);
      const result = await crawlCity(area, options, requestLogs);
      await sleep(options.delayMs);
      return result;
    });

    const successCities = cityResults.filter((item) => item.status === "success").length;
    const failedCities = cityResults.filter((item) => item.status === "requestFailed" || item.status === "parseFailed").length;
    const status = failedCities === 0 ? "success" : successCities > 0 ? "partialSuccess" : "failed";
    const finishedAt = nowIso();
    const crawlJob = {
      endpoint: "all",
      startedAt,
      finishedAt,
      status,
      triggerType: options.triggerType,
      durationMs: durationMs(startTime),
      errorMessage: status === "success" ? null : `${failedCities} 个城市采集失败或需要人工确认。`
    };

    const result = {
      options,
      cityInfo: {
        list: areas.map((area) => ({
          areaId: area.areaId,
          areaName: area.areaName,
          shortName: area.shortName,
          areaCode: area.areaCode,
          parentAreaId: area.parentAreaId,
          parentAreaName: area.parentAreaName
        })),
        crawlJob: getAreaResult.crawlJob
      },
      socialInsurancePolicy: {
        list: cityResults.map((item) => item.policy)
      },
      crawlJob,
      requestLogs
    };

    console.log("Hrwork 社保/公积金采集完成：", crawlJob);
    if (options.download) downloadJson(`hrwork-social-insurance-${new Date().toISOString().slice(0, 10)}.json`, result);
    return result;
  }

  async function crawlAllHrworkSocialInsuranceRules(userOptions = {}) {
    return runHrworkSocialInsuranceCrawler({ ...userOptions, cityFilter: null, limit: userOptions.limit ?? null });
  }

  async function crawlHrworkSocialInsuranceRules(userOptions = {}) {
    return runHrworkSocialInsuranceCrawler(userOptions);
  }

  window.runHrworkSocialInsuranceCrawler = runHrworkSocialInsuranceCrawler;
  window.crawlAllHrworkSocialInsuranceRules = crawlAllHrworkSocialInsuranceRules;
  window.crawlHrworkSocialInsuranceRules = crawlHrworkSocialInsuranceRules;
  console.log("已加载：await crawlAllHrworkSocialInsuranceRules() 或 await crawlHrworkSocialInsuranceRules({ cityFilter: '杭州' })");
})();
