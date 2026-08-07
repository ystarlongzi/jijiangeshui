const cityRules = {
  beijing: { name: "北京", label: "北京市", socialMin: 6326, socialMax: 31884, housingMin: 2420, housingMax: 31884, effective: "2026-07-01", socialEmployee: 8, socialEmployer: 16, medicalEmployee: 2, medicalEmployer: 9.5 },
  shanghai: { name: "上海", label: "上海市", socialMin: 7460, socialMax: 37302, housingMin: 2690, housingMax: 37302, effective: "2026-07-01", socialEmployee: 8, socialEmployer: 16, medicalEmployee: 2, medicalEmployer: 9.5 },
  shenzhen: { name: "深圳", label: "深圳市", socialMin: 2520, socialMax: 38853, housingMin: 2360, housingMax: 38853, effective: "2026-07-01", socialEmployee: 8, socialEmployer: 14, medicalEmployee: 2, medicalEmployer: 5.5 },
  guangzhou: { name: "广州", label: "广州市", socialMin: 2300, socialMax: 38082, housingMin: 2300, housingMax: 39528, effective: "2026-07-01", socialEmployee: 8, socialEmployer: 14, medicalEmployee: 2, medicalEmployer: 6 },
  hangzhou: { name: "杭州", label: "杭州市", socialMin: 4986, socialMax: 25299, housingMin: 2490, housingMax: 39000, effective: "2026-01-01", socialEmployee: 8, socialEmployer: 16, medicalEmployee: 2, medicalEmployer: 9.5 }
};

const taxBrackets = [
  { ceiling: 36000, rate: 0.03, quick: 0 },
  { ceiling: 144000, rate: 0.10, quick: 2520 },
  { ceiling: 300000, rate: 0.20, quick: 16920 },
  { ceiling: 420000, rate: 0.25, quick: 31920 },
  { ceiling: 660000, rate: 0.30, quick: 52920 },
  { ceiling: 960000, rate: 0.35, quick: 85920 },
  { ceiling: Infinity, rate: 0.45, quick: 181920 }
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const money = (value, decimals = 2) => `¥${Number(value).toLocaleString("zh-CN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
const wholeMoney = (value) => money(value, 0);

const citySelect = $("#city");
const salaryInput = $("#salary");
const monthSelect = $("#month");
const startMonthSelect = $("#startMonth");
const socialBaseInput = $("#socialBase");
const housingBaseInput = $("#housingBase");
const employeeHousingRate = $("#employeeHousingRate");
const employerHousingRate = $("#employerHousingRate");
const toast = $("#toast");
let baseEditing = false;
let hasRenderedResults = false;

function currentRule() { return cityRules[citySelect.value]; }
function formatRange(min, max) { return `${wholeMoney(min)} - ${wholeMoney(max)}`; }
function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

function setText(selector, value) { const element = $(selector); if (element) element.textContent = value; }

function setFlowSegment(segmentId, value, total) {
  const segment = $(`#${segmentId}`);
  if (!segment) return;
  const percent = Math.max(0, Math.min(100, (value / total) * 100));
  segment.style.width = `${percent}%`;
}

function updateTaxLadder(rate) {
  const levels = [3, 10, 20, 25, 30, 35, 45];
  const index = Math.max(0, levels.indexOf(rate));
  const position = (index / (levels.length - 1)) * 100;
  setText("#taxLadderLabel", `${rate}% 档`);
  const progress = $("#taxLadderProgress");
  const marker = $("#taxLadderMarker");
  if (progress) progress.style.width = `${position}%`;
  if (marker) marker.style.left = `${position}%`;
  $$("[data-tax-level]").forEach((level) => level.classList.toggle("active", Number(level.dataset.taxLevel) === rate));
}

function pulseResultPanel() {
  const panel = $(".result-panel");
  if (!panel) return;
  panel.classList.remove("is-updated");
  void panel.offsetWidth;
  panel.classList.add("is-updated");
  window.clearTimeout(pulseResultPanel.timeout);
  pulseResultPanel.timeout = window.setTimeout(() => panel.classList.remove("is-updated"), 420);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("visible"), 2500);
}

function updateRulePresentation() {
  const rule = currentRule();
  setText("#socialValidation", `${baseEditing ? "手动填写" : "自动按工资估算"} · 允许范围：${formatRange(rule.socialMin, rule.socialMax)}`);
  setText("#housingValidation", `${baseEditing ? "手动填写" : "自动按工资估算"} · 允许范围：${formatRange(rule.housingMin, rule.housingMax)}`);
  const salary = Number(salaryInput.value) || 0;
  const socialBase = clamp(salary, rule.socialMin, rule.socialMax);
  const housingBase = clamp(salary, rule.housingMin, rule.housingMax);
  if (!baseEditing) {
    socialBaseInput.value = Math.round(socialBase);
    housingBaseInput.value = Math.round(housingBase);
  }
}

function getBaseValues() {
  const rule = currentRule();
  const salary = Number(salaryInput.value) || 0;
  return {
    social: Number(socialBaseInput.value) || 0,
    housing: Number(housingBaseInput.value) || 0
  };
}

function getDeductions() {
  return $$('[data-deduction]:checked').reduce((sum, checkbox) => sum + Number(checkbox.dataset.deduction), 0);
}

function getBracket(taxable) {
  return taxBrackets.find((bracket) => taxable <= bracket.ceiling) || taxBrackets[taxBrackets.length - 1];
}

function calcInsurance() {
  const rule = currentRule();
  const { social, housing } = getBaseValues();
  const employeeRate = Number(employeeHousingRate.value) / 100;
  const employerRate = Number(employerHousingRate.value) / 100;
  const items = [
    { name: "养老保险", employee: social * (rule.socialEmployee / 100), employer: social * (rule.socialEmployer / 100), employeeFormula: `${Math.round(social)} × ${rule.socialEmployee}%`, employerFormula: `${Math.round(social)} × ${rule.socialEmployer}%` },
    { name: "医疗保险", employee: social * (rule.medicalEmployee / 100), employer: social * (rule.medicalEmployer / 100), employeeFormula: `${Math.round(social)} × ${rule.medicalEmployee}%`, employerFormula: `${Math.round(social)} × ${rule.medicalEmployer}%` },
    { name: "失业保险", employee: social * 0.005, employer: social * 0.005, employeeFormula: `${Math.round(social)} × 0.5%`, employerFormula: `${Math.round(social)} × 0.5%` },
    { name: "工伤保险", employee: 0, employer: social * 0.002, employeeFormula: "-", employerFormula: `${Math.round(social)} × 0.2%` },
    { name: "生育保险", employee: 0, employer: social * 0.008, employeeFormula: "-", employerFormula: `${Math.round(social)} × 0.8%` },
    { name: "公积金", employee: housing * employeeRate, employer: housing * employerRate, employeeFormula: `${Math.round(housing)} × ${employeeHousingRate.value}%`, employerFormula: `${Math.round(housing)} × ${employerHousingRate.value}%`, housing: true }
  ];
  return items.map((item) => ({ ...item, subtotal: item.employee + item.employer }));
}

function calcMonth(salary, month, startMonth, deduction, insuranceItems) {
  const employeeInsurance = insuranceItems.reduce((sum, item) => sum + item.employee, 0);
  const employerInsurance = insuranceItems.reduce((sum, item) => sum + item.employer, 0);
  const monthsWorked = Math.max(0, month - startMonth + 1);
  const cumulativeSalary = salary * monthsWorked;
  const cumulativeInsurance = employeeInsurance * monthsWorked;
  const cumulativeDeductions = deduction * monthsWorked;
  const taxable = Math.max(0, cumulativeSalary - cumulativeInsurance - cumulativeDeductions - 5000 * monthsWorked);
  const bracket = getBracket(taxable);
  const cumulativeTax = Math.max(0, taxable * bracket.rate - bracket.quick);
  const priorTax = month === startMonth ? 0 : (() => {
    const previous = calcMonth(salary, month - 1, startMonth, deduction, insuranceItems);
    return previous.cumulativeTax;
  })();
  const currentTax = Math.max(0, cumulativeTax - priorTax);
  return { employeeInsurance, employerInsurance, monthsWorked, cumulativeSalary, cumulativeInsurance, taxable, bracket, cumulativeTax, currentTax, takeHome: salary - employeeInsurance - currentTax };
}

function renderInsuranceTable(items) {
  const body = $("#insuranceBody");
  const socialItems = items.filter((item) => !item.housing);
  const housingItems = items.filter((item) => item.housing);
  const subtotal = (collection, key) => collection.reduce((sum, item) => sum + item[key], 0);
  const renderRow = (item) => `
    <tr class="${item.housing ? "housing-row" : ""}">
      <td>${item.name}</td>
      <td>${money(item.employee)}<span class="formula">${item.employeeFormula}</span></td>
      <td>${money(item.employer)}<span class="formula">${item.employerFormula}</span></td>
      <td>${money(item.subtotal)}</td>
    </tr>`;
  const socialRows = socialItems.map(renderRow).join("");
  const housingRows = housingItems.map(renderRow).join("");
  body.innerHTML = `${socialRows}
    <tr class="subtotal social-subtotal"><td>社保合计</td><td>${money(subtotal(socialItems, "employee"))}</td><td>${money(subtotal(socialItems, "employer"))}</td><td>${money(subtotal(socialItems, "subtotal"))}</td></tr>
    ${housingRows}
    <tr class="subtotal total-subtotal"><td>社保、公积金合计</td><td>${money(subtotal(items, "employee"))}</td><td>${money(subtotal(items, "employer"))}</td><td>${money(subtotal(items, "subtotal"))}</td></tr>`;
}

function annualRows(salary, startMonth, deduction, insuranceItems) {
  let rows = "";
  for (let month = 1; month <= 12; month += 1) {
    const result = calcMonth(salary, month, startMonth, deduction, insuranceItems);
    const inactive = month < startMonth;
    const rate = inactive ? "-" : `${Math.round(result.bracket.rate * 100)}%`;
    rows += `<tr class="${month === Number(monthSelect.value) ? "current-month" : ""}">
      <td>${month} 月</td>
      <td><span class="take-home-value">${inactive ? "-" : wholeMoney(result.takeHome)}</span><span class="before-tax-value">${inactive ? "" : `税前 ${wholeMoney(salary)}`}</span></td>
      <td>${inactive ? "-" : wholeMoney(result.employeeInsurance)}</td>
      <td>${inactive ? "-" : wholeMoney(result.taxable)}</td>
      <td>${rate}</td>
      <td>${inactive ? "-" : wholeMoney(result.currentTax)}</td>
    </tr>`;
  }
  return rows;
}

function renderResults() {
  const rule = currentRule();
  const salary = Math.max(0, Number(salaryInput.value) || 0);
  const month = Number(monthSelect.value);
  const startMonth = Number(startMonthSelect.value);
  const deduction = getDeductions();
  const insuranceItems = calcInsurance();
  const result = calcMonth(salary, month, startMonth, deduction, insuranceItems);
  const employeeSocial = insuranceItems.filter((item) => !item.housing).reduce((sum, item) => sum + item.employee, 0);
  const employeeHousing = insuranceItems.filter((item) => item.housing).reduce((sum, item) => sum + item.employee, 0);
  const employeeInsurance = employeeSocial + employeeHousing;
  const fullYear = calcMonth(salary, 12, startMonth, deduction, insuranceItems);
  const rate = Math.round(result.bracket.rate * 100);
  const startText = month === startMonth ? "本月" : `${month} 月`;
  const flowTotal = Math.max(1, salary);
  const takeHomePercent = salary > 0 ? Math.round((result.takeHome / salary) * 100) : 0;

  setText("#resultContext", `${rule.label} · 2026 年 ${month} 月`);
  setText("#detailMonth", `2026 年 ${month} 月`);
  setText("#takeHome", money(result.takeHome));
  setText("#beforeTax", wholeMoney(salary));
  setText("#currentTax", money(result.currentTax));
  setText("#cumulativeTax", money(result.cumulativeTax));
  setText("#employeeInsurance", money(employeeInsurance));
  setText("#taxRate", `${rate}%`);
  setText("#taxableIncome", wholeMoney(result.taxable));
  setText("#resultExplanation", result.taxable <= 0 ? `${startText}累计扣除后应纳税所得额未超过 0，本月暂不需要预扣个税。` : rate > 3 ? `你在 ${month} 月累计应纳税所得额进入 ${rate}% 档位，所以本月个税比上月增加。` : `当前累计应纳税所得额仍在 3% 预扣率档位，个税随累计收入平稳变化。`);
  setText("#wageFlowSummary", `到手 ${takeHomePercent}%`);
  setText("#flowTakeHomeValue", wholeMoney(result.takeHome));
  setText("#flowSocialValue", wholeMoney(employeeSocial));
  setText("#flowHousingValue", wholeMoney(employeeHousing));
  setText("#flowTaxValue", wholeMoney(result.currentTax));
  setFlowSegment("flowTakeHome", result.takeHome, flowTotal);
  setFlowSegment("flowSocial", employeeSocial, flowTotal);
  setFlowSegment("flowHousing", employeeHousing, flowTotal);
  setFlowSegment("flowTax", result.currentTax, flowTotal);
  updateTaxLadder(rate);
  setText("#takeHomeRate", `${takeHomePercent}%`);
  setText("#distributionTakeHome", `${wholeMoney(result.takeHome)} · ${takeHomePercent}%`);
  setText("#distributionInsurance", `${wholeMoney(employeeInsurance)} · ${salary > 0 ? Math.round((employeeInsurance / salary) * 100) : 0}%`);
  setText("#distributionTax", `${wholeMoney(result.currentTax)} · ${salary > 0 ? Math.round((result.currentTax / salary) * 100) : 0}%`);
  $("#annualBody").innerHTML = annualRows(salary, startMonth, deduction, insuranceItems);
  renderInsuranceTable(insuranceItems);
  updateRulePresentation();
  setText("#deductionValue", `本月 ${wholeMoney(deduction)}`);
  setText("#socialValidation", `允许范围：${formatRange(rule.socialMin, rule.socialMax)}`);
  setText("#housingValidation", `允许范围：${formatRange(rule.housingMin, rule.housingMax)}`);
  if (hasRenderedResults) pulseResultPanel();
  hasRenderedResults = true;
}

function resetForm() {
  salaryInput.value = "20000";
  monthSelect.value = "8";
  startMonthSelect.value = "1";
  citySelect.value = "beijing";
  socialBaseInput.value = "20000";
  housingBaseInput.value = "20000";
  employeeHousingRate.value = "12";
  employerHousingRate.value = "12";
  $$('[data-deduction]').forEach((checkbox) => { checkbox.checked = false; });
  $("#deductionToggle").setAttribute("aria-expanded", "false");
  $("#deductionToggle").classList.remove("open");
  $("#deductionContent").classList.add("hidden");
  $("#calculationDetail").classList.add("hidden");
  baseEditing = false;
  socialBaseInput.readOnly = true;
  housingBaseInput.readOnly = true;
  $("#socialEditButton").textContent = "编辑";
  $("#housingEditButton").textContent = "编辑";
  $("#socialEditButton").setAttribute("aria-pressed", "false");
  $("#housingEditButton").setAttribute("aria-pressed", "false");
  updateRulePresentation();
  renderResults();
  showToast("已恢复城市默认设置");
}

$("#taxForm").addEventListener("submit", (event) => { event.preventDefault(); renderResults(); showToast("已更新计算结果"); });
$("#clearButton").addEventListener("click", resetForm);
citySelect.addEventListener("change", () => { updateRulePresentation(); renderResults(); });
salaryInput.addEventListener("input", () => { updateRulePresentation(); renderResults(); });
monthSelect.addEventListener("change", renderResults);
startMonthSelect.addEventListener("change", renderResults);
socialBaseInput.addEventListener("input", renderResults);
housingBaseInput.addEventListener("input", renderResults);
employeeHousingRate.addEventListener("change", renderResults);
employerHousingRate.addEventListener("change", renderResults);
$$('[data-deduction]').forEach((checkbox) => checkbox.addEventListener("change", renderResults));

function toggleBaseEditing() {
  baseEditing = !baseEditing;
  socialBaseInput.readOnly = !baseEditing;
  housingBaseInput.readOnly = !baseEditing;
  $("#socialEditButton").textContent = baseEditing ? "完成" : "编辑";
  $("#housingEditButton").textContent = baseEditing ? "完成" : "编辑";
  $("#socialEditButton").setAttribute("aria-pressed", String(baseEditing));
  $("#housingEditButton").setAttribute("aria-pressed", String(baseEditing));
  updateRulePresentation();
  renderResults();
}

$("#socialEditButton").addEventListener("click", toggleBaseEditing);
$("#housingEditButton").addEventListener("click", toggleBaseEditing);

$("#deductionToggle").addEventListener("click", () => {
  const button = $("#deductionToggle");
  const content = $("#deductionContent");
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  button.classList.toggle("open", !expanded);
  content.classList.toggle("hidden", expanded);
});

$("#calculationButton").addEventListener("click", () => {
  const detail = $("#calculationDetail");
  detail.classList.toggle("hidden");
});

$("#cityRulesButton").addEventListener("click", () => showToast("城市规则详情将在规则页展示：基数范围、比例、生效日期和来源"));
$("#locateButton").addEventListener("click", () => {
  if (!navigator.geolocation) {
    showToast("当前浏览器不支持自动定位，请手动选择城市");
    return;
  }
  showToast("正在获取位置，请允许浏览器访问定位权限");
  navigator.geolocation.getCurrentPosition(
    () => showToast("已获取位置，正式版将匹配对应城市规则"),
    () => showToast("暂时无法获取位置，请手动选择城市")
  );
});
$("#themeToggle").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark";
  document.documentElement.dataset.theme = dark ? "light" : "dark";
  localStorage.setItem("tax-theme", dark ? "light" : "dark");
});

if (localStorage.getItem("tax-theme") === "dark") document.documentElement.dataset.theme = "dark";
updateRulePresentation();
renderResults();
