// ============ НАСТРОЙКИ: впишите свои значения ============
const CONFIG = {
  // Адрес отправки ответов: замените FORM_ID на идентификатор вашей Google Form
  FORM_URL: "https://docs.google.com/forms/d/e/FORM_ID/formResponse",

  // Идентификаторы полей (entry.XXXX) из ссылки для предзаполнения.
  // В Google Form все эти вопросы должны быть типа «Текст (строка)» или «Текст (абзац)».
  ENTRY: {
    token:       "entry.0000000001",
    name:        "entry.0000000002",
    email:       "entry.0000000003",
    birth_date:  "entry.0000000004", // формат ГГГГ-ММ-ДД
    gender:      "entry.0000000005",
    looking_for: "entry.0000000006", // значения через запятую
    city:        "entry.0000000007",
    interests:   "entry.0000000008", // значения через запятую
    bio:         "entry.0000000009",
  },
  MIN_AGE: 18,
};
// ==========================================================

const form = document.getElementById("profile-form");
const errorBox = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");
const successBox = document.getElementById("success");
const bio = document.getElementById("bio");

// Максимальная дата рождения: сегодня минус MIN_AGE лет
(function limitBirthDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - CONFIG.MIN_AGE);
  document.getElementById("birth_date").max = d.toISOString().slice(0, 10);
})();

// Счётчик символов в «О себе»
bio.addEventListener("input", () => {
  document.getElementById("bio-count").textContent = bio.value.length;
});

// Если страницу открыли по личной ссылке (?u=...), показываем код
(function showRef() {
  const ref = new URLSearchParams(location.search).get("u");
  if (!ref) return;
  const banner = document.getElementById("ref-banner");
  banner.textContent = "Личный код анкеты: " + ref;
  banner.hidden = false;
})();

// «Другое»: показываем поле для своих интересов
const otherToggle = document.getElementById("other-toggle");
const otherWrap = document.getElementById("other-wrap");
const otherInput = document.getElementById("interests_other");

otherToggle.addEventListener("change", () => {
  otherWrap.hidden = !otherToggle.checked;
  if (otherToggle.checked) otherInput.focus();
  else otherInput.value = "";
});

// Свои интересы: делим по запятой, чистим, берём не больше пяти
function customInterests() {
  if (!otherToggle.checked) return [];
  const seen = new Set();
  return otherInput.value
    .split(/[,;]+/)
    .map((s) => s.trim().replace(/\s+/g, " ").slice(0, 40))
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .slice(0, 5);
}

// Все интересы: отмеченные + свои
function allInterests() {
  const base = checkedValues("interests");
  const lower = new Set(base.map((s) => s.toLowerCase()));
  return base.concat(customInterests().filter((s) => !lower.has(s.toLowerCase())));
}

function checkedValues(name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
}

function showError(message, field) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  if (field) { field.classList.add("invalid"); field.focus(); }
}

function age(isoDate) {
  const b = new Date(isoDate), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

function validate() {
  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
  errorBox.hidden = true;

  const f = form.elements;
  if (!f.name.value.trim()) return showError("Укажите имя.", f.name), false;
  if (!f.email.validity.valid || !f.email.value.trim()) return showError("Проверьте адрес почты.", f.email), false;
  if (!f.birth_date.value) return showError("Укажите дату рождения.", f.birth_date), false;
  if (age(f.birth_date.value) < CONFIG.MIN_AGE) return showError("Участвовать можно с 18 лет.", f.birth_date), false;
  if (!f.gender.value) return showError("Выберите, кто вы.", f.gender), false;
  if (checkedValues("looking_for").length === 0) return showError("Выберите, с кем хотите познакомиться."), false;
  if (!f.city.value.trim()) return showError("Укажите город.", f.city), false;
  if (otherToggle.checked && customInterests().length === 0) {
    return showError("Впишите свои интересы или снимите отметку «Другое».", otherInput), false;
  }
  if (!f.consent.checked) return showError("Нужно ваше согласие на обработку данных."), false;
  return true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) return;

  // Если поле-ловушка заполнено, это бот: делаем вид, что всё прошло
  if (form.elements.website.value) { form.hidden = true; successBox.hidden = false; return; }

  if (CONFIG.FORM_URL.includes("FORM_ID")) {
    return showError("Сайт ещё не подключён к Google Form: впишите FORM_URL и номера полей в script.js.");
  }

  const f = form.elements;
  const token = crypto.randomUUID();
  const body = new URLSearchParams();
  body.append(CONFIG.ENTRY.token, token);
  body.append(CONFIG.ENTRY.name, f.name.value.trim());
  body.append(CONFIG.ENTRY.email, f.email.value.trim().toLowerCase());
  body.append(CONFIG.ENTRY.birth_date, f.birth_date.value);
  body.append(CONFIG.ENTRY.gender, f.gender.value);
  body.append(CONFIG.ENTRY.looking_for, checkedValues("looking_for").join(", "));
  body.append(CONFIG.ENTRY.city, f.city.value.trim());
  body.append(CONFIG.ENTRY.interests, allInterests().join(", "));
  body.append(CONFIG.ENTRY.bio, f.bio.value.trim());

  submitBtn.disabled = true;
  submitBtn.textContent = "Отправляем…";

  try {
    // no-cors: Google не отдаёт CORS-заголовки, поэтому ответ прочитать нельзя
    await fetch(CONFIG.FORM_URL, { method: "POST", mode: "no-cors", body });
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Отправить анкету";
    return showError("Не удалось отправить анкету. Проверьте интернет и попробуйте ещё раз.");
  }

  const myLink = location.origin + location.pathname + "?u=" + token;
  document.getElementById("my-link").value = myLink;
  try { localStorage.setItem("poznakomimsya_link", myLink); } catch (err) { /* хранилище недоступно */ }
  form.hidden = true;
  successBox.hidden = false;
  successBox.focus();
});

document.getElementById("copy-btn").addEventListener("click", async (e) => {
  const input = document.getElementById("my-link");
  try { await navigator.clipboard.writeText(input.value); }
  catch { input.select(); document.execCommand("copy"); }
  e.target.textContent = "Скопировано";
});
