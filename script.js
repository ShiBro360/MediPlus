// ==============================
// Initial data
// ==============================
const dayNames = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const MEDIPLUS_FRONTEND_VERSION = "debug-appointment-flow-2026-06-21-04";
console.info("[MediPlus] script loaded", MEDIPLUS_FRONTEND_VERSION, new Date().toISOString());

const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

const storageKeys = {
  patients: "mediplusPatients",
  appointments: "mediplusAppointments",
  doctors: "mediplusDoctors",
  services: "mediplusServices",
  cabinets: "mediplusCabinets",
  users: "mediplusUsers",
  settings: "mediplusSettings",
  doctorAbsences: "mediplusDoctorAbsences",
};
const SIDEBAR_COLLAPSED_KEY = "mediPlusSidebarCollapsed";
const doctorAbsenceTypes = ["Urlop", "Chorobowe", "Dzień wolny", "Inne"];
const cabinetTypes = [
  "Administracyjny",
  "Uniwersalny",
  "Ginekologiczny",
  "Psychologiczny",
  "Fizjoterapia",
  "Zabiegowy",
  "Punkt Pobrań",
];
const doctorSpecializations = [
  "Internista",
  "Kardiolog",
  "Dermatolog",
  "Ginekolog",
  "Psycholog",
  "Fizjoterapeuta",
  "Ortopeda",
  "Pediatra",
  "Neurolog",
  "Endokrynolog",
  "Gastroenterolog",
  "Diabetolog",
  "Pulmonolog",
  "Laryngolog",
];
const specializationCabinetTypeMap = {
  internista: ["Uniwersalny", "Zabiegowy"],
  kardiolog: ["Uniwersalny", "Zabiegowy"],
  dermatolog: ["Uniwersalny", "Zabiegowy"],
  ogólna: ["Uniwersalny"],
  ogolna: ["Uniwersalny"],
  ginekolog: ["Ginekologiczny", "Zabiegowy"],
  psycholog: ["Psychologiczny"],
  fizjoterapeuta: ["Fizjoterapia"],
  ortopeda: ["Uniwersalny", "Zabiegowy"],
  pediatra: ["Uniwersalny"],
  neurolog: ["Uniwersalny"],
  endokrynolog: ["Uniwersalny"],
  gastroenterolog: ["Uniwersalny"],
  diabetolog: ["Uniwersalny"],
  pulmonolog: ["Uniwersalny"],
  laryngolog: ["Uniwersalny"],
};

function normalizeCabinetType(value) {
  const raw = String(value || "").trim();
  if (cabinetTypes.includes(raw)) return raw;
  const lower = raw.toLowerCase();
  const specializationMap = {
    internista: "Uniwersalny",
    pediatra: "Uniwersalny",
    dermatolog: "Uniwersalny",
    kardiolog: "Uniwersalny",
    neurolog: "Uniwersalny",
    endokrynolog: "Uniwersalny",
    gastroenterolog: "Uniwersalny",
    diabetolog: "Uniwersalny",
    pulmonolog: "Uniwersalny",
    laryngolog: "Uniwersalny",
    ginekolog: "Ginekologiczny",
    psycholog: "Psychologiczny",
    fizjoterapeuta: "Fizjoterapia",
  };
  if (specializationMap[lower]) return specializationMap[lower];
  if (lower.includes("fizjo")) return "Fizjoterapia";
  if (lower.includes("ginek")) return "Ginekologiczny";
  if (lower.includes("psycholog")) return "Psychologiczny";
  if (lower.includes("zabieg")) return "Zabiegowy";
  if (lower.includes("pobra")) return "Punkt Pobrań";
  if (lower.includes("admin")) return "Administracyjny";
  const mappedPart = raw.split(",").map((part) => specializationMap[part.trim().toLowerCase()]).find(Boolean);
  if (mappedPart) return mappedPart;
  return "Uniwersalny";
}

function normalizeSpecialization(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  if (!normalized) return "";
  if (normalized.includes("fizjo")) return "fizjoterapeuta";
  if (normalized.includes("ortop")) return "ortopeda";
  if (normalized.includes("kardio")) return "kardiolog";
  if (normalized.includes("dermat")) return "dermatolog";
  if (normalized.includes("ginek")) return "ginekolog";
  if (normalized.includes("psycholog")) return "psycholog";
  if (normalized.includes("pediatr")) return "pediatra";
  if (normalized.includes("neurolog")) return "neurolog";
  if (normalized.includes("endokryn")) return "endokrynolog";
  if (normalized.includes("gastro")) return "gastroenterolog";
  if (normalized.includes("diabet")) return "diabetolog";
  if (normalized.includes("pulmon")) return "pulmonolog";
  if (normalized.includes("laryng")) return "laryngolog";
  if (normalized === "ogolna" || normalized === "ogolny") return "ogolna";
  return normalized;
}

function inferServiceSpecialization(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  if (!normalized) return "";
  if (normalized.includes("fizjo") || normalized.includes("rehabilit") || normalized.includes("manualn")) return "Fizjoterapeuta";
  if (normalized.includes("ortop")) return "Ortopeda";
  if (normalized.includes("kardio")) return "Kardiolog";
  if (normalized.includes("dermat") || normalized.includes("skorn")) return "Dermatolog";
  if (normalized.includes("ginek") || normalized.includes("cytolog")) return "Ginekolog";
  if (normalized.includes("psycholog")) return "Psycholog";
  if (normalized.includes("pediatr")) return "Pediatra";
  if (normalized.includes("neurolog")) return "Neurolog";
  if (normalized.includes("endokryn") || normalized.includes("hormon")) return "Endokrynolog";
  if (normalized.includes("gastro")) return "Gastroenterolog";
  if (normalized.includes("diabet") || normalized.includes("cukrzyc")) return "Diabetolog";
  if (normalized.includes("pulmon")) return "Pulmonolog";
  if (normalized.includes("laryng")) return "Laryngolog";
  return "";
}

function getServiceSpecializationValue(service) {
  if (!service || typeof service !== "object") return "";
  const explicit = String(service.specialization || service.specialization_name || service.category || "").trim();
  const explicitKey = normalizeSpecialization(explicit);
  const inferred = inferServiceSpecialization([
    service.name,
    service.service_name,
    service.description,
  ].filter(Boolean).join(" "));
  const inferredKey = normalizeSpecialization(inferred);

  if (inferred && (!explicitKey || explicitKey === "ogolna" || explicitKey !== inferredKey)) {
    return inferred;
  }

  return explicit || inferred || "";
}

function getAppointmentServiceSpecialization(service, doctor = null) {
  const inferred = inferServiceSpecialization([
    service?.name,
    service?.service_name,
    service?.description,
  ].filter(Boolean).join(" "));
  const value = inferred || getServiceSpecializationValue(service) || doctor?.specialization || "";
  return value;
}

function getAllowedCabinetTypesForSpecialization(specialization) {
  const normalized = normalizeSpecialization(specialization);
  if (normalized === "fizjoterapeuta") return ["Fizjoterapia"];
  if (normalized === "ortopeda") return ["Uniwersalny", "Zabiegowy"];
  return specializationCabinetTypeMap[normalized] || ["Uniwersalny"];
}

function getCabinetTypeSource(cabinet) {
  if (!cabinet || typeof cabinet !== "object") return "";
  const explicit = [
    cabinet.cabinet_type,
    cabinet.type,
    cabinet.specialization,
  ].map((value) => String(value || "").trim()).find(Boolean) || "";
  if (explicit) return explicit;
  return [
    cabinet.name,
    cabinet.cabinet_name,
  ].map((value) => String(value || "").trim()).find(Boolean) || "";
}

function isCabinetCompatibleWithSpecialization(cabinet, specialization) {
  if (!cabinet) return false;
  const normalizedSpecialization = normalizeSpecialization(specialization);
  const source = getCabinetTypeSource(cabinet);
  const allowedTypes = getAllowedCabinetTypesForSpecialization(specialization).map(normalizeCabinetType);
  const cabinetType = normalizeCabinetType(source);
  const searchableCabinetText = [
    source,
    cabinet.name,
    cabinet.cabinet_name,
    cabinet.type,
    cabinet.cabinet_type,
  ].map((value) => String(value || "").toLowerCase()).join(" ");
  if (normalizedSpecialization.includes("fizjo") && searchableCabinetText.includes("fizjo")) {
    return true;
  }
  return allowedTypes.includes(cabinetType);
}

function getSpecializationColor(specialization) {
  const normalized = normalizeSpecialization(specialization);
  const known = {
    ogolna: "general",
    internista: "internal",
    interna: "internal",
    kardiolog: "cardiology",
    kardiologia: "cardiology",
    dermatolog: "dermatology",
    dermatologia: "dermatology",
    pediatra: "pediatrics",
    pediatria: "pediatrics",
    neurolog: "neurology",
    neurologia: "neurology",
    ginekolog: "gynecology",
    ginekologia: "gynecology",
    ortopeda: "orthopedics",
    ortopedia: "orthopedics",
    psycholog: "psychology",
    psychologia: "psychology",
    fizjoterapeuta: "physiotherapy",
    fizjoterapia: "physiotherapy",
    endokrynolog: "endocrinology",
    endokrynologia: "endocrinology",
    gastroenterolog: "gastroenterology",
    gastroenterologia: "gastroenterology",
    diabetolog: "diabetology",
    diabetologia: "diabetology",
    pulmonolog: "pulmonology",
    pulmonologia: "pulmonology",
    laryngolog: "laryngology",
    laryngologia: "laryngology",
    usg: "diagnostics",
    diagnostyka: "diagnostics",
    zabiegowy: "procedure",
    laboratorium: "lab",
    "punkt pobran": "lab",
  };
  if (known[normalized]) return known[normalized];
  const colors = [
    "general",
    "internal",
    "cardiology",
    "dermatology",
    "pediatrics",
    "neurology",
    "gynecology",
    "orthopedics",
    "psychology",
    "physiotherapy",
    "endocrinology",
    "gastroenterology",
    "diabetology",
    "pulmonology",
    "laryngology",
    "diagnostics",
    "procedure",
    "lab",
  ];
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

const cabinetBackendIds = {
  "Gabinet 101": 1,
  "Gabinet 204": 2,
  "Gabinet 306": 3,
};

const initialAppointments = [
  { id: "seed-1", patient: "Jan Malinowski", day: 0, time: "08:00", doctor: "dr Anna Nowak", specialization: "Internista", cabinet: "Gabinet 101" },
  { id: "seed-2", patient: "Maria Lewandowska", day: 0, time: "11:00", doctor: "dr Piotr ZieliЕ„ski", specialization: "Kardiolog", cabinet: "Gabinet 204" },
  { id: "seed-3", patient: "Ewa WГіjcik", day: 1, time: "10:00", doctor: "dr Marta WiЕ›niewska", specialization: "Dermatolog", cabinet: "Gabinet 306" },
  { id: "seed-4", patient: "Tomasz Zielonka", day: 2, time: "14:00", doctor: "dr Anna Nowak", specialization: "Internista", cabinet: "Gabinet 101" },
  { id: "seed-5", patient: "Oliwia KrГіl", day: 3, time: "09:00", doctor: "dr Karol Maj", specialization: "Pediatra", cabinet: "Gabinet 204" },
  { id: "seed-6", patient: "Adam Lis", day: 4, time: "16:00", doctor: "dr Piotr ZieliЕ„ski", specialization: "Kardiolog", cabinet: "Gabinet 204" },
  { id: "seed-7", patient: "Natalia Grabowska", day: 6, time: "12:00", doctor: "dr Marta WiЕ›niewska", specialization: "Dermatolog", cabinet: "Gabinet 306" },
];

// ==============================
// DOM elements
// ==============================
const elements = {
  loginScreen: document.querySelector("#loginScreen"),
  loginForm: document.querySelector("#loginForm"),
  loginStatus: document.querySelector("#loginStatus"),
  appShell: document.querySelector("#appShell"),
  menuButton: document.querySelector("#sidebarToggle") || document.querySelector("#menuButton") || document.querySelector(".menu-button") || document.querySelector("[data-sidebar-toggle]"),
  sidebarNav: document.querySelector("#sidebarNav"),
  logoutButton: document.querySelector("#logoutButton"),
  topbarTitle: document.querySelector("#topbarTitle"),
  profileName: document.querySelector("#profileName"),
  profileRole: document.querySelector("#profileRole"),
  profileAvatar: document.querySelector("#profileAvatar"),
  calendarGrid: document.querySelector("#calendarGrid"),
  weekRange: document.querySelector("#weekRange"),
  availableOnly: document.querySelector("#availableOnly"),
  availabilityFilter: document.querySelector(".availability-filter"),
  patientForm: document.querySelector("#patientForm"),
  formStatus: document.querySelector("#formStatus"),
  viewButtons: document.querySelectorAll(".view-button"),
  newAppointmentButton: document.querySelector("#newAppointmentButton"),
  appointmentModal: document.querySelector("#appointmentModal"),
  detailsModal: document.querySelector("#detailsModal"),
  appointmentForm: document.querySelector("#appointmentForm"),
  appointmentStatus: document.querySelector("#appointmentStatus"),
  appointmentDetails: document.querySelector("#appointmentDetails"),
  doctorFilter: document.querySelector("#doctorFilter"),
  cabinetFilter: document.querySelector("#cabinetFilter"),
  serviceFilter: document.querySelector("#serviceFilter"),
  miniCalendar: document.querySelector("#miniCalendar"),
  todayButton: document.querySelector("#todayButton"),
  prevWeekButton: document.querySelector("#prevWeek"),
  nextWeekButton: document.querySelector("#nextWeek"),
  closeModalButtons: document.querySelectorAll("[data-close-modal]"),
};

let weekOffset = 0;
let selectedDate = today();
let calendarViewMode = "day";
let calendarDoctorFilter = "";
let calendarCabinetFilter = "";
let calendarServiceFilter = "";
let calendarPatientFilter = "";
let calendarStatusFilter = "all";
let receptionCalendarDoctorPage = 0;
let patientSearchQuery = "";
let patientSearchRenderTimer = null;
let patientStatusFilter = "all";
let selectedPatientId = null;
let patientCardMode = "view";
let patientCardDirty = false;
let patientEditInitialSnapshot = "";
let patientCardScrollHandler = null;
let patientCardObserver = null;
let patientSortKey = "name";
let patientSortDirection = "asc";
let historySearchQuery = "";
let historySearchRenderTimer = null;
let historyStatusFilter = "all";
let historyDoctorFilter = "all";
let historyCabinetFilter = "all";
let historyServiceFilter = "all";
let historyDateFrom = "";
let historyDateTo = "";
let historyPage = 1;
let historyRowsPerPage = 10;
let doctorSearchQuery = "";
let doctorSearchRenderTimer = null;
let doctorStatusFilter = "all";
let selectedDoctorId = null;
let doctorCardMode = "view";
let doctorEditInitialSnapshot = "";
let doctorEditHasUnsavedChanges = false;
let doctorPendingAvatarDataUrl = "";
let serviceSearchQuery = "";
let serviceStatusFilter = "all";
let selectedServiceId = null;
let cabinetSearchQuery = "";
let cabinetSearchFocusState = null;
let cabinetStatusFilter = "all";
let selectedCabinetId = null;
let userSearchQuery = "";
let userSearchRenderTimer = null;
let userStatusFilter = "all";
let selectedUserId = null;
let usersPage = 1;
let usersRowsPerPage = 10;
let globalSearchResults = [];
let patients = loadCollection(storageKeys.patients, [], normalizePatient);
let appointments = loadCollection(storageKeys.appointments, initialAppointments, normalizeAppointment);
let doctors = loadCollection(storageKeys.doctors, [], normalizeDoctor);
let services = loadCollection(storageKeys.services, [], normalizeService);
let cabinets = loadCollection(storageKeys.cabinets, [], normalizeCabinet);
let doctorAbsences = loadCollection(storageKeys.doctorAbsences, [], normalizeDoctorAbsence);
let users = [];
let settings = {};
let systemSettings = null;
let clinicSettings = null;
let clinicWorkingHours = null;
let appointmentSettings = null;
let securitySettings = null;
let emailSettings = null;
let backendDoctors = doctors;
let backendServices = services;
let selectedAppointmentPatientId = null;
let lastAppointmentSubmitError = "";
let appointmentPreferredTime = "";
let registrationSelectedPatientId = null;
let pendingRegistrationAppointment = null;
const registrationSteps = ["patient", "service", "date", "doctor", "confirm"];
let registrationStep = "patient";
let registrationShowNewPatient = false;
let registrationServiceSearchQuery = "";
let registrationDraft = {
  patientMode: "existing",
  patientId: null,
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  pesel: "",
  birthDate: "",
  gender: "",
  bloodGroup: "",
  serviceId: "",
  doctorId: "",
  date: today(),
  time: "",
  reason: "",
  note: "",
};
let currentUser = { id: null, role: "recepcja", name: "Recepcja", displayRole: "Recepcja", doctor_id: null, must_change_password: false };
let activeView = "dashboard";
let appEventsBound = false;
let dataPollingStarted = false;
let dataPollingTimers = {};
let dataPollingWarningShown = false;
let notifications = [];
let notificationUnreadCount = 0;
let notificationPollingInterval = null;
let notificationDropdownOpen = false;
let notificationBellBound = false;
const expandedNotificationIds = new Set();

const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 18;
const CALENDAR_SLOT_MINUTES = 30;
const CALENDAR_SLOT_HEIGHT = 48;
const RECEPTION_CALENDAR_DOCTORS_PER_PAGE = 4;
let calendarStartMinutes = CALENDAR_START_HOUR * 60;
let calendarEndMinutes = CALENDAR_END_HOUR * 60;

const viewRegistry = {
  dashboard: { sectionId: "dashboardView", title: "Dashboard", render: () => renderDashboard() },
  calendar: { sectionId: "calendarView", title: "Kalendarz wizyt", render: () => renderCalendar() },
  registration: { sectionId: "registrationView", title: "Nowa rejestracja", render: () => renderRegistration() },
  patients: { sectionId: "patientsView", title: "Pacjenci", render: () => renderPatients() },
  patientCard: { sectionId: "patientCardView", title: "Karta pacjenta", render: () => renderPatientCard(selectedPatientId, patientCardMode) },
  doctors: { sectionId: "doctorsView", title: "Lekarze", render: () => renderDoctors() },
  doctorCard: { sectionId: "doctorCardView", title: "Karta lekarza", render: () => renderDoctorCard(selectedDoctorId, doctorCardMode) },
  rooms: { sectionId: "roomsView", title: "Gabinety", render: () => renderRooms() },
  services: { sectionId: "servicesView", title: "Usługi medyczne", render: () => renderServices() },
  history: { sectionId: "historyView", title: "Historia wizyt", render: () => renderHistory() },
  users: { sectionId: "usersView", title: "Użytkownicy", render: () => renderUsers() },
  settings: { sectionId: "settingsView", title: "Ustawienia", render: () => renderSettings() },
};

const roleBranches = {
  recepcja: {
    label: "Recepcja",
    defaultView: "dashboard",
    navigation: ["dashboard", "calendar", "registration", "patients", "doctors", "rooms", "services", "history", "users", "settings"],
    allowedViews: ["dashboard", "calendar", "registration", "patients", "patientCard", "doctors", "doctorCard", "rooms", "services", "history", "users", "settings"],
  },
  lekarz: {
    label: "Lekarz",
    defaultView: "dashboard",
    navigation: ["dashboard", "calendar", "patients", "history", "settings"],
    allowedViews: ["dashboard", "calendar", "patients", "patientCard", "history", "settings"],
  },
};

// ==============================
// localStorage helpers
// ==============================
function loadCollection(key, fallback, normalizer) {
  try {
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : fallback;
    const source = Array.isArray(parsed) ? parsed : fallback;
    return source.map(normalizer).filter(Boolean);
  } catch {
    return fallback.map(normalizer).filter(Boolean);
  }
}

function saveCollection(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable in private modes; keep in-memory data working.
  }
}

// ==============================
// API helpers
// ==============================
function warnApiFailure(method, url, error) {
  console.warn(`[MediPlus] ${method} ${url} failed:`, error?.message || error);
}

function extractApiData(payload, collectionKey = "") {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return payload ?? null;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === "object") return payload.data;

  const keys = collectionKey
    ? [collectionKey]
    : ["patients", "appointments", "doctors", "services", "cabinets", "users"];

  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  return payload;
}

async function safeApiRequest(url, { method = "GET", data, collectionKey = "" } = {}) {
  if (typeof fetch !== "function") {
    warnApiFailure(method, url, new Error("fetch is unavailable"));
    return null;
  }

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };

  if (data !== undefined && method !== "GET") {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    let payload = null;

    try {
      payload = await response.json();
    } catch (error) {
      throw new Error(`Invalid JSON response (${response.status})`);
    }

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || `HTTP ${response.status}`);
    }

    return extractApiData(payload, collectionKey);
  } catch (error) {
    warnApiFailure(method, url, error);
    return null;
  }
}

function apiGet(url, collectionKey = "") {
  return safeApiRequest(url, { method: "GET", collectionKey });
}

function apiPost(url, data) {
  return safeApiRequest(url, { method: "POST", data });
}

function apiPut(url, data) {
  return safeApiRequest(url, { method: "PUT", data });
}

function apiPatch(url, data) {
  return safeApiRequest(url, { method: "PATCH", data });
}

function apiDelete(url, data) {
  return safeApiRequest(url, { method: "DELETE", data });
}
async function apiRequest(endpoint, options = {}) {
  if (typeof fetch !== "function") {
    const error = new Error("Backend is unavailable.");
    error.isBackendUnavailable = true;
    throw error;
  }

  const requestOptions = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  };

  if (options.body !== undefined) {
    requestOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  let response;

  try {
    response = await fetch(endpoint, requestOptions);
  } catch {
    const error = new Error("Backend is unavailable.");
    error.isBackendUnavailable = true;
    throw error;
  }

  let payload;

  try {
    payload = await response.json();
  } catch {
    const error = new Error("Backend returned an invalid response.");
    error.status = response.status;
    error.isBackendUnavailable = true;
    throw error;
  }

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.error || payload.message || "API request failed.");
    error.status = response.status;
    error.payload = payload;
    error.isBackendUnavailable = response.status >= 500;
    throw error;
  }

  return payload;
}

// ==============================
// Authentication/session boot
// ==============================
function authRoleKey(role) {
  const value = String(role || "").trim().toLowerCase();
  return value === "lekarz" || value === "doctor" ? "lekarz" : "recepcja";
}

function getRoleBranch(role = currentUser.role) {
  const key = authRoleKey(role);
  return roleBranches[key] || roleBranches.recepcja;
}

function isViewAllowedForRole(view, role = currentUser.role) {
  return getRoleBranch(role).allowedViews.includes(view);
}

function getRoleNavigationItems(role = currentUser.role) {
  return getRoleBranch(role).navigation
    .map((view) => [view, viewRegistry[view]?.title || view])
    .filter(([view]) => Boolean(viewRegistry[view]));
}

function resolveRoleView(view, role = currentUser.role) {
  const branch = getRoleBranch(role);
  return isViewAllowedForRole(view, role) && viewRegistry[view] ? view : branch.defaultView;
}

function renderActiveView(view) {
  viewRegistry[view]?.render?.();
  bindPolishPhoneInputs(document.querySelector(`#${viewRegistry[view]?.sectionId}`) || document);
}

function getSidebarToggle() {
  return document.querySelector("#sidebarToggle")
    || document.querySelector("#menuButton")
    || document.querySelector(".menu-button")
    || document.querySelector("[data-sidebar-toggle]");
}

// Sidebar state is UI-only. Persisting it keeps the compact layout after refresh/login.
function setSidebarCollapsed(collapsed, { persist = true } = {}) {
  const isCollapsed = Boolean(collapsed);
  const sidebarToggle = getSidebarToggle();
  document.body.classList.toggle("sidebar-collapsed", isCollapsed);
  elements.appShell?.classList.toggle("sidebar-collapsed", isCollapsed);
  sidebarToggle?.setAttribute("aria-expanded", String(!isCollapsed));
  sidebarToggle?.setAttribute("aria-label", isCollapsed ? "Rozwiń menu" : "Zwiń menu");

  if (persist) {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isCollapsed ? "true" : "false");
    } catch {
      // Sidebar collapse still works even when localStorage is unavailable.
    }
  }
}

function restoreSidebarCollapsedState() {
  let stored = "false";
  try {
    stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) || "false";
  } catch {
    stored = "false";
  }
  setSidebarCollapsed(stored === "true", { persist: false });
}

function toggleSidebarCollapsed() {
  const collapsed = !document.body.classList.contains("sidebar-collapsed");
  setSidebarCollapsed(collapsed);
}

function normalizeAuthUser(user) {
  const role = authRoleKey(user?.role);
  const displayRole = getRoleBranch(role).label;
  const firstName = user?.first_name || user?.firstName || "";
  const lastName = user?.last_name || user?.lastName || "";
  const fallbackName = `${firstName} ${lastName}`.trim();

  return {
    id: user?.id ?? null,
    role,
    displayRole,
    name: user?.name || fallbackName || displayRole,
    login: user?.login || user?.username || "",
    email: user?.email || "",
    doctor_id: user?.doctor_id ?? user?.doctorId ?? null,
    must_change_password: Boolean(user?.must_change_password),
  };
}

function clearLoginForm(message = "") {
  if (elements.loginForm) {
    elements.loginForm.reset();
    const loginInput = elements.loginForm.querySelector('[name="login"]');
    const passwordInput = elements.loginForm.querySelector('[name="password"]');
    if (loginInput) loginInput.value = "";
    if (passwordInput) passwordInput.value = "";

    setTimeout(() => {
      if (!elements.loginScreen?.classList.contains("is-hidden")) {
        if (loginInput) loginInput.value = "";
        if (passwordInput) passwordInput.value = "";
      }
    }, 50);
  }

  if (elements.loginStatus) {
    elements.loginStatus.textContent = message;
  }
}

function updateCurrentUser(user) {
  currentUser = normalizeAuthUser(user);

  if (elements.profileName) {
    elements.profileName.textContent = currentUser.name;
  }

  if (elements.profileRole) {
    elements.profileRole.textContent = currentUser.displayRole;
  }

  if (elements.profileAvatar) {
    const linkedDoctor = authRoleKey(currentUser.role) === "lekarz" ? currentUserDoctorProfile() : null;

    if (linkedDoctor) {
      elements.profileAvatar.innerHTML = renderDoctorAvatar(linkedDoctor, { size: 42 });
    } else {
      const initials = currentUser.name
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "R";
      elements.profileAvatar.innerHTML = `<div class="avatar photo">${escapeHtml(initials)}</div>`;
    }
  }
}

function showLoginScreen(message = "") {
  if (typeof stopAppointmentPolling === "function") stopAppointmentPolling();
  if (typeof stopDoctorPolling === "function") stopDoctorPolling();
  if (typeof stopNotificationPolling === "function") stopNotificationPolling();
  elements.appShell?.classList.add("is-hidden");
  elements.loginScreen?.classList.remove("is-hidden");
  clearLoginForm(message);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function uiIcon(name) {
  const icons = {
    dashboard: '<path d="M3 13h8V3H3z"/><path d="M13 21h8V11h-8z"/><path d="M13 3h8v6h-8z"/><path d="M3 21h8v-6H3z"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
    registration: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 12v6"/><path d="M9 15h6"/>',
    patients: '<path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M2 21v-2a4 4 0 0 1 3-3.87"/>',
    doctors: '<path d="M6 2v6a6 6 0 0 0 12 0V2"/><path d="M12 14v3a4 4 0 0 0 8 0v-2"/><circle cx="20" cy="13" r="2"/>',
    rooms: '<path d="M4 21V3h12v18"/><path d="M16 8h4v13"/><path d="M9 12h.01"/><path d="M2 21h20"/>',
    services: '<path d="M9 3h6l1 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3z"/><path d="M12 10v6"/><path d="M9 13h6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/><path d="M12 7v5l3 2"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.32.4.65.6 1H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-.51 1z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-8"/>',
    back: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.dashboard}</svg>`;
}

function getAppointmentsForDate(dateIso = today(), { doctorId = null } = {}) {
  return appointments.filter((appointment) => {
    const appointmentDate = appointment.date || appointment.appointment_date;
    if (!appointmentDate) {
      console.warn("[MediPlus] Appointment missing date:", appointment);
      return false;
    }

    if (dateToIso(`${appointmentDate}T00:00:00`) !== dateIso) return false;
    if (doctorId && !isAppointmentForDoctor(appointment, doctorId)) return false;

    const status = getResolvedAppointmentStatus(appointment);
    return !["Anulowana", "Nieobecny pacjent"].includes(status);
  });
}

function getTodayAppointments({ doctorId = null } = {}) {
  return getAppointmentsForDate(today(), { doctorId });
}

function getPatientCountForAppointments(sourceAppointments) {
  const uniquePatients = new Set();
  sourceAppointments.forEach((appointment) => {
    const key = appointment.patient_id || appointment.patientId || patientFullName(appointment) || appointment.patient;
    if (key) uniquePatients.add(String(key).toLowerCase());
  });
  return uniquePatients.size;
}

function getTodayPatients({ doctorId = null } = {}) {
  return getPatientCountForAppointments(getTodayAppointments({ doctorId }));
}

function formatDashboardDelta(currentValue, previousValue, label = "w porównaniu do wczoraj") {
  const diff = Number(currentValue || 0) - Number(previousValue || 0);
  if (diff > 0) return `+${diff} ${label}`;
  if (diff < 0) return `${diff} ${label}`;
  return `Bez zmian ${label}`;
}

function dashboardUpcomingAppointments(limit = 5, { doctorId = null } = {}) {
  const now = new Date();
  return appointments
    .filter((appointment) => {
      if (doctorId && !isAppointmentForDoctor(appointment, doctorId)) return false;
      const status = getResolvedAppointmentStatus(appointment);
      if (!["Zaplanowana", "W trakcie"].includes(status)) return false;
      const start = appointmentStartDateTime(appointment);
      return status === "W trakcie" || Boolean(start && start >= now);
    })
    .sort((a, b) => {
      const aStart = appointmentStartDateTime(a)?.getTime() || Number.MAX_SAFE_INTEGER;
      const bStart = appointmentStartDateTime(b)?.getTime() || Number.MAX_SAFE_INTEGER;
      return aStart - bStart;
    })
    .slice(0, limit);
}

function getDoctorByAppointment(appointment) {
  const doctorId = appointment?.doctor_id ?? appointment?.doctorId;
  if (doctorId) {
    const byId = doctors.find((doctor) => String(doctor.id ?? doctor.doctor_id) === String(doctorId));
    if (byId) return byId;
  }

  const name = String(appointment?.doctor || "").trim().toLowerCase();
  return doctors.find((doctor) => doctorFullName(doctor).toLowerCase() === name) || null;
}

function getPatientProfileStatus(patient) {
  const status = String(patient?.profile_status || patient?.profileStatus || "").toLowerCase();
  const hasRequiredProfileData = Boolean(patient?.pesel && patient?.birthDate && patient?.gender && patient?.phone);
  if (status === "complete" || status === "kompletny") return "complete";
  if ((status === "incomplete" || status === "niepełny" || status === "niepelny") && !hasRequiredProfileData) return "incomplete";
  return hasRequiredProfileData ? "complete" : "incomplete";
}

function isActivePatient(patient) {
  return patient?.isActive !== false && normalizeBoolean(patient?.is_active, true) !== false;
}

function getIncompletePatients(limit = 5) {
  return patients.filter((patient) => isActivePatient(patient) && getPatientProfileStatus(patient) !== "complete").slice(0, limit);
}

function getAppointmentTimeParts(appointment) {
  const start = appointmentStartDateTime(appointment);
  const end = appointmentEndDateTime(appointment);
  return {
    date: start ? safeFmt(start, { day: "2-digit", month: "2-digit" }) : "--.--",
    start: start ? formatTime(start) : formatTime(appointment.time || appointment.start_time) || "--:--",
    end: end ? formatTime(end) : formatTime(appointment.end_time) || "",
  };
}

function renderDashboardAppointmentRow(appointment) {
  const time = getAppointmentTimeParts(appointment);
  const doctor = getDoctorByAppointment(appointment);
  const cabinet = appointment.cabinet || appointment.cabinet_name || "Brak gabinetu";
  const service = appointment.specialization || appointment.service || appointment.service_name || "Brak usługi";

  return `
    <div class="visit-row">
      <div class="visit-time">
        <span class="visit-date">${escapeHtml(time.date)}</span>
        <strong>${escapeHtml(time.start)}</strong>
        <span>${escapeHtml(time.end)}</span>
      </div>
      ${renderPatientInitials(appointment.patient || patientFullName(appointment))}
      <div>
        <strong>${escapeHtml(appointment.patient || patientFullName(appointment) || "Brak danych")}</strong>
        <span>${escapeHtml(doctorFullName(doctor) || appointment.doctor || "Brak lekarza")}</span>
      </div>
      <div class="visit-row-meta">
        <em>${escapeHtml(service)}</em>
        <button class="row-link" type="button">${escapeHtml(cabinet)} ›</button>
      </div>
    </div>
  `;
}

function renderPatientInitials(name) {
  const initials = String(name || "P")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "P";
  return `<span class="mini-avatar">${escapeHtml(initials)}</span>`;
}

function addMinutesToTime(time, minutes) {
  const [hours, mins] = String(time || "08:00").split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, mins || 0, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return formatTime(date);
}

function timeToMinutes(time) {
  const [hours, mins] = String(time || "00:00").split(":").map(Number);
  return (hours || 0) * 60 + (mins || 0);
}

function getDoctorDayWindow() {
  return { start: "08:00", end: "18:00" };
}

function getAvailableSlotsForDoctor(doctor, { date = today(), limit = 3 } = {}) {
  if (!doctor) return [];
  if (!isActiveDoctor(doctor)) return [];

  const doctorId = doctor.id ?? doctor.doctor_id;
  if (!doctorId) return [];

  const serviceCandidates = getAppointmentServicesForDoctor(doctor);
  const slotSet = new Set();

  serviceCandidates.forEach((service) => {
    const serviceId = service?.id ?? service?.service_id;
    if (!serviceId) return;
    const result = availableStartTimes({
      doctorId,
      serviceId,
      date,
      // Dashboard pokazuje najbliższe realne terminy dla dowolnego pasującego gabinetu.
      // Sentinel omija ewentualnie otwarty formularz rejestracji z wybranym gabinetem.
      cabinetId: "__dashboard_any_cabinet__",
    });
    (result?.slots || []).forEach((slot) => slotSet.add(formatTime(slot)));
  });

  return Array.from(slotSet)
    .filter(Boolean)
    .sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
    .slice(0, limit);
}

function getDoctorDashboardTimelineSlots(doctor, { date = today(), doctorId = null } = {}) {
  if (!doctor) return [];
  const resolvedDoctorId = doctorId || doctor.id || doctor.doctor_id;
  const doctorWindow = getDoctorScheduleForDate(resolvedDoctorId, date);
  const clinicWindow = getClinicWorkingHoursForDate(date);

  if (!doctorWindow?.active || !clinicWindow?.active) return [];

  const startMinutes = Math.max(timeToMinutes(doctorWindow.start), timeToMinutes(clinicWindow.start));
  const endMinutes = Math.min(timeToMinutes(doctorWindow.end), timeToMinutes(clinicWindow.end));
  if (endMinutes <= startMinutes) return [];

  const busyRanges = getAppointmentsForDate(date, { doctorId: resolvedDoctorId })
    .filter((appointment) => !["Anulowana", "Nieobecny pacjent"].includes(getResolvedAppointmentStatus(appointment)))
    .map((appointment) => {
      const start = timeToMinutes(formatTime(appointment.time || appointment.start_time));
      const end = timeToMinutes(formatTime(appointment.end_time) || addMinutesToTime(appointment.time || appointment.start_time, 30));
      return { start, end: end > start ? end : start + 30 };
    });

  const step = getAppointmentSlotStepMinutes();
  const slots = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += step) {
    const isBusy = busyRanges.some((range) => range.start < minutes + step && range.end > minutes);
    slots.push({ time: minutesToTime(minutes), isBusy });
  }
  return slots;
}

function renderDashboardFreeSlots({ doctorId = null, interactive = true } = {}) {
  const sourceDoctors = doctorId
    ? doctors.filter((doctor) => String(doctor.id ?? doctor.doctor_id) === String(doctorId))
    : doctors.filter(isActiveDoctor).slice(0, 5);

  if (!sourceDoctors.length) {
    return `<p class="empty-note">Brak lekarzy do wyświetlenia.</p>`;
  }

  return sourceDoctors
    .map((doctor) => {
      const slots = getAvailableSlotsForDoctor(doctor, { limit: 3 });
      const buttons = slots.length
        ? slots.map((slot) => `<button class="slot" type="button" ${interactive ? `data-dashboard-slot="${escapeHtml(slot)}" data-dashboard-doctor="${escapeHtml(doctor.id ?? doctor.doctor_id ?? doctorFullName(doctor))}"` : ""}>${escapeHtml(slot)}</button>`).join("")
        : `<span class="slot muted">—</span>`;
      return `
        <div class="slot-row">
          ${renderDoctorAvatar(doctor, { size: 42 })}
          <div>
            <strong>${escapeHtml(doctorFullName(doctor))}</strong>
            <span>${escapeHtml(doctor.specialization || "Lekarz")}</span>
          </div>
          <div class="slot-buttons">${buttons}</div>
        </div>
      `;
    })
    .join("");
}

function renderMiniCalendar({ embedded = false } = {}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = safeFmt(first, { month: "long", year: "numeric" });
  const cells = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"].map((day) => `<strong>${day}</strong>`);

  for (let i = 0; i < startOffset; i += 1) cells.push("<span></span>");
  for (let day = 1; day <= daysInMonth; day += 1) {
    const active = day === now.getDate() ? "active" : "";
    cells.push(`<span class="${active}">${day}</span>`);
  }

  const calendar = `
    <div class="mini-calendar calendar-preview">
      <div class="mini-calendar-title">${escapeHtml(monthName)}</div>
      <div class="mini-grid">${cells.join("")}</div>
    </div>
  `;

  if (embedded) return calendar;

  return `
    <div class="card dashboard-card">
      <div class="card-title"><h3>Kalendarz</h3><strong>${escapeHtml(monthName)}</strong></div>
      ${calendar}
    </div>
  `;
}

function renderDashboardDatePicker() {
  const now = new Date();
  return `
    <div class="dashboard-date-picker" data-dashboard-date-picker>
      <button class="dashboard-date-trigger" type="button" data-dashboard-date-toggle aria-expanded="false">
        <span class="dashboard-date-icon">${uiIcon("calendar")}</span>
        <span>
          <strong>${escapeHtml(safeFmt(now, { weekday: "long" }))}</strong>
          <small>${escapeHtml(safeFmt(now, { day: "numeric", month: "long", year: "numeric" }))}</small>
        </span>
      </button>
      <div class="dashboard-date-popover" data-dashboard-date-menu hidden>
        ${renderMiniCalendar({ embedded: true })}
      </div>
    </div>
  `;
}

function renderDashboard() {
  if (authRoleKey(currentUser.role) === "lekarz") {
    renderDoctorDashboard();
    return;
  }
  renderReceptionDashboard();
}

function renderReceptionDashboard() {
  const dashboard = document.querySelector("#dashboardView");
  if (!dashboard) return;

  const todayAppointments = getTodayAppointments();
  const yesterdayIso = dateToIso(addDays(parseLocalDate(today()), -1));
  const yesterdayAppointments = getAppointmentsForDate(yesterdayIso);
  const todayPatientCount = getPatientCountForAppointments(todayAppointments);
  const yesterdayPatientCount = getPatientCountForAppointments(yesterdayAppointments);
  const todayDoctors = new Set(
    todayAppointments
      .map((appointment) => appointment.doctor_id || appointment.doctorId || appointment.doctor)
      .filter(Boolean)
      .map(String)
  );
  const upcoming = dashboardUpcomingAppointments(5);
  const incompletePatients = getIncompletePatients(5);

  dashboard.innerHTML = `
    <section class="dashboard-head">
      <div>
        <h2>Witaj, Recepcjo! 👋</h2>
        <p>Oto podsumowanie dzisiejszego dnia w klinice.</p>
      </div>
      ${renderDashboardDatePicker()}
    </section>

    <section class="dashboard-stats">
      ${renderDashboardStat("calendar", "Wizyty dziś", todayAppointments.length, formatDashboardDelta(todayAppointments.length, yesterdayAppointments.length))}
      ${renderDashboardStat("patients", "Pacjenci dziś", todayPatientCount, formatDashboardDelta(todayPatientCount, yesterdayPatientCount), "green")}
      ${renderDashboardStat("document", "Niepełne profile", getIncompletePatients(9999).length, "Wymagają uzupełnienia", "orange")}
      ${renderDashboardStat("doctors", "Lekarze dziś", todayDoctors.size, "Z zaplanowanymi wizytami", "purple")}
    </section>

    <section class="dashboard-main">
      ${renderDashboardCard("Najbliższe wizyty", "Zobacz kalendarz", upcoming.length ? upcoming.map(renderDashboardAppointmentRow).join("") : `<p class="empty-note">Brak nadchodzących wizyt.</p>`, "calendar", "clock")}
      ${renderDashboardCard("Wolne terminy dzisiaj", "Zobacz pełny kalendarz", renderDashboardFreeSlots(), "calendar", "calendar")}
      ${renderDashboardCard("Niepełne profile pacjentów", "Zobacz wszystkich", incompletePatients.length ? incompletePatients.map(renderIncompletePatientRow).join("") : `<p class="empty-note">Brak niepełnych profili.</p>`, "patients", "document")}
    </section>

  `;

  bindDashboardInteractions();
}

function renderDoctorDashboard() {
  const dashboard = document.querySelector("#dashboardView");
  if (!dashboard) return;

  const doctorId = getCurrentDoctorId();
  const scopedDoctorId = doctorId || "__missing_doctor__";
  const doctor = currentUserDoctorProfile();
  if (!doctorId) {
    console.warn("[MediPlus] Cannot resolve doctorId for Lekarz dashboard.");
  }

  const upcoming = dashboardUpcomingAppointments(5, { doctorId: scopedDoctorId });
  const todayAppointments = getTodayAppointments({ doctorId: scopedDoctorId });

  dashboard.innerHTML = `
    <section class="dashboard-head">
      <div>
        <h2>Witaj, ${escapeHtml(currentUser.name)}!</h2>
        <p>Twój harmonogram i wizyty na dziś.</p>
      </div>
      ${renderDashboardDatePicker()}
    </section>

    <section class="dashboard-stats doctor-dashboard-stats">
      ${renderDashboardStat("calendar", "Wizyty dziś", todayAppointments.length, "Tylko Twoje wizyty")}
      ${renderDashboardStat("patients", "Pacjenci dziś", getTodayPatients({ doctorId: scopedDoctorId }), "Unikalni pacjenci", "green")}
    </section>

    <section class="dashboard-main doctor-dashboard-main">
      ${renderDashboardCard("Najbliższe wizyty", "Zobacz kalendarz", upcoming.length ? upcoming.map(renderDashboardAppointmentRow).join("") : `<p class="empty-note">Brak nadchodzących wizyt.</p>`, "calendar", "clock")}
      ${renderDoctorAvailabilityCard(doctor, scopedDoctorId)}
    </section>
  `;

  bindDashboardInteractions();
}

function renderDashboardStat(iconName, label, value, note, variant = "") {
  return `
    <div class="card dashboard-stat ${escapeHtml(variant)}">
      <div class="stat-icon">${uiIcon(iconName)}</div>
      <div>
        <span>${escapeHtml(label)}</span>
        <b>${escapeHtml(value)}</b>
        <small>${escapeHtml(note)}</small>
      </div>
    </div>
  `;
}

function renderDashboardCard(title, linkLabel, body, target = "calendar", iconName = "dashboard") {
  return `
    <div class="card dashboard-card">
      <div class="card-title">
        <h3>${uiIcon(iconName)} ${escapeHtml(title)}</h3>
        <button class="link-button" type="button" data-dashboard-nav="${escapeHtml(target)}">${escapeHtml(linkLabel)}</button>
      </div>
      <div class="dash-list">${body}</div>
      <button class="footer-link" type="button" data-dashboard-nav="${escapeHtml(target)}">Zobacz wszystkie ›</button>
    </div>
  `;
}

function renderQuickAction(iconName, title, text, target, variant = "") {
  return `
    <button class="dash-action ${escapeHtml(variant)}" type="button" data-dashboard-nav="${escapeHtml(target)}">
      <i>${uiIcon(iconName)}</i>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
    </button>
  `;
}

function renderIncompletePatientRow(patient) {
  return `
    <div class="profile-row">
      ${renderPatientInitials(patientFullName(patient))}
      <div>
        <strong>${escapeHtml(patientFullName(patient) || "Brak danych")}</strong>
        <span>Brakuje danych</span>
      </div>
      <button class="secondary-button" type="button" data-dashboard-nav="patients">Uzupełnij profil</button>
    </div>
  `;
}

function renderDoctorAvailabilityCard(doctor, doctorId) {
  const slots = getDoctorDashboardTimelineSlots(doctor, { doctorId });
  const slotMarkup = slots.length
    ? slots.map((slot) => `
        <span class="doctor-slot ${slot.isBusy ? "busy" : "free"}">
          <strong>${escapeHtml(slot.time)}</strong>
          <small>${slot.isBusy ? "Zajęty" : "Wolny"}</small>
        </span>
      `).join("")
    : `<p class="empty-note">Brak wolnych terminów dzisiaj.</p>`;

  return `
    <div class="card dashboard-card doctor-availability-card">
      <div class="card-title"><h3>◴ Wolne terminy dzisiaj</h3></div>
      <div class="doctor-availability-head">
        ${renderDoctorAvatar(doctor, { size: 42 })}
        <div>
          <strong>${escapeHtml(doctorFullName(doctor) || currentUser.name)}</strong>
          <span>${escapeHtml(doctor?.specialization || "Lekarz")}</span>
        </div>
      </div>
      <div class="doctor-availability-grid">${slotMarkup}</div>
    </div>
  `;
}

function bindDashboardInteractions() {
  document.querySelector("#dashboardView")?.querySelectorAll("[data-dashboard-nav]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.dashboardNav || "dashboard"));
  });
  document.querySelector("#dashboardView")?.querySelectorAll("[data-dashboard-date-picker]").forEach((picker) => {
    const toggle = picker.querySelector("[data-dashboard-date-toggle]");
    const menu = picker.querySelector("[data-dashboard-date-menu]");
    const close = () => {
      picker.classList.remove("open");
      toggle?.setAttribute("aria-expanded", "false");
      if (menu) menu.hidden = true;
    };
    const open = () => {
      picker.classList.add("open");
      toggle?.setAttribute("aria-expanded", "true");
      if (menu) menu.hidden = false;
    };

    toggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (picker.classList.contains("open")) close();
      else open();
    });
    picker.addEventListener("mouseleave", close);
    picker.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  });
}

function renderRegistration() {
  const view = document.querySelector("#registrationView");
  if (!view) return;

  if (!canCreateAppointments()) {
    view.innerHTML = `
      <section class="page-head">
        <div>
          <h1>Nowa rejestracja</h1>
          <p>Rejestracja wizyt jest dostepna tylko dla recepcji.</p>
        </div>
      </section>
      <section class="card empty-state">Brak dostepu do rejestracji wizyt.</section>
    `;
    return;
  }

  normalizeRegistrationDraft();

  view.innerHTML = `
    <section class="page-head">
      <div>
        <h1>Nowa rejestracja</h1>
        <p>Recepcyjne stanowisko do szybkiego przeprowadzenia pacjenta od wyboru profilu do potwierdzenia terminu.</p>
      </div>
    </section>

    <section class="registration-stepper card">
      ${registrationSteps.map((step, index) => `
        <button class="registration-step ${registrationStep === step ? "active" : ""} ${isRegistrationStepDone(step) ? "done" : ""}" type="button" data-registration-step="${escapeHtml(step)}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(registrationStepLabel(step))}</strong>
        </button>
      `).join("")}
    </section>

    <section class="registration-workspace registration-step-workspace">
      <aside class="card registration-side-panel">
        ${renderRegistrationPatientSearch()}
      </aside>

      <main class="card registration-main-panel registration-step-${escapeHtml(registrationStep)}" data-registration-main>
        ${renderRegistrationStepContent()}
      </main>
    </section>
  `;

  bindRegistrationWorkspace(view);
  bindPolishPhoneInputs(view);
  bindPeselInputs(view);
}

function getRegistrationSearchValues(view) {
  const value = String(view.querySelector("[data-registration-patient-search]")?.value || "").trim();
  return {
    text: value.toLowerCase(),
    digits: value.replace(/\D/g, ""),
  };
}

function filterRegistrationPatients(view) {
  const query = getRegistrationSearchValues(view);
  return patients
    .filter(isActivePatient)
    .filter((patient) => isRegistrationPatientAvailable(patient))
    .filter((patient) => {
      if (!query.text && !query.digits) return true;
      const fullName = patientFullName(patient).toLowerCase();
      const first = String(patient.firstName || patient.first_name || "").toLowerCase();
      const last = String(patient.lastName || patient.last_name || "").toLowerCase();
      const email = String(patient.email || "").toLowerCase();
      const phone = String(patient.phone || "").replace(/\D/g, "");
      const pesel = String(patient.pesel || "").replace(/\D/g, "");
      const textMatch = query.text && [fullName, first, last, email].some((field) => field.includes(query.text));
      const digitsMatch = query.digits && [phone, pesel].some((field) => field.includes(query.digits));
      return Boolean(textMatch || digitsMatch);
    })
    .slice(0, 12);
}

function renderRegistrationPatientResults(view) {
  const container = view.querySelector("[data-registration-results]");
  if (!container) return;
  const visiblePatients = filterRegistrationPatients(view);
  container.innerHTML = visiblePatients.length
    ? visiblePatients.map((patient) => `
      <button class="registration-patient-row ${String(registrationSelectedPatientId || "") === String(patient.id) ? "selected" : ""}" type="button" data-registration-patient="${escapeHtml(patient.id)}">
        ${renderPatientInitials(patientFullName(patient))}
        <span>
          <strong>${escapeHtml(patientFullName(patient) || "Pacjent")}</strong>
          <small>${escapeHtml([patient.phone, formatDate(patient.birthDate || patient.birth_date), patient.pesel].filter(Boolean).join(" · ") || patientStatusLabel(patient))}</small>
        </span>
        <span class="registration-row-status">${patientStatusBadge(patient)}</span>
      </button>
    `).join("")
    : `<div class="empty-state compact">Nie znaleziono pacjenta. Możesz dodać nowego pacjenta poniżej.</div>`;

  container.querySelectorAll("[data-registration-patient]").forEach((button) => {
    button.addEventListener("click", () => {
      selectRegistrationPatient(button.dataset.registrationPatient);
      renderRegistration();
    });
  });
}

function bindRegistrationWorkspace(view) {
  renderRegistrationPatientResults(view);
  view.querySelector("[data-registration-patient-search]")?.addEventListener("input", () => renderRegistrationPatientResults(view));
  view.querySelector("[data-registration-show-new]")?.addEventListener("click", () => {
    registrationShowNewPatient = true;
    registrationDraft.patientMode = "new";
    registrationDraft.patientId = null;
    registrationSelectedPatientId = null;
    renderRegistration();
  });
  view.querySelector("[data-registration-new-form]")?.addEventListener("input", (event) => {
    updateRegistrationPatientDraft(event.currentTarget);
    syncRegistrationPatientSearchFromDraft(view);
  });
  view.querySelector("[data-registration-new-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    updateRegistrationPatientDraft(event.currentTarget);
    if (validateRegistrationPatientStep(view)) goRegistrationStep("service");
  });
  view.querySelectorAll("[data-registration-service]").forEach((button) => {
    button.addEventListener("click", () => {
      registrationDraft.serviceId = button.dataset.registrationService || "";
      registrationDraft.doctorId = "";
      registrationDraft.time = "";
      goRegistrationStep("date");
    });
  });
  view.querySelector("[data-registration-service-search]")?.addEventListener("input", (event) => {
    registrationServiceSearchQuery = event.target.value;
    const cursorPosition = event.target.selectionStart;
    rerenderPreservingSearchFocus(renderRegistration, "[data-registration-service-search]", cursorPosition);
  });
  view.querySelectorAll("[data-registration-doctor]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      registrationDraft.doctorId = button.dataset.registrationDoctor || "";
      goRegistrationStep("confirm");
    });
  });
  view.querySelector("[data-registration-date]")?.addEventListener("change", (event) => {
    registrationDraft.date = event.target.value || today();
    registrationDraft.time = "";
    registrationDraft.doctorId = "";
    renderRegistration();
  });
  view.querySelectorAll("[data-registration-date-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      registrationDraft.date = button.dataset.registrationDatePick || today();
      registrationDraft.time = "";
      registrationDraft.doctorId = "";
      renderRegistration();
    });
  });
  view.querySelectorAll("[data-registration-time]").forEach((button) => {
    button.addEventListener("click", () => {
      registrationDraft.time = button.dataset.registrationTime || "";
      registrationDraft.doctorId = "";
      goRegistrationStep("doctor");
    });
  });
  view.querySelector("[data-registration-notes]")?.addEventListener("input", (event) => {
    registrationDraft[event.target.name] = event.target.value || "";
  });
  view.querySelector("[data-registration-confirm]")?.addEventListener("click", () => saveRegistrationAppointment(view));
  view.querySelectorAll("[data-registration-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const step = button.dataset.registrationStep;
      if (canOpenRegistrationStep(step)) goRegistrationStep(step);
    });
  });
  view.querySelectorAll("[data-registration-back]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Math.max(0, registrationSteps.indexOf(registrationStep) - 1);
      goRegistrationStep(registrationSteps[index]);
    });
  });
  view.querySelectorAll("[data-registration-next]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!validateCurrentRegistrationStep(view)) return;
      const index = Math.min(registrationSteps.length - 1, registrationSteps.indexOf(registrationStep) + 1);
      goRegistrationStep(registrationSteps[index]);
    });
  });
  view.querySelector("[data-registration-clear]")?.addEventListener("click", () => {
    resetRegistrationDraft();
    renderRegistration();
  });
}

function syncRegistrationPatientSearchFromDraft(view) {
  const input = view?.querySelector("[data-registration-patient-search]");
  if (!input) return;
  const phoneDigits = extractPolishPhoneDigits(registrationDraft.phone);
  const nextSearch = [
    registrationDraft.firstName,
    registrationDraft.lastName,
    phoneDigits ? registrationDraft.phone : "",
    registrationDraft.pesel,
  ].map((value) => String(value || "").trim()).filter(Boolean).join(" ");
  input.value = nextSearch;
  renderRegistrationPatientResults(view);
}

function registrationStepLabel(step) {
  return {
    patient: "Pacjent",
    service: "Usługa",
    date: "Termin",
    doctor: "Lekarz",
    confirm: "Potwierdzenie",
  }[step] || step;
}

function normalizeRegistrationDraft() {
  registrationDraft.date = toLocalDateKey(registrationDraft.date || selectedDate || today());
  if (!registrationSteps.includes(registrationStep)) registrationStep = "patient";
}

function resetRegistrationDraft() {
  registrationSelectedPatientId = null;
  registrationShowNewPatient = false;
  registrationServiceSearchQuery = "";
  registrationStep = "patient";
  registrationDraft = {
    patientMode: "existing",
    patientId: null,
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    pesel: "",
    birthDate: "",
    gender: "",
    bloodGroup: "",
    serviceId: "",
    doctorId: "",
    date: today(),
    time: "",
    reason: "",
    note: "",
  };
}

function registrationPatient() {
  return registrationDraft.patientId ? findPatientById(registrationDraft.patientId) : null;
}

function selectRegistrationPatient(patientId) {
  const patient = findPatientById(patientId);
  if (!patient) return;
  registrationSelectedPatientId = patient.id ?? patient.patient_id;
  registrationShowNewPatient = false;
  registrationDraft.patientMode = "existing";
  registrationDraft.patientId = registrationSelectedPatientId;
  registrationDraft.firstName = patient.firstName || patient.first_name || "";
  registrationDraft.lastName = patient.lastName || patient.last_name || "";
  registrationDraft.phone = formatPolishPhone(patient.phone || "");
  registrationDraft.email = patient.email || "";
  registrationDraft.pesel = patient.pesel || "";
  registrationDraft.birthDate = patient.birthDate || patient.birth_date || "";
  registrationDraft.gender = patient.gender || "";
  registrationDraft.bloodGroup = patient.bloodGroup || patient.blood_group || "";
  registrationStep = "service";
}

function updateRegistrationPatientDraft(form) {
  if (!form) return;
  registrationDraft.patientMode = "new";
  registrationDraft.patientId = null;
  registrationSelectedPatientId = null;
  registrationDraft.firstName = String(form.elements.firstName?.value || "").trim();
  registrationDraft.lastName = String(form.elements.lastName?.value || "").trim();
  const phoneDigits = extractPolishPhoneDigits(form.elements.phone?.value || "");
  registrationDraft.phone = phoneDigits ? formatPolishPhone(phoneDigits) : "";
  registrationDraft.email = String(form.elements.email?.value || "").trim();
  registrationDraft.pesel = String(form.elements.pesel?.value || "").replace(/\D/g, "").slice(0, 11);
  registrationDraft.birthDate = String(form.elements.birthDate?.value || "").trim();
  registrationDraft.gender = String(form.elements.gender?.value || "").trim();
  registrationDraft.bloodGroup = String(form.elements.bloodGroup?.value || "").trim();
}

function isRegistrationStepDone(step) {
  if (step === "patient") return Boolean(registrationDraft.patientId || (registrationDraft.firstName && registrationDraft.lastName && extractPolishPhoneDigits(registrationDraft.phone).length === 9));
  if (step === "service") return Boolean(registrationDraft.serviceId);
  if (step === "date") return Boolean(registrationDraft.date && registrationDraft.time);
  if (step === "doctor") return Boolean(registrationDraft.doctorId);
  if (step === "confirm") return false;
  return false;
}

function canOpenRegistrationStep(step) {
  if (step === "patient") return true;
  if (step === "service") return isRegistrationStepDone("patient");
  if (step === "date") return isRegistrationStepDone("patient") && isRegistrationStepDone("service");
  if (step === "doctor") return isRegistrationStepDone("patient") && isRegistrationStepDone("service") && isRegistrationStepDone("date");
  if (step === "confirm") return isRegistrationStepDone("patient") && isRegistrationStepDone("service") && isRegistrationStepDone("date") && isRegistrationStepDone("doctor");
  return false;
}

function goRegistrationStep(step) {
  if (!canOpenRegistrationStep(step)) return;
  registrationStep = step;
  renderRegistration();
}

function validateCurrentRegistrationStep(view) {
  if (registrationStep === "patient") return validateRegistrationPatientStep(view);
  if (registrationStep === "service") return validateRegistrationServiceStep(view);
  if (registrationStep === "date") return validateRegistrationDateStep(view);
  if (registrationStep === "doctor") return validateRegistrationDoctorStep(view);
  return true;
}

function validateRegistrationPatientStep(view) {
  const status = view.querySelector("[data-registration-status]");
  if (registrationDraft.patientId) {
    const patient = registrationPatient();
    if (!isActivePatient(patient)) {
      setStatus(status, "Nie można zapisać wizyty dla pacjenta archiwalnego.", "error");
      return false;
    }
    if (!isRegistrationPatientAvailable(patient)) {
      setStatus(status, "Pacjent ma już wizytę w wybranym terminie.", "error");
      return false;
    }
    return true;
  }
  const form = view.querySelector("[data-registration-new-form]");
  if (form) {
    updateRegistrationPatientDraft(form);
    clearFieldErrors(form);
    formatPolishPhoneFields(form);
    formatPeselFields(form);
    let valid = true;
    ["firstName", "lastName"].forEach((name) => {
      if (!String(form.elements[name]?.value || "").trim()) {
        setFieldError(form.elements[name], "To pole jest wymagane.");
        valid = false;
      }
    });
    if (extractPolishPhoneDigits(form.elements.phone?.value || "").length !== 9) {
      setFieldError(form.elements.phone, "Podaj 9 cyfr numeru telefonu.");
      valid = false;
    }
    if (!valid) setStatus(status, "Wybierz pacjenta albo uzupełnij dane nowego pacjenta.", "error");
    return valid;
  }
  setStatus(status, "Wybierz pacjenta albo dodaj nowego.", "error");
  return false;
}

function validateRegistrationServiceStep(view) {
  if (registrationDraft.serviceId) return true;
  setStatus(view.querySelector("[data-registration-status]"), "Wybierz usługę.", "error");
  return false;
}

function validateRegistrationDateStep(view) {
  if (registrationDraft.date && registrationDraft.time) return true;
  setStatus(view.querySelector("[data-registration-status]"), "Wybierz dzień i wolną godzinę.", "error");
  return false;
}

function validateRegistrationDoctorStep(view) {
  if (!registrationDraft.doctorId) {
    setStatus(view.querySelector("[data-registration-status]"), "Wybierz lekarza.", "error");
    return false;
  }
  const doctor = findDoctorByIdOrValue(registrationDraft.doctorId);
  const service = findServiceByIdOrValue(registrationDraft.serviceId);
  if (!doctorCanPerformRegistrationService(doctor, service)) {
    setStatus(view.querySelector("[data-registration-status]"), "Lekarz nie wykonuje wybranej usługi.", "error");
    return false;
  }
  const specialization = getAppointmentServiceSpecialization(service, doctor);
  if (!getCompatibleCabinetsForSpecialization(specialization).length) {
    setStatus(view.querySelector("[data-registration-status]"), "Brak gabinetu zgodnego ze specjalizacją usługi.", "error");
    return false;
  }
  return true;
}

function renderRegistrationPatientSearch() {
  const selectedPatient = registrationPatient();
  return `
    <div class="settings-card-head">
      <div>
        <h2>Wyszukaj pacjenta</h2>
      </div>
    </div>
    <label class="registration-single-search">
      <span>Imię, nazwisko, telefon lub PESEL</span>
      <input type="search" data-registration-patient-search placeholder="Wpisz dane pacjenta...">
    </label>
    <div class="registration-results" data-registration-results></div>
    ${selectedPatient ? `
      <div class="registration-selected-card">
        <small>Wybrany pacjent</small>
        <strong>${escapeHtml(patientFullName(selectedPatient))}</strong>
        <span>${escapeHtml([selectedPatient.phone, selectedPatient.pesel].filter(Boolean).join(" · "))}</span>
      </div>
    ` : ""}
  `;
}

function renderRegistrationStepContent() {
  if (registrationStep === "patient") return renderRegistrationPatientStep();
  if (registrationStep === "service") return renderRegistrationServiceStep();
  if (registrationStep === "date") return renderRegistrationDateStep();
  if (registrationStep === "doctor") return renderRegistrationDoctorStep();
  return renderRegistrationConfirmStep();
}

function renderRegistrationPatientStep() {
  const isNewPatientForm = registrationShowNewPatient || registrationDraft.patientMode === "new";
  return `
    ${isNewPatientForm ? renderRegistrationNewPatientForm() : renderRegistrationPatientSummary()}
    ${isNewPatientForm ? "" : `<p class="form-status" data-registration-status></p>`}
  `;
}

function renderRegistrationNewPatientForm() {
  const bloodGroups = [
    ["A Rh+", "A Rh+ (Najczęstsza)"],
    ["A Rh−", "A Rh−"],
    ["B Rh+", "B Rh+"],
    ["B Rh−", "B Rh−"],
    ["AB Rh+", "AB Rh+"],
    ["AB Rh−", "AB Rh−"],
    ["0 Rh+", "0 Rh+"],
    ["0 Rh−", "0 Rh− (Uniwersalny dawca)"],
  ];
  return `
    <form class="registration-new-patient-form" data-registration-new-form novalidate>
      <div class="registration-step-head compact">
        <div>
          <h2>Nowy pacjent</h2>
          <p>Uzupełnij podstawowe dane potrzebne do rejestracji wizyty.</p>
        </div>
      </div>
      <div class="registration-form-grid">
        <label>Imię *<input name="firstName" required value="${escapeHtml(registrationDraft.firstName)}"></label>
        <label>Nazwisko *<input name="lastName" required value="${escapeHtml(registrationDraft.lastName)}"></label>
        <label>Telefon *<input type="tel" name="phone" required value="${escapeHtml(registrationDraft.phone)}"></label>
        <label>Email<input type="email" name="email" value="${escapeHtml(registrationDraft.email)}"></label>
        <label>PESEL<input name="pesel" inputmode="numeric" maxlength="11" value="${escapeHtml(registrationDraft.pesel)}"></label>
        <label>Data urodzenia<input type="date" name="birthDate" value="${escapeHtml(registrationDraft.birthDate)}"></label>
        <label>Płeć
          <select name="gender">
            <option value="">Wybierz</option>
            ${["Kobieta", "Mężczyzna", "Inna"].map((value) => `<option value="${escapeHtml(value)}" ${registrationDraft.gender === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
          </select>
        </label>
        <label>Grupa krwi
          <select name="bloodGroup">
            <option value="">Nieznana</option>
            ${bloodGroups.map(([value, label]) => `<option value="${escapeHtml(value)}" ${registrationDraft.bloodGroup === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="registration-action-bar registration-action-bar-with-status">
        <p class="form-status" data-registration-status></p>
        <button class="secondary-button" type="button" data-registration-clear>Wyczyść</button>
        <button class="primary-button" type="submit">Przejdź do usługi</button>
      </div>
    </form>
  `;
}

function renderRegistrationPatientSummary() {
  const patient = registrationPatient();
  if (!patient) {
    return `
      <button class="registration-add-patient-panel" type="button" data-registration-show-new>
        <span>+</span>
        <strong>Dodaj nowego pacjenta</strong>
        <small>Jeśli pacjenta nie ma na liście, utwórz podstawową kartotekę i przejdź dalej.</small>
      </button>
    `;
  }
  return `
    <div class="registration-summary-card primary">
      ${renderPatientInitials(patientFullName(patient))}
      <div>
        <span>Wybrany pacjent</span>
        <strong>${escapeHtml(patientFullName(patient))}</strong>
        <small>${escapeHtml([patient.phone, patient.email, patient.pesel].filter(Boolean).join(" · ") || "Brak danych kontaktowych")}</small>
      </div>
      ${patientStatusBadge(patient)}
    </div>
  `;
}

function renderRegistrationServiceStep() {
  const appointmentConfig = getAppointmentSettings();
  const query = registrationServiceSearchQuery.trim().toLowerCase();
  const visibleServices = (appointmentConfig.hideInactiveServices ? services.filter(isActiveService) : services)
    .filter((service) => {
      if (!query) return true;
      return [
        serviceName(service),
        service.specialization,
        service.description,
      ].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => {
      const specializationCompare = String(a.specialization || "").localeCompare(String(b.specialization || ""), "pl", { sensitivity: "base" });
      if (specializationCompare !== 0) return specializationCompare;
      return serviceName(a).localeCompare(serviceName(b), "pl", { sensitivity: "base" });
    });
  return `
    <div class="registration-step-head registration-step-head-with-search">
      <div>
        <h2>Wybierz usługę</h2>
        <p>Czas trwania usługi zostanie użyty do wyliczenia końca wizyty i dostępnych godzin.</p>
      </div>
      <label class="registration-service-search">
        <span>Szukaj usługi</span>
        <input type="search" data-registration-service-search value="${escapeHtml(registrationServiceSearchQuery)}" placeholder="Nazwa, specjalizacja lub opis...">
      </label>
    </div>
    <div class="registration-card-grid">
      ${visibleServices.length ? visibleServices.map((service) => {
        const id = service.id ?? service.service_id ?? serviceName(service);
        const active = isActiveService(service);
        return `
          <button class="registration-choice-card ${String(registrationDraft.serviceId) === String(id) ? "selected" : ""}" type="button" data-registration-service="${escapeHtml(id)}">
            <strong>${escapeHtml(serviceName(service))}${active ? "" : ` <span class="status inactive">Nieaktywna</span>`}</strong>
            <span>${escapeHtml(service.specialization || "Usługa")}</span>
            <small>${escapeHtml(service.durationMinutes || service.duration || 30)} min · ${formatCurrency(service.price || 0)}</small>
          </button>
        `;
      }).join("") : `<div class="empty-state compact">Brak usług do wyświetlenia.</div>`}
    </div>
    <div class="registration-action-bar registration-action-bar-with-status">
      <p class="form-status" data-registration-status></p>
      <button class="secondary-button" type="button" data-registration-back>Wstecz</button>
      <button class="primary-button" type="button" data-registration-next>Dalej</button>
    </div>
  `;
}

function doctorCanPerformRegistrationService(doctor, service) {
  if (!doctor || !service) return false;
  const serviceSpec = normalizeSpecialization(getAppointmentServiceSpecialization(service, doctor));
  const doctorSpec = normalizeSpecialization(doctor.specialization || doctor.category);
  if (!serviceSpec || serviceSpec === "ogolna") return true;
  return doctorSpec === serviceSpec;
}

function getRegistrationMatchingDoctors() {
  const service = findServiceByIdOrValue(registrationDraft.serviceId);
  return doctors.filter(isActiveDoctor).filter((doctor) => doctorCanPerformRegistrationService(doctor, service));
}

function getDoctorCabinetForRegistration(doctor) {
  return getDoctorDefaultCabinet(doctor);
}

function getRegistrationSlotsForDoctor(doctor, date = registrationDraft.date) {
  const id = doctor?.id ?? doctor?.doctor_id ?? doctorFullName(doctor);
  const slots = availableStartTimes({
    doctorId: id,
    serviceId: registrationDraft.serviceId,
    date,
  }).slots || [];
  const patient = registrationPatient();
  return patient ? slots.filter((slot) => isRegistrationPatientAvailable(patient, date, slot)) : slots;
}

function getRegistrationAvailableSlotsForDate(date = registrationDraft.date) {
  const slots = new Set();
  getRegistrationMatchingDoctors().forEach((doctor) => {
    getRegistrationSlotsForDoctor(doctor, date).forEach((slot) => slots.add(slot));
  });
  return Array.from(slots).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

function getRegistrationCalendarDays() {
  const base = parseLocalDate(registrationDraft.date || today());
  const start = addDays(base, -3);
  return Array.from({ length: 14 }, (_, index) => {
    const date = addDays(start, index);
    const iso = dateToIso(date);
    return {
      iso,
      day: safeFmt(date, { weekday: "short" }),
      number: safeFmt(date, { day: "2-digit", month: "2-digit" }),
      slots: getRegistrationAvailableSlotsForDate(iso),
    };
  });
}

function renderRegistrationDateStep() {
  const days = getRegistrationCalendarDays();
  const slots = getRegistrationAvailableSlotsForDate(registrationDraft.date);
  return `
    <div class="registration-step-head">
      <div>
        <h2>Wybierz dzień i godzinę</h2>
        <p>Godziny pokazują dostępność co najmniej jednego lekarza wykonującego wybraną usługę.</p>
      </div>
      <label class="registration-date-control">Data<input type="date" data-registration-date value="${escapeHtml(registrationDraft.date)}"></label>
    </div>
    <div class="registration-mini-calendar">
      ${days.map((day) => `
        <button class="registration-day-card ${day.iso === registrationDraft.date ? "active" : ""} ${day.slots.length ? "" : "disabled"}" type="button" data-registration-date-pick="${escapeHtml(day.iso)}">
          <span>${escapeHtml(day.day)}</span>
          <strong>${escapeHtml(day.number)}</strong>
          <small>${day.slots.length ? `${day.slots.length} terminów` : "Brak"}</small>
        </button>
      `).join("")}
    </div>
    <div class="registration-time-grid">
      ${slots.length ? slots.map((slot) => `
        <button class="time-choice ${registrationDraft.time === slot ? "active" : ""}" type="button" data-registration-time="${escapeHtml(slot)}">${escapeHtml(slot)}</button>
      `).join("") : `<div class="empty-state compact">Brak wolnych godzin dla tej usługi w wybranym dniu.</div>`}
    </div>
    <div class="registration-action-bar registration-action-bar-with-status">
      <p class="form-status" data-registration-status></p>
      <button class="secondary-button" type="button" data-registration-back>Wstecz</button>
      <button class="primary-button" type="button" data-registration-next>Dalej</button>
    </div>
  `;
}

function renderRegistrationDoctorStep() {
  const matchingDoctors = getRegistrationMatchingDoctors();
  return `
    <div class="registration-step-head">
      <div>
        <h2>Wybierz lekarza</h2>
        <p>Pokazujemy lekarzy dla wybranej usługi. Kliknąć można tylko lekarza wolnego o ${escapeHtml(registrationDraft.time || "wybranej godzinie")}.</p>
      </div>
    </div>
    <div class="registration-doctor-list">
      ${matchingDoctors.length ? matchingDoctors.map((doctor) => {
        const id = doctor.id ?? doctor.doctor_id ?? doctorFullName(doctor);
        const cabinet = getDoctorCabinetForRegistration(doctor);
        const compatibleCabinets = getCompatibleCabinetsForDoctor(doctor);
        const slots = getRegistrationSlotsForDoctor(doctor, registrationDraft.date);
        const hasCompatibleCabinet = compatibleCabinets.length > 0;
        const isFreeAtSelectedTime = Boolean(hasCompatibleCabinet && registrationDraft.time && slots.includes(registrationDraft.time));
        const unavailableLabel = hasCompatibleCabinet ? "Brak terminów" : "Brak gabinetu";
        const cabinetLabel = cabinet?.name || (hasCompatibleCabinet ? "Gabinet dobierany automatycznie" : "Gabinet nieprzypisany");
        return `
          <button class="registration-doctor-card ${String(registrationDraft.doctorId) === String(id) ? "selected" : ""} ${isFreeAtSelectedTime ? "" : "disabled"}" type="button" ${isFreeAtSelectedTime ? `data-registration-doctor="${escapeHtml(id)}"` : "disabled"}>
            ${renderDoctorAvatar(doctor, { size: 48 })}
            <span>
              <strong>${escapeHtml(doctorFullName(doctor))}</strong>
              <small>${escapeHtml(doctor.specialization || "Lekarz")} · ${escapeHtml(cabinetLabel)}</small>
            </span>
            <em>${isFreeAtSelectedTime ? `Wolny ${escapeHtml(registrationDraft.time)}` : unavailableLabel}</em>
          </button>
        `;
      }).join("") : `<div class="empty-state compact">Brak lekarzy dla wybranej usługi.</div>`}
    </div>
    <div class="registration-action-bar registration-action-bar-with-status">
      <p class="form-status" data-registration-status></p>
      <button class="secondary-button" type="button" data-registration-back>Wstecz</button>
      <button class="primary-button" type="button" data-registration-next>Dalej</button>
    </div>
  `;
}

function renderRegistrationTimeStep() {
  const doctor = findDoctorByIdOrValue(registrationDraft.doctorId);
  const cabinet = getDoctorCabinetForRegistration(doctor);
  const result = availableStartTimes({
    doctorId: registrationDraft.doctorId,
    serviceId: registrationDraft.serviceId,
    date: registrationDraft.date,
    cabinetId: cabinet?.id ?? cabinet?.cabinet_id,
  });
  return `
    <div class="registration-step-head">
      <div>
        <h2>Wybierz termin</h2>
        <p>Pokazujemy tylko wolne godziny zgodne z harmonogramem lekarza i godzinami pracy kliniki.</p>
      </div>
      <label class="registration-date-control">Data<input type="date" data-registration-date value="${escapeHtml(registrationDraft.date)}"></label>
    </div>
    <div class="registration-time-grid">
      ${(result.slots || []).length ? result.slots.map((slot) => `
        <button class="time-choice ${registrationDraft.time === slot ? "active" : ""}" type="button" data-registration-time="${escapeHtml(slot)}">${escapeHtml(slot)}</button>
      `).join("") : `<div class="empty-state compact">${escapeHtml(result.reason || "Brak dostępnych terminów.")}</div>`}
    </div>
    <div class="registration-action-bar registration-action-bar-with-status">
      <p class="form-status" data-registration-status></p>
      <button class="secondary-button" type="button" data-registration-back>Wstecz</button>
      <button class="primary-button" type="button" data-registration-next>Dalej</button>
    </div>
  `;
}

function renderRegistrationConfirmStep() {
  const patient = registrationPatient();
  const service = findServiceByIdOrValue(registrationDraft.serviceId);
  const doctor = findDoctorByIdOrValue(registrationDraft.doctorId);
  const cabinet = getDoctorCabinetForRegistration(doctor);
  const cabinetLabel = cabinet?.name || "Dobierany automatycznie";
  return `
    <div class="registration-step-head">
      <div>
        <h2>Potwierdzenie wizyty</h2>
        <p>Sprawdź dane przed zapisaniem wizyty.</p>
      </div>
    </div>
    <div class="registration-confirm-grid">
      ${renderRegistrationConfirmItem("Pacjent", patient ? patientFullName(patient) : `${registrationDraft.firstName} ${registrationDraft.lastName}`.trim(), registrationDraft.phone)}
      ${renderRegistrationConfirmItem("Usługa", serviceName(service), `${service?.durationMinutes || service?.duration || 30} min · ${formatCurrency(service?.price || 0)}`)}
      ${renderRegistrationConfirmItem("Lekarz", doctorFullName(doctor), doctor?.specialization || "")}
      ${renderRegistrationConfirmItem("Gabinet", cabinetLabel, "")}
      ${renderRegistrationConfirmItem("Data", formatDate(registrationDraft.date), registrationDraft.time)}
    </div>
    <label class="registration-notes-field">Powód wizyty<textarea name="reason" data-registration-notes rows="3">${escapeHtml(registrationDraft.reason)}</textarea></label>
    <label class="registration-notes-field">Notatka<textarea name="note" data-registration-notes rows="3">${escapeHtml(registrationDraft.note)}</textarea></label>
    <div class="registration-action-bar registration-action-bar-with-status">
      <p class="form-status" data-registration-status></p>
      <button class="secondary-button" type="button" data-registration-back>Wstecz</button>
      <button class="secondary-button" type="button" data-registration-clear>Wyczyść</button>
      <button class="primary-button registration-visit-button" type="button" data-registration-confirm>Zapisz wizytę</button>
    </div>
  `;
}

function renderRegistrationConfirmItem(label, value, detail = "") {
  return `
    <div class="registration-confirm-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Brak danych")}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </div>
  `;
}

async function ensureRegistrationPatient() {
  if (registrationDraft.patientId) {
    const patient = registrationPatient();
    return isActivePatient(patient) ? patient : null;
  }
  const payload = {
    first_name: registrationDraft.firstName,
    last_name: registrationDraft.lastName,
    phone: registrationDraft.phone,
    email: registrationDraft.email || null,
    pesel: registrationDraft.pesel || null,
    birth_date: registrationDraft.birthDate || null,
    gender: registrationDraft.gender || null,
    blood_group: registrationDraft.bloodGroup || null,
    profile_status: getPatientProfileStatus({
      pesel: registrationDraft.pesel,
      birthDate: registrationDraft.birthDate,
      gender: registrationDraft.gender,
      phone: registrationDraft.phone,
    }),
  };
  try {
    const response = await apiRequest("backend/api/patients.php", { method: "POST", body: payload });
    const created = response.patient || response.data?.patient || response.data || response;
    const patient = normalizePatient({ ...payload, ...created });
    if (patient) {
      patients.unshift(patient);
      saveCollection(storageKeys.patients, patients);
      registrationDraft.patientId = patient.id ?? patient.patient_id;
      registrationSelectedPatientId = registrationDraft.patientId;
      return patient;
    }
  } catch {
    const patient = normalizePatient({ id: `local-patient-${Date.now()}`, ...payload, createdAt: new Date().toISOString() });
    patients.unshift(patient);
    saveCollection(storageKeys.patients, patients);
    registrationDraft.patientId = patient.id;
    registrationSelectedPatientId = patient.id;
    return patient;
  }
  return null;
}

function fillAppointmentModalFromRegistration(patient) {
  const form = elements.appointmentForm;
  if (!form) return false;
  const service = findServiceByIdOrValue(registrationDraft.serviceId);
  const doctor = findDoctorByIdOrValue(registrationDraft.doctorId);
  const cabinet = getDoctorCabinetForRegistration(doctor);
  if (!getCompatibleCabinetsForDoctor(doctor).length) {
    lastAppointmentSubmitError = "Brak gabinetu zgodnego ze specjalizacją lekarza.";
    return false;
  }
  populateDoctorFields(doctors);
  populateServiceFields(services);
  populateCabinetFields(cabinets);
  resetAppointmentForm();
  if (patient) selectAppointmentPatient(patient);
  else {
    form.elements.firstName.value = registrationDraft.firstName;
    form.elements.lastName.value = registrationDraft.lastName;
    form.elements.phone.value = formatPolishPhone(registrationDraft.phone);
  }
  setSelectValueByIdOrValue(form.elements.doctor, doctor?.id ?? doctor?.doctor_id ?? doctorFullName(doctor));
  setSelectValueByIdOrValue(form.elements.specialization, service?.id ?? service?.service_id ?? serviceName(service));
  if (cabinet) {
    setSelectValueByIdOrValue(form.elements.cabinet, cabinet?.id ?? cabinet?.cabinet_id ?? cabinet?.name);
  } else {
    form.elements.cabinet.value = "";
  }
  syncAppointmentCabinetFromDoctor();
  form.elements.date.value = registrationDraft.date;
  form.elements.note.value = [registrationDraft.reason, registrationDraft.note].map((value) => String(value || "").trim()).filter(Boolean).join("\n\n");
  setAppointmentTimeValue(registrationDraft.time);
  return true;
}

async function saveRegistrationAppointment(view) {
  if (!validateCurrentRegistrationStep(view)) return;
  const status = view.querySelector("[data-registration-status]");
  setStatus(status, "Zapisywanie wizyty...");
  const patient = await ensureRegistrationPatient();
  if (!patient) {
    setStatus(status, "Nie udało się przygotować pacjenta.", "error");
    return;
  }
  if (!isRegistrationPatientAvailable(patient)) {
    setStatus(status, "Pacjent ma już wizytę w wybranym terminie.", "error");
    return;
  }
  if (!fillAppointmentModalFromRegistration(patient)) {
    setStatus(status, lastAppointmentSubmitError || "Brak formularza wizyty.", "error");
    return;
  }
  const beforeCount = appointments.length;
  await submitAppointmentRegistration({ preventDefault() {} }, { showSuccess: false });
  const savedAppointment = appointments.find((appointment) => {
    return String(appointment.patient_id ?? appointment.patientId) === String(patient.id ?? patient.patient_id)
      && String(appointment.doctor_id ?? appointment.doctorId) === String(registrationDraft.doctorId)
      && toLocalDateKey(getAppointmentDateIso(appointment, parseLocalDate(registrationDraft.date)) || appointment.date || appointment.appointment_date) === registrationDraft.date
      && formatTime(appointment.start_time || appointment.time) === registrationDraft.time;
  });
  const saved = appointments.length > beforeCount || Boolean(savedAppointment);
  if (!saved) {
    setStatus(status, lastAppointmentSubmitError || "Nie udało się zapisać wizyty. Sprawdź dostępność terminu.", "error");
    return;
  }
  showAppointmentSuccessModal(savedAppointment || buildAppointmentFromForm());
  resetRegistrationDraft();
}

function showRegistrationSuccess(patient) {
  const appointment = buildAppointmentFromForm({
    patient_id: patient?.id || patient?.patient_id,
    doctor_id: registrationDraft.doctorId,
    service_id: registrationDraft.serviceId,
    date: registrationDraft.date,
    start_time: registrationDraft.time,
  });
  showAppointmentSuccessModal(appointment);
}

function showAppointmentSuccessModal(appointment) {
  if (!appointment) return;
  const patient = findPatientForAppointment(appointment) || findPatientById(appointment.patient_id || appointment.patientId);
  const doctor = findDoctorByAppointment(appointment) || findDoctorByIdOrValue(appointment.doctor_id || appointment.doctorId || appointment.doctor);
  const service = findServiceByIdOrValue(appointment.service_id || appointment.serviceId || appointment.serviceName || appointment.specialization);
  const cabinet = findCabinetByBackendId(appointment.cabinet_id || appointment.cabinetId)
    || findCabinetByIdOrValue(appointment.cabinet);
  const appointmentDate = historyAppointmentDateIso(appointment) || appointment.date || appointment.appointment_date || selectedDate;
  const appointmentTime = formatTime(appointment.start_time || appointment.time || appointment.startTime);
  const patientName = patientFullName(patient) || appointment.patient || appointment.patient_name || "Pacjent";
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop active registration-success-backdrop";
  backdrop.innerHTML = `
    <div class="modal registration-success-modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="registration-success-title">
          <span class="registration-success-icon">✓</span>
          <div>
            <h2>Wizyta została zapisana</h2>
            <p>Termin dodano do kalendarza kliniki.</p>
          </div>
        </div>
      </div>
      <div class="registration-success-body">
        ${renderRegistrationConfirmItem("Pacjent", patientName, patient?.phone || appointment.phone || "")}
        ${renderRegistrationConfirmItem("Lekarz", doctorFullName(doctor), doctor?.specialization || "")}
        ${renderRegistrationConfirmItem("Usługa", serviceName(service), "")}
        ${renderRegistrationConfirmItem("Gabinet", cabinet?.name || appointment.cabinet || doctor?.cabinet || "Brak danych", "")}
        ${renderRegistrationConfirmItem("Data", appointmentDate ? formatDate(parseLocalDate(appointmentDate)) : "Brak danych", appointmentTime)}
      </div>
      <div class="modal-footer">
        <button class="secondary-button" type="button" data-registration-success-new>Nowa rejestracja</button>
        <button class="primary-button" type="button" data-registration-success-calendar>Przejdź do kalendarza</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  const close = () => {
    backdrop.remove();
    resetRegistrationDraft();
    showView("registration");
  };
  backdrop.querySelector("[data-registration-success-new]")?.addEventListener("click", close);
  backdrop.querySelector("[data-registration-success-calendar]")?.addEventListener("click", () => {
    backdrop.remove();
    selectedDate = appointmentDate;
    calendarViewMode = "day";
    showView("calendar");
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
}

function renderSidebarNavigation() {
  if (!elements.sidebarNav) return;

  const items = getRoleNavigationItems();
  const navIcons = {
    dashboard: "dashboard",
    calendar: "calendar",
    registration: "registration",
    patients: "patients",
    doctors: "doctors",
    rooms: "rooms",
    services: "services",
    history: "history",
    users: "users",
    settings: "settings",
  };

  elements.sidebarNav.replaceChildren(
    ...items.map(([view, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `nav-item${activeView === view ? " active" : ""}`;
      button.innerHTML = `<span class="nav-icon">${uiIcon(navIcons[view] || "dashboard")}</span><span>${escapeHtml(label)}</span>`;
      button.addEventListener("click", () => showView(view));
      return button;
    })
  );
}

function showView(view) {
  if (!confirmDoctorEditNavigation()) return;
  if (!confirmPatientCardNavigation()) return;
  activeView = resolveRoleView(view);
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  const viewConfig = viewRegistry[activeView] || viewRegistry.dashboard;
  const target = document.querySelector(`#${viewConfig.sectionId}`);
  target?.classList.add("active");

  if (elements.topbarTitle) {
    elements.topbarTitle.textContent = target?.dataset.title || viewConfig.title || "Dashboard";
  }

  renderSidebarNavigation();
  renderActiveView(activeView);
}

async function enterAuthenticatedApp(user) {
  updateCurrentUser(user);
  elements.loginScreen?.classList.add("is-hidden");
  elements.appShell?.classList.remove("is-hidden");
  restoreSidebarCollapsedState();

  if (!appEventsBound) {
    bindEvents();
    appEventsBound = true;
  }

  activeView = resolveRoleView(activeView);
  renderSidebarNavigation();
  await loadBackendReferenceData();
  updateCurrentUser(currentUser);
  showView(activeView);
  startDataPolling();
  startNotificationPolling();
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const login = elements.loginForm?.querySelector('[name="login"]')?.value.trim();
  const password = elements.loginForm?.querySelector('[name="password"]')?.value;

  if (!login || !password) {
    if (elements.loginStatus) elements.loginStatus.textContent = "Podaj login i hasło.";
    return;
  }

  if (elements.loginStatus) elements.loginStatus.textContent = "Logowanie...";

  try {
    const response = await apiRequest("backend/api/auth.php?action=login", {
      method: "POST",
      body: { login, password },
    });
    const user = response.user || response.data?.user || response.data;

    if (!user) {
      throw new Error("Backend nie zwrócił danych użytkownika.");
    }

    if (elements.loginStatus) elements.loginStatus.textContent = "";
    await enterAuthenticatedApp(user);
  } catch (error) {
    if (elements.loginStatus) {
      elements.loginStatus.textContent = error.message || "Nieprawidłowy login lub hasło.";
    }
  }
}

async function restoreAuthSession() {
  try {
    const response = await apiRequest("backend/api/auth.php?action=me");
    const user = response.user || response.data?.user || response.data;

    if (user) {
      await enterAuthenticatedApp(user);
      return;
    }
  } catch {
    // No active session: show clean login screen.
  }

  showLoginScreen("");
}

async function logout() {
  if (!confirmDoctorEditNavigation()) return;
  if (!confirmPatientCardNavigation()) return;
  stopDataPolling();
  if (typeof stopAppointmentPolling === "function") stopAppointmentPolling();
  if (typeof stopDoctorPolling === "function") stopDoctorPolling();
  if (typeof stopNotificationPolling === "function") stopNotificationPolling();

  try {
    await apiRequest("backend/api/auth.php?action=logout", { method: "POST" });
  } catch {
    // Logout should still clear frontend state even if the backend request fails.
  }

  currentUser = normalizeAuthUser(null);
  showLoginScreen("");
}

function bindAuthEvents() {
  elements.loginForm?.addEventListener("submit", handleLoginSubmit);
  elements.logoutButton?.addEventListener("click", logout);
}

function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["0", "false", "inactive", "nieaktywny", "anulowana"].includes(normalized)) return false;
  if (["1", "true", "active", "aktywny"].includes(normalized)) return true;
  return fallback;
}

function normalizeScheduleValue(schedule) {
  if (!schedule) return null;
  if (typeof schedule === "object") return schedule;
  try {
    const parsed = JSON.parse(schedule);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizePatient(patient) {
  if (!patient || typeof patient !== "object") {
    return null;
  }

  const id = patient.id ?? patient.patient_id ?? patient.patientId ?? `patient-${Date.now()}`;
  const firstName = String(patient.firstName ?? patient.first_name ?? patient.patient_first_name ?? "").trim();
  const lastName = String(patient.lastName ?? patient.last_name ?? patient.patient_last_name ?? "").trim();
  const name = String(patient.name ?? patient.patient ?? `${firstName} ${lastName}`.trim()).trim();

  if (!firstName && !lastName && !name) {
    return null;
  }

  return {
    id: String(id),
    patient_id: patient.patient_id ?? id,
    firstName: firstName || name.split(/\s+/)[0] || "",
    lastName: lastName || name.split(/\s+/).slice(1).join(" "),
    name,
    pesel: String(patient.pesel || "").trim(),
    birthDate: patient.birthDate || patient.birth_date || "",
    gender: normalizePatientGenderDisplay(patient.gender || ""),
    phone: String(patient.phone || patient.patient_phone || "").trim(),
    email: String(patient.email || patient.patient_email || "").trim(),
    address: patient.address || "",
    postalCode: patient.postalCode || patient.postal_code || "",
    city: patient.city || "",
    documentNumber: patient.documentNumber || patient.document_number || "",
    insurer: patient.insurer || patient.insurance || "",
    insuranceNumber: patient.insuranceNumber || patient.insurance_number || "",
    bloodGroup: patient.bloodGroup || patient.blood_group || "",
    allergies: patient.allergies || "",
    chronicDiseases: patient.chronicDiseases || patient.chronic_diseases || "",
    notes: patient.notes || "",
    profile_status: patient.profile_status || patient.profileStatus || patient.status || "",
    profileStatus: patient.profileStatus || patient.profile_status || patient.status || "",
    status: patient.profile_status || patient.status || "",
    is_active: normalizeBoolean(patient.is_active, true) ? 1 : 0,
    isActive: normalizeBoolean(patient.is_active, true),
    createdAt: String(patient.createdAt || patient.created_at || new Date().toISOString()),
    updatedAt: patient.updatedAt || patient.updated_at || "",
  };
}

function normalizePatientGenderDisplay(value) {
  const gender = String(value || "").trim().toLowerCase();
  if (gender === "female" || gender === "kobieta") return "Kobieta";
  if (gender === "male" || gender === "mężczyzna" || gender === "mezczyzna") return "Mężczyzna";
  if (gender === "other" || gender === "inna" || gender === "inny") return "Inna";
  return String(value || "").trim();
}

function patientGenderToBackend(value) {
  const gender = String(value || "").trim().toLowerCase();
  if (gender === "kobieta" || gender === "female") return "female";
  if (gender === "mężczyzna" || gender === "mezczyzna" || gender === "male") return "male";
  if (gender === "inna" || gender === "inny" || gender === "other") return "other";
  return null;
}

function normalizeAppointment(appointment) {
  if (!appointment || typeof appointment !== "object") {
    return null;
  }

  const patientName = String(
    appointment.patient ||
      appointment.patient_name ||
      `${appointment.patient_first_name || ""} ${appointment.patient_last_name || ""}`.trim() ||
      "Pacjent"
  ).trim();
  const doctorName = String(
    appointment.doctor ||
      appointment.doctor_name ||
      `${appointment.doctor_first_name || ""} ${appointment.doctor_last_name || ""}`.trim()
  ).trim();
  const serviceLabel = String(
    appointment.specialization ||
      appointment.specialization_name ||
      appointment.service_name ||
      appointment.service ||
      ""
  ).trim();
  const startTime = String(appointment.time || appointment.start_time || appointment.startTime || "").slice(0, 5);
  const date = String(appointment.date || appointment.appointment_date || appointment.appointmentDate || "").slice(0, 10);

  const normalized = {
    id: String(appointment.id || appointment.appointment_id || `appointment-${Date.now()}`),
    appointment_id: appointment.appointment_id ?? appointment.id ?? null,
    patient_id: appointment.patient_id ?? appointment.patientId ?? null,
    doctor_id: appointment.doctor_id ?? appointment.doctorId ?? null,
    service_id: appointment.service_id ?? appointment.serviceId ?? null,
    cabinet_id: appointment.cabinet_id ?? appointment.cabinetId ?? null,
    patient: patientName,
    phone: String(appointment.phone || appointment.patient_phone || "").trim(),
    email: String(appointment.email || appointment.patient_email || "").trim(),
    doctor: doctorName.toLowerCase().startsWith("dr ") || !doctorName ? doctorName : `dr ${doctorName}`,
    specialization: serviceLabel,
    serviceName: String(appointment.service_name || appointment.service || serviceLabel).trim(),
    cabinet: String(appointment.cabinet || appointment.cabinet_name || "").trim(),
    time: startTime,
    start_time: appointment.start_time || startTime,
    end_time: appointment.end_time || appointment.endTime || "",
    date,
    appointment_date: date,
    status: appointment.status || "planned",
    notes: String(appointment.notes || appointment.note || "").trim(),
    day: Number.isInteger(appointment.day) ? appointment.day : null,
  };

  if (!normalized.time) {
    return null;
  }

  if (!normalized.date && (normalized.day === null || normalized.day < 0 || normalized.day > 6)) {
    return null;
  }

  return normalized;
}

function normalizeDoctor(doctor) {
  if (!doctor || typeof doctor !== "object") {
    return null;
  }

  const firstName = String(doctor.firstName ?? doctor.first_name ?? "").trim();
  const lastName = String(doctor.lastName ?? doctor.last_name ?? "").trim();
  const rawName = String(doctor.fullName || doctor.full_name || doctor.name || `${firstName} ${lastName}`.trim()).trim();

  if (!rawName) {
    return null;
  }

  const fullName = rawName.toLowerCase().startsWith("dr ") ? rawName : `dr ${rawName}`;
  const nameParts = rawName.replace(/^dr\s+/i, "").split(/\s+/).filter(Boolean);

  return {
    id: doctor.id || doctor.doctor_id ? String(doctor.id ?? doctor.doctor_id) : fullName,
    doctor_id: doctor.doctor_id ?? doctor.id ?? null,
    firstName: firstName || nameParts[0] || "",
    lastName: lastName || nameParts.slice(1).join(" "),
    fullName,
    name: fullName,
    specialization: String(doctor.specialization || doctor.specialization_name || "").trim(),
    cabinet: String(doctor.cabinet || doctor.cabinet_name || "").trim(),
    cabinet_id: doctor.cabinet_id ?? doctor.cabinetId ?? null,
    cabinetId: doctor.cabinet_id ?? doctor.cabinetId ?? null,
    cabinetName: String(doctor.cabinet_name || doctor.cabinet || "").trim(),
    cabinet_type: String(doctor.cabinet_type || doctor.type || "").trim(),
    cabinet_room_number: doctor.cabinet_room_number ?? doctor.room_number ?? null,
    phone: String(doctor.phone || "").trim(),
    email: String(doctor.email || "").trim(),
    status: doctor.status || (normalizeBoolean(doctor.is_active, true) ? "Aktywny" : "Nieaktywny"),
    isActive: normalizeBoolean(doctor.is_active, true),
    avatarDataUrl: doctor.avatarDataUrl || doctor.avatar_data_url || "",
    schedule: normalizeScheduleValue(doctor.schedule || doctor.schedule_json),
  };
}

function normalizeService(service) {
  if (!service || typeof service !== "object") {
    return null;
  }

  const name = String(service.name || service.service_name || "").trim();
  const specialization = getServiceSpecializationValue(service);

  if (!name && !specialization) {
    return null;
  }

  return {
    id: service.id || service.service_id ? String(service.id ?? service.service_id) : name || specialization,
    service_id: service.service_id ?? service.id ?? null,
    name,
    specialization,
    durationMinutes: Number(service.durationMinutes || service.duration_minutes || service.duration || 0) || 30,
    duration: Number(service.duration || service.duration_minutes || service.durationMinutes || 0) || 30,
    price: service.price !== undefined ? String(service.price) : "",
    description: service.description || "",
    status: service.status || (normalizeBoolean(service.is_active, true) ? "active" : "inactive"),
    isActive: normalizeBoolean(service.is_active, true),
  };
}

function normalizeCabinet(cabinet) {
  if (!cabinet || typeof cabinet !== "object") {
    return null;
  }

  const name = String(cabinet.name || cabinet.cabinet || cabinet.cabinet_name || "").trim();
  if (!name) return null;
  const explicitNumber = cabinet.room_number ?? cabinet.number ?? cabinet.cabinet_number ?? "";
  const number = String(explicitNumber || "").trim() || name.replace(/[^\d]/g, "");
  const type = normalizeCabinetType(getCabinetTypeSource(cabinet));

  return {
    id: cabinet.id || cabinet.cabinet_id ? String(cabinet.id ?? cabinet.cabinet_id) : name,
    cabinet_id: cabinet.cabinet_id ?? cabinet.id ?? null,
    name,
    number,
    room_number: number,
    floor: cabinet.floor || "",
    type,
    cabinet_type: type,
    description: cabinet.description || "",
    availability: cabinet.availability || cabinet.accessibility || "Dostępny",
    equipment: cabinet.equipment || "",
    assignedDoctors: cabinet.assignedDoctors || cabinet.assigned_doctors || "",
    status: cabinet.status || (normalizeBoolean(cabinet.is_active, true) ? "active" : "inactive"),
    isActive: normalizeBoolean(cabinet.is_active, true),
  };
}

function normalizeUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  const role = authRoleKey(user.role || user.role_name);
  const firstName = String(user.firstName ?? user.first_name ?? "").trim();
  const lastName = String(user.lastName ?? user.last_name ?? "").trim();
  const name = String(user.name || `${firstName} ${lastName}`.trim() || user.login || user.username || "").trim();

  if (!name && !user.id) return null;

  return {
    id: user.id ? String(user.id) : name,
    firstName,
    lastName,
    name,
    login: user.login || user.username || "",
    email: user.email || "",
    role,
    displayRole: getRoleBranch(role).label,
    doctor_id: user.doctor_id ?? user.doctorId ?? null,
    status: user.status || (normalizeBoolean(user.is_active, true) ? "active" : "inactive"),
    isActive: normalizeBoolean(user.is_active, true),
    must_change_password: Boolean(user.must_change_password),
    lastLogin: user.last_login || user.last_login_at || "",
    createdAt: user.createdAt || user.created_at || "",
  };
}

function isNumericId(value) {
  return /^\d+$/.test(String(value || ""));
}

// ==============================
// Date helpers
// ==============================
function localToday() {
  return toLocalDateKey(new Date());
}

function toLocalDateKey(date = new Date()) {
  let value;

  if (date instanceof Date) {
    value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  } else {
    const text = String(date || "").trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    value = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(date || new Date());
  }

  if (Number.isNaN(value.getTime())) {
    const now = new Date();
    value = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateToIso(date) {
  return toLocalDateKey(date);
}

function today() {
  return localToday();
}

function safeFmt(date, options = { day: "2-digit", month: "2-digit", year: "numeric" }) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("pl-PL", options).format(value);
}

function formatTime(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const match = text.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : text;
}

function combineLocalDateTime(date, time) {
  const isoDate = String(date || today()).slice(0, 10);
  const safeTime = formatTime(time || "00:00") || "00:00";
  const result = new Date(`${isoDate}T${safeTime}:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}

function appointmentStartDateTime(appointment) {
  if (!appointment) return null;
  return combineLocalDateTime(appointment.date || appointment.appointment_date, appointment.time || appointment.start_time);
}

function appointmentEndDateTime(appointment) {
  if (!appointment) return null;
  const explicitEnd = appointment.end_time || appointment.endTime;
  if (explicitEnd) {
    return combineLocalDateTime(appointment.date || appointment.appointment_date, explicitEnd);
  }

  const start = appointmentStartDateTime(appointment);
  if (!start) return null;
  const service = services.find((item) => String(item.id) === String(appointment.service_id));
  const duration = Number(appointment.duration || appointment.durationMinutes || service?.durationMinutes || 30);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + (duration || 30));
  return end;
}

function getResolvedAppointmentStatus(appointment) {
  const raw = String(appointment?.status || "").trim().toLowerCase();
  if (["cancelled", "canceled", "anulowana"].includes(raw)) return "Anulowana";
  if (["no_show", "no-show", "nieobecny", "nieobecny pacjent"].includes(raw)) return "Nieobecny pacjent";

  const start = appointmentStartDateTime(appointment);
  const end = appointmentEndDateTime(appointment);
  const now = new Date();

  if (!start || !end) return "Zaplanowana";
  if (now < start) return "Zaplanowana";
  if (now >= start && now <= end) return "W trakcie";
  return "Zrealizowana";
}

function appointmentStatusBadge(appointment) {
  const label = getResolvedAppointmentStatus(appointment);
  const classKey = label
    .toLowerCase()
    .replace(/ą/g, "a")
    .replace(/ć/g, "c")
    .replace(/ę/g, "e")
    .replace(/ł/g, "l")
    .replace(/ń/g, "n")
    .replace(/ó/g, "o")
    .replace(/ś/g, "s")
    .replace(/ź/g, "z")
    .replace(/ż/g, "z")
    .replace(/\s+/g, "-");
  return `<span class="status-badge status-${classKey}">${escapeHtml(label)}</span>`;
}

function isAppointmentCancelled(appointment) {
  return getResolvedAppointmentStatus(appointment) === "Anulowana";
}

function canCancelAppointment(appointment) {
  return !["Anulowana", "Zrealizowana", "Nieobecny pacjent"].includes(getResolvedAppointmentStatus(appointment));
}

function getMonday(date) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  current.setDate(diff);
  current.setHours(0, 0, 0, 0);
  return current;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toDateInputValue(date) {
  return dateToIso(date);
}

function getDisplayedMonday() {
  return getMonday(parseLocalDate(selectedDate));
}

function formatDate(date) {
  return safeFmt(date, { day: "numeric", month: "short" });
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}

function formatFullDate(date) {
  return safeFmt(date, { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getWeekOffsetForDate(date) {
  const currentMonday = getMonday(parseLocalDate(localToday()));
  const targetMonday = getMonday(date);
  return Math.round((targetMonday.getTime() - currentMonday.getTime()) / 604800000);
}

// ==============================
// Doctor/common entity helpers
// ==============================
function doctorFullName(doctor) {
  if (!doctor) return "";
  const name = String(
    doctor.fullName ||
      doctor.full_name ||
      doctor.name ||
      `${doctor.firstName || doctor.first_name || ""} ${doctor.lastName || doctor.last_name || ""}`.trim()
  ).trim();
  return name && !name.toLowerCase().startsWith("dr ") ? `dr ${name}` : name;
}

function patientFullName(patient) {
  if (!patient) return "";
  return String(
    patient.name ||
      patient.patient ||
      `${patient.firstName || patient.first_name || ""} ${patient.lastName || patient.last_name || ""}`.trim()
  ).trim();
}

const PATIENT_BLOOD_GROUP_OPTIONS = [
  ["", "Brak danych"],
  ["A Rh+", "A Rh+ (grupa A dodatnia)"],
  ["A Rh−", "A Rh− (grupa A ujemna)"],
  ["B Rh+", "B Rh+ (grupa B dodatnia)"],
  ["B Rh−", "B Rh− (grupa B ujemna)"],
  ["AB Rh+", "AB Rh+ (grupa AB dodatnia)"],
  ["AB Rh−", "AB Rh− (grupa AB ujemna)"],
  ["0 Rh+", "0 Rh+ (grupa 0 dodatnia)"],
  ["0 Rh−", "0 Rh− (grupa 0 ujemna)"],
];

function normalizePatientBloodGroup(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.toLowerCase() === "unknown") return "";
  const asciiMinus = normalized.replace(/-/g, "−");
  const exact = PATIENT_BLOOD_GROUP_OPTIONS.find(([optionValue]) => optionValue === asciiMinus);
  return exact ? exact[0] : "";
}

function renderPatientBloodGroupSelect(selectedValue = "") {
  const selected = normalizePatientBloodGroup(selectedValue);
  return `
    <select name="bloodGroup">
      ${PATIENT_BLOOD_GROUP_OPTIONS.map(([value, label]) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
    </select>
  `;
}

function serviceName(service) {
  if (!service) return "";
  return String(service.name || service.service_name || service.specialization || service.specialization_name || "").trim();
}

function appointmentServiceDisplayName(appointment) {
  if (!appointment) return "Brak usługi";
  const linkedService = findServiceByIdOrValue(appointment.service_id ?? appointment.serviceId);
  const linkedName = serviceName(linkedService);
  const linkedSpecialization = String(linkedService?.specialization || linkedService?.specialization_name || "").trim();
  const directName = [
    appointment.serviceName,
    appointment.service_name,
    appointment.service,
  ].map((value) => String(value || "").trim()).find(Boolean) || "";
  const specialization = String(appointment.specialization || appointment.specialization_name || "").trim();

  if (linkedName && (!directName || directName === specialization || directName === linkedSpecialization)) {
    return linkedName;
  }

  return directName || linkedName || specialization || "Brak usługi";
}

function getCurrentDoctorId() {
  const directId = currentUser?.doctor_id ?? currentUser?.doctorId;
  if (directId) return String(directId);
  const profile = currentUserDoctorProfile();
  return profile?.doctor_id || profile?.id || null;
}

function isAppointmentForDoctor(appointment, doctorId) {
  if (!appointment || !doctorId) return false;
  const appointmentDoctorId = appointment.doctor_id ?? appointment.doctorId;
  if (appointmentDoctorId) return String(appointmentDoctorId) === String(doctorId);

  const doctor = doctors.find((item) => String(item.id) === String(doctorId) || String(item.doctor_id) === String(doctorId));
  const expectedName = doctorFullName(doctor).toLowerCase();
  return Boolean(expectedName && String(appointment.doctor || "").trim().toLowerCase() === expectedName);
}

function currentUserDoctorProfile() {
  const doctorId = currentUser?.doctor_id ?? currentUser?.doctorId;
  if (doctorId) {
    const byId = doctors.find((doctor) => String(doctor.doctor_id ?? doctor.id) === String(doctorId));
    if (byId) return byId;
  }

  const userName = String(currentUser?.name || "").trim().toLowerCase();
  if (!userName) return null;
  return doctors.find((doctor) => doctorFullName(doctor).toLowerCase().replace(/^dr\s+/, "") === userName.replace(/^dr\s+/, "")) || null;
}

function renderDoctorAvatar(doctor, options = {}) {
  const size = Number(options.size || 40);
  const name = doctorFullName(doctor) || "Lekarz";
  const avatarDataUrl = doctor?.avatarDataUrl || doctor?.avatar_data_url || "";
  const initials = name
    .replace(/^dr\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "L";
  const style = `width:${size}px;height:${size}px;`;

  if (avatarDataUrl && String(avatarDataUrl).startsWith("data:image/")) {
    return `<img class="doctor-avatar" src="${escapeHtml(avatarDataUrl)}" alt="${escapeHtml(name)}" style="${style}">`;
  }

  return `<span class="doctor-avatar doctor-avatar-initials" aria-label="${escapeHtml(name)}" style="${style}">${escapeHtml(initials)}</span>`;
}

// Polish phone inputs keep the +48 prefix visible and submit a formatted string.
const POLISH_PHONE_PREFIX = "+48 ";
const DOCTOR_EMAIL_DOMAIN = "@mediplus.pl";
const USER_EMAIL_DOMAIN = "@mediplus.local";
const PHONE_INPUT_SELECTOR = [
  'input[type="tel"]',
  'input[id*="phone" i]',
  'input[name*="phone" i]',
  'input[id*="telefon" i]',
  'input[name*="telefon" i]',
  'input[placeholder*="Telefon" i]',
  'input[placeholder*="telefon" i]',
].join(",");
const PESEL_INPUT_SELECTOR = [
  'input[id*="pesel" i]',
  'input[name*="pesel" i]',
].join(",");

function extractPolishPhoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("48")) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 9);
}

function formatPolishPhone(value) {
  const digits = extractPolishPhoneDigits(value);

  if (!digits) return POLISH_PHONE_PREFIX;
  if (digits.length <= 3) return `${POLISH_PHONE_PREFIX}${digits}`;
  if (digits.length <= 6) return `${POLISH_PHONE_PREFIX}${digits.slice(0, 3)} ${digits.slice(3)}`;

  return `${POLISH_PHONE_PREFIX}${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function isPolishPhoneInput(input) {
  if (!input || input.tagName !== "INPUT") return false;
  const type = String(input.type || "text").toLowerCase();
  if (["hidden", "checkbox", "radio", "date", "time", "number", "search"].includes(type)) return false;
  if (input.matches?.(PHONE_INPUT_SELECTOR)) return true;

  const marker = [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute("aria-label"),
    input.getAttribute("autocomplete"),
  ].join(" ").toLowerCase();

  return marker.includes("phone") || marker.includes("telefon") || /\btel\b/.test(marker);
}

function applyPolishPhoneFormat(input, { forcePrefix = true } = {}) {
  if (!isPolishPhoneInput(input)) return;
  const digits = extractPolishPhoneDigits(input.value);
  input.value = digits || forcePrefix ? formatPolishPhone(input.value) : "";
  requestAnimationFrame(() => {
    const end = input.value.length;
    input.setSelectionRange?.(end, end);
  });
}

function bindPolishPhoneInputs(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  const candidates = new Set([
    ...scope.querySelectorAll(PHONE_INPUT_SELECTOR),
    ...scope.querySelectorAll("input"),
  ]);
  let boundCount = 0;

  candidates.forEach((input) => {
    if (!isPolishPhoneInput(input) || input.dataset.phoneMaskBound === "1") return;

    input.dataset.phoneMaskBound = "1";
    input.dataset.polishPhoneBound = "true";
    input.inputMode = "numeric";
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("autocomplete", "tel");
    boundCount += 1;

    if (input.value.trim()) {
      applyPolishPhoneFormat(input);
    }

    input.addEventListener("focus", () => applyPolishPhoneFormat(input));
    input.addEventListener("click", () => {
      if ((input.selectionStart || 0) < POLISH_PHONE_PREFIX.length) {
        input.setSelectionRange?.(input.value.length, input.value.length);
      }
    });
    input.addEventListener("beforeinput", (event) => {
      if (event.inputType?.startsWith("delete")) return;
      if (event.inputType === "insertFromPaste") return;
      if (event.data && /\D/.test(event.data)) {
        event.preventDefault();
      }
    });
    input.addEventListener("keydown", (event) => {
      const start = input.selectionStart || 0;
      if ((event.key === "Backspace" || event.key === "Delete") && start <= POLISH_PHONE_PREFIX.length) {
        event.preventDefault();
        input.setSelectionRange?.(input.value.length, input.value.length);
      }
      if (event.key.length === 1 && !/\d/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
      }
    });
    input.addEventListener("input", () => applyPolishPhoneFormat(input));
    input.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text") || "";
      event.preventDefault();
      input.value = text;
      setTimeout(() => applyPolishPhoneFormat(input), 0);
    });
    input.addEventListener("blur", () => applyPolishPhoneFormat(input));
  });

  if (boundCount) {
    console.info("[phone-mask] bound", boundCount);
  }
  bindPeselInputs(scope);
}

function formatPolishPhoneFields(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll("input").forEach((input) => {
    if (isPolishPhoneInput(input)) applyPolishPhoneFormat(input);
  });
  formatPeselFields(scope);
}

function normalizeDoctorEmailLocal(value, { final = false } = {}) {
  let local = String(value || "").trim();
  const atIndex = local.indexOf("@");
  if (atIndex >= 0) local = local.slice(0, atIndex);
  local = local
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/g, "");
  if (final) local = local.replace(/\.+$/g, "");
  return local;
}

function formatDoctorEmail(value, { final = false } = {}) {
  const local = normalizeDoctorEmailLocal(value, { final });
  return local;
}

function getDoctorEmailSubmitValue(input) {
  const local = normalizeDoctorEmailLocal(input?.value || "", { final: true });
  return local ? `${local}${DOCTOR_EMAIL_DOMAIN}` : "";
}

function applyDoctorEmailFormat(input, { final = false } = {}) {
  if (!input) return;
  input.value = formatDoctorEmail(input.value, { final });
}

function bindDoctorEmailInputs(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll("[data-doctor-email]").forEach((input) => {
    if (input.dataset.doctorEmailBound === "1") return;
    input.dataset.doctorEmailBound = "1";
    input.type = "text";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("inputmode", "email");
    applyDoctorEmailFormat(input);

    input.addEventListener("focus", () => applyDoctorEmailFormat(input));
    input.addEventListener("keydown", (event) => {
      const isShortcut = event.ctrlKey || event.metaKey || event.altKey;
      const allowedControlKeys = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"];
      if (allowedControlKeys.includes(event.key)) return;
      if (isShortcut) return;
      if (event.key.length === 1 && !/^[a-zA-Z0-9.]$/.test(event.key)) {
        event.preventDefault();
      }
    });
    input.addEventListener("beforeinput", (event) => {
      if (event.inputType === "insertFromPaste") return;
      if (event.data && !/^[a-zA-Z0-9.]+$/.test(event.data)) event.preventDefault();
    });
    input.addEventListener("input", () => applyDoctorEmailFormat(input));
    input.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text") || "";
      event.preventDefault();
      input.value = text;
      applyDoctorEmailFormat(input);
    });
    input.addEventListener("blur", () => applyDoctorEmailFormat(input, { final: true }));
  });
}

function formatUserEmail(value, { final = false } = {}) {
  return normalizeDoctorEmailLocal(value, { final });
}

function getUserEmailSubmitValue(input) {
  const local = normalizeDoctorEmailLocal(input?.value || "", { final: true });
  return local ? `${local}${USER_EMAIL_DOMAIN}` : "";
}

function applyUserEmailFormat(input, { final = false } = {}) {
  if (!input) return;
  input.value = formatUserEmail(input.value, { final });
}

function bindUserEmailInputs(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll("[data-user-email]").forEach((input) => {
    if (input.dataset.userEmailBound === "1") return;
    input.dataset.userEmailBound = "1";
    input.type = "text";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("inputmode", "email");
    applyUserEmailFormat(input);

    input.addEventListener("focus", () => applyUserEmailFormat(input));
    input.addEventListener("keydown", (event) => {
      const isShortcut = event.ctrlKey || event.metaKey || event.altKey;
      const allowedControlKeys = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"];
      if (allowedControlKeys.includes(event.key) || isShortcut) return;
      if (event.key.length === 1 && !/^[a-zA-Z0-9.]$/.test(event.key)) event.preventDefault();
    });
    input.addEventListener("beforeinput", (event) => {
      if (event.inputType === "insertFromPaste") return;
      if (event.data && !/^[a-zA-Z0-9.]+$/.test(event.data)) event.preventDefault();
    });
    input.addEventListener("input", () => applyUserEmailFormat(input));
    input.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text") || "";
      event.preventDefault();
      input.value = text;
      applyUserEmailFormat(input);
    });
    input.addEventListener("blur", () => applyUserEmailFormat(input, { final: true }));
  });
}

function extractPeselDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 11);
}

function isPeselInput(input) {
  if (!(input instanceof HTMLInputElement)) return false;
  const type = String(input.type || "text").toLowerCase();
  if (["hidden", "checkbox", "radio", "date", "time", "search"].includes(type)) return false;
  const id = String(input.id || "").toLowerCase();
  const name = String(input.name || "").toLowerCase();
  return id.includes("pesel") || name.includes("pesel");
}

function applyPeselFormat(input) {
  if (!isPeselInput(input)) return;
  input.value = extractPeselDigits(input.value);
}

function bindPeselInputs(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll(PESEL_INPUT_SELECTOR).forEach((input) => {
    if (!isPeselInput(input) || input.dataset.peselMaskBound === "1") return;
    input.dataset.peselMaskBound = "1";
    input.inputMode = "numeric";
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("maxlength", "11");
    input.setAttribute("autocomplete", "off");
    applyPeselFormat(input);

    input.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const allowedKeys = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"];
      if (allowedKeys.includes(event.key)) return;
      if (!/^\d$/.test(event.key)) event.preventDefault();
    });
    input.addEventListener("input", () => applyPeselFormat(input));
    input.addEventListener("paste", () => setTimeout(() => applyPeselFormat(input), 0));
    input.addEventListener("blur", () => applyPeselFormat(input));
  });
}

function formatPeselFields(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll(PESEL_INPUT_SELECTOR).forEach((input) => applyPeselFormat(input));
}
// ==============================
// Validation
// ==============================
function clearFieldErrors(form) {
  if (!form) {
    return;
  }

  form.querySelectorAll(".field-error").forEach((error) => error.remove());
  form.querySelectorAll(".has-error").forEach((field) => {
    field.classList.remove("has-error");
    field.removeAttribute("aria-invalid");
  });
}

function setFieldError(field, message) {
  if (!field) {
    return;
  }

  const label = field.closest("label");
  const error = document.createElement("p");
  error.className = "field-error";
  error.textContent = message;

  field.classList.add("has-error");
  field.setAttribute("aria-invalid", "true");

  if (label) {
    label.appendChild(error);
  }
}

function validatePatientForm() {
  const form = elements.patientForm;
  clearFieldErrors(form);

  if (!form) {
    return false;
  }

  setStatus(elements.formStatus, "");

  const fields = {
    firstName: form.elements.firstName,
    lastName: form.elements.lastName,
    pesel: form.elements.pesel,
    phone: form.elements.phone,
    email: form.elements.email,
  };

  const requiredMessages = {
    firstName: "Podaj imię pacjenta.",
    lastName: "Podaj nazwisko pacjenta.",
    pesel: "Podaj numer PESEL.",
    phone: "Podaj numer telefonu.",
    email: "Podaj adres e-mail.",
  };

  let isValid = true;

  Object.entries(fields).forEach(([name, field]) => {
    if (!field || !field.value.trim()) {
      setFieldError(field, requiredMessages[name]);
      isValid = false;
    }
  });

  if (fields.pesel?.value.trim() && !/^\d{11}$/.test(fields.pesel.value.trim())) {
    setFieldError(fields.pesel, "PESEL musi zawierać dokładnie 11 cyfr.");
    isValid = false;
  }

  if (fields.email?.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value.trim())) {
    setFieldError(fields.email, "Podaj poprawny adres e-mail.");
    isValid = false;
  }

  return isValid;
}

function validateRequiredModalFields(form, statusElement) {
  clearFieldErrors(form);
  setStatus(statusElement, "");

  if (!form) {
    return false;
  }

  let isValid = true;
  Array.from(form.elements).forEach((field) => {
    if (!field.required || field.disabled) {
      return;
    }

    if (!field.value.trim()) {
      setFieldError(field, "To pole jest wymagane.");
      isValid = false;
    }
  });

  if (!isValid) {
    setStatus(statusElement, "Uzupełnij wymagane pola.");
  }

  return isValid;
}

function getAppointmentValidationReason(form) {
  if (!form) return "Nie można odczytać formularza wizyty.";

  const value = (name) => String(form.elements[name]?.value || "").trim();
  if (!value("firstName")) return "Podaj imię pacjenta.";
  if (!value("lastName")) return "Podaj nazwisko pacjenta.";
  if (!value("phone")) return "Podaj numer telefonu pacjenta.";
  if (!value("doctor")) return "Wybierz lekarza.";
  if (!value("specialization")) return "Wybierz usługę medyczną.";
  if (!value("date")) return "Wybierz datę wizyty.";

  if (!value("time")) {
    const doctor = getSelectedDoctor();
    const service = getSelectedService();
    const cabinet = getSelectedCabinet();
    const availability = availableStartTimes({
      doctorId: doctor?.id ?? doctor?.doctor_id,
      serviceId: service?.id ?? service?.service_id ?? value("specialization"),
      date: value("date"),
      cabinetId: cabinet?.id ?? cabinet?.cabinet_id ?? value("cabinet"),
    });
    return availability.reason || "Wybierz dostępną godzinę rozpoczęcia wizyty.";
  }

  if (!value("cabinet")) return "Wybierz gabinet.";
  return "Sprawdź dane wizyty i popraw zaznaczone pole.";
}

function validateAppointmentModalFields() {
  const form = elements.appointmentForm;

  if (!validateRequiredModalFields(form, elements.appointmentStatus)) {
    setStatus(elements.appointmentStatus, getAppointmentValidationReason(form));
    return false;
  }

  const emailField = form?.elements.email;

  if (emailField?.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value.trim())) {
    setFieldError(emailField, "Podaj poprawny adres e-mail.");
    setStatus(elements.appointmentStatus, "Popraw błędy w formularzu.");
    return false;
  }

  return true;
}

// ==============================
// Patient registration
// ==============================
function getPatientPayload() {
  const form = elements.patientForm;
  formatPolishPhoneFields(form);
  const data = new FormData(form);

  return {
    first_name: String(data.get("firstName") || "").trim(),
    last_name: String(data.get("lastName") || "").trim(),
    pesel: String(data.get("pesel") || "").trim(),
    birth_date: data.get("birthDate") || null,
    gender: data.get("gender") || "other",
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    document_number: data.get("documentNumber") || null,
    insurer: data.get("insurer") || null,
    insurance_number: data.get("insuranceNumber") || null,
    blood_group: data.get("bloodType") || "unknown",
    allergies: data.get("allergies") || null,
    chronic_diseases: data.get("chronicDiseases") || null,
    notes: data.get("notes") || null,
    personal_data_consent: data.get("personalDataConsent") ? 1 : 0,
  };
}

function storePatient() {
  const form = elements.patientForm;
  formatPolishPhoneFields(form);
  const data = new FormData(form);
  const patient = normalizePatient({
    id: `patient-${Date.now()}`,
    firstName: data.get("firstName"),
    lastName: data.get("lastName"),
    pesel: data.get("pesel"),
    phone: data.get("phone"),
    email: data.get("email"),
    createdAt: new Date().toISOString(),
  });

  if (!patient) {
    return null;
  }

  patients.push(patient);
  saveCollection(storageKeys.patients, patients);

  return patient;
}

async function submitPatientRegistration() {
  const payload = getPatientPayload();

  try {
    const response = await apiRequest("backend/api/patients.php", {
      method: "POST",
      body: payload,
    });

    const patient = normalizePatient({
      id: response.data?.id,
      firstName: payload.first_name,
      lastName: payload.last_name,
      pesel: payload.pesel,
      phone: payload.phone,
      email: payload.email,
      createdAt: new Date().toISOString(),
    });

    if (patient) {
      patients.push(patient);
      saveCollection(storageKeys.patients, patients);
    }

    setStatus(elements.formStatus, response.message || "Pacjent zapisany w bazie danych.");
    elements.patientForm.reset();
  } catch (error) {
    if (!error.isBackendUnavailable) {
      setStatus(elements.formStatus, error.message || "Nie udało się zapisać pacjenta.");
      return;
    }

    const patient = storePatient();

    if (!patient) {
      setStatus(elements.formStatus, "Nie udało się zapisać danych pacjenta.");
      return;
    }

    setStatus(
      elements.formStatus,
      `Backend jest niedostępny. Pacjent ${patient.firstName} ${patient.lastName} zapisany lokalnie.`
    );
    elements.patientForm.reset();
  }
}

// ==============================
// Backend reference data
// ==============================
function replaceSelectOptions(select, options, placeholder) {
  if (!select || options.length === 0) {
    return;
  }

  const currentValue = select.value;
  select.replaceChildren();

  if (placeholder) {
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);
  }

  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    if (option.backendId) {
      optionElement.dataset.backendId = option.backendId;
    }
    select.appendChild(optionElement);
  });

  if (Array.from(select.options).some((option) => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function getUniqueSpecializations(sourceServices) {
  const seen = new Set();

  return sourceServices
    .map((service) => service.specialization || service.name)
    .filter(Boolean)
    .filter((specialization) => {
      if (seen.has(specialization)) {
        return false;
      }

      seen.add(specialization);
      return true;
    });
}

function isInactiveStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ["inactive", "nieaktywny", "nieaktywna", "blocked", "zablokowany", "zablokowana"].includes(status);
}

function isUnavailableCabinet(cabinet) {
  const status = String(cabinet?.status || "").trim().toLowerCase();
  return ["inactive", "nieaktywny", "remont", "niedostępny", "niedostepny", "unavailable"].includes(status);
}

function getDoctorLinkedUser(doctor) {
  const doctorId = doctor?.id ?? doctor?.doctor_id;
  if (!doctorId) return null;
  return users.find((user) => (
    authRoleKey(user?.role) === "lekarz"
    && String(user?.doctor_id ?? user?.doctorId ?? "") === String(doctorId)
  )) || null;
}

function isActiveDoctor(doctor) {
  if (!doctor || doctor.isActive === false || isInactiveStatus(doctor.status)) return false;
  const linkedUser = getDoctorLinkedUser(doctor);
  // Powiązany lekarz = konto użytkownika połączone z profilem lekarza.
  // Brak konta zachowuje dotychczasowe zachowanie: lekarz pozostaje dostępny.
  return !linkedUser || normalizeUserStatus(linkedUser.status, linkedUser.isActive) === "active";
}

function isActiveService(service) {
  if (!service || service.isActive === false || service.is_active === false || service.is_active === 0) {
    return false;
  }

  const status = String(service.status || "").trim().toLowerCase();
  return !["inactive", "nieaktywny", "nieaktywna", "0"].includes(status);
}

function isAvailableCabinet(cabinet) {
  return cabinet && cabinet.isActive !== false && !isUnavailableCabinet(cabinet);
}

function populateDoctorFields(sourceDoctors = doctors) {
  const activeDoctors = sourceDoctors.filter(isActiveDoctor);
  const doctorOptions = activeDoctors.map((doctor) => ({
    value: doctorFullName(doctor),
    label: doctorFullName(doctor),
    backendId: doctor.doctor_id || doctor.id,
  }));

  replaceSelectOptions(elements.doctorFilter, doctorOptions, "Wszyscy lekarze");
  replaceSelectOptions(elements.appointmentForm?.elements.doctor, doctorOptions, "Wybierz lekarza");
}

function getRawSelectedAppointmentService() {
  const select = elements.appointmentForm?.elements.specialization;
  return findServiceByIdOrValue(getSelectedOptionBackendId(select) || select?.value);
}

function getAppointmentDoctorsForService(service = null) {
  const activeDoctors = doctors.filter(isActiveDoctor);
  if (!service) return activeDoctors;
  return activeDoctors.filter((doctor) => doctorCanPerformService(doctor, service));
}

function refreshAppointmentDoctorOptionsForService({ preserveSelected = true } = {}) {
  const select = elements.appointmentForm?.elements.doctor;
  if (!select) return;

  const previousValue = select.value;
  const previousBackendId = select.selectedOptions?.[0]?.dataset.backendId || "";
  const selectedService = getRawSelectedAppointmentService();
  const selectableDoctors = getAppointmentDoctorsForService(selectedService);
  const target = String(previousBackendId || previousValue || "");

  select.replaceChildren();

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = selectedService && !selectableDoctors.length
    ? "Brak lekarzy dla tej usługi"
    : "Wybierz lekarza";
  select.appendChild(placeholderOption);

  selectableDoctors.forEach((doctor) => {
    const option = document.createElement("option");
    option.value = doctorFullName(doctor);
    option.textContent = doctorFullName(doctor);
    const backendId = doctor.doctor_id || doctor.id;
    if (backendId) option.dataset.backendId = backendId;
    select.appendChild(option);
  });

  if (preserveSelected && target) {
    const stillAvailable = Array.from(select.options).some((option) => {
      return option.value === target || option.dataset.backendId === target;
    });
    if (stillAvailable) {
      setSelectValueByIdOrValue(select, target);
    } else {
      select.value = "";
    }
  } else {
    select.value = "";
  }
}

function populateServiceFields(sourceServices = services) {
  const appointmentConfig = getAppointmentSettings();
  const selectableServices = appointmentConfig.hideInactiveServices ? sourceServices.filter(isActiveService) : sourceServices;
  const specializationOptions = selectableServices.map((service) => ({
    value: String(service.id || service.service_id || service.name || service.specialization),
    label: `${service.name || service.specialization}${service.durationMinutes ? ` (${service.durationMinutes} min)` : ""}${isActiveService(service) ? "" : " — Nieaktywna"}`,
    backendId: service.service_id || service.id,
    duration: service.durationMinutes || service.duration || 30,
  }));

  const filterOptions = sourceServices.map((service) => ({
    value: String(service.id || service.service_id || serviceName(service)),
    label: serviceName(service) || service.specialization || "Usługa",
    backendId: service.service_id || service.id,
  }));

  replaceSelectOptions(elements.serviceFilter, filterOptions, "Wszystkie usługi");
  replaceSelectOptions(elements.appointmentForm?.elements.specialization, specializationOptions, "Wybierz usługę");
}

function doctorCanPerformService(doctor, service) {
  if (!doctor || !service) return false;
  if (!doctorCanPerformRegistrationService(doctor, service)) return false;

  const serviceSpec = normalizeSpecialization(getAppointmentServiceSpecialization(service, doctor));
  if (serviceSpec) return true;

  const assigned = doctor.assignedServices || doctor.assigned_services || doctor.services || doctor.serviceIds || doctor.service_ids;
  if (Array.isArray(assigned) && assigned.length) {
    const serviceKeys = [service.id, service.service_id, service.name, serviceName(service)].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
    return assigned.some((item) => serviceKeys.includes(String(item?.id ?? item?.service_id ?? item).trim().toLowerCase()));
  }
  return true;
}

function getAppointmentServicesForDoctor(doctor) {
  const appointmentConfig = getAppointmentSettings();
  const activeServices = appointmentConfig.hideInactiveServices ? services.filter(isActiveService) : services;
  if (!doctor) return activeServices;
  return activeServices.filter((service) => doctorCanPerformService(doctor, service));
}

function setAppointmentServiceOptions(sourceServices, { preserveSelected = true } = {}) {
  const select = elements.appointmentForm?.elements.specialization;
  if (!select) return;
  const doctor = getSelectedDoctor();
  const selectableServices = doctor ? sourceServices.filter((service) => doctorCanPerformService(doctor, service)) : sourceServices;
  const previousValue = select.value;
  const previousBackendId = select.selectedOptions?.[0]?.dataset.backendId || "";
  select.replaceChildren();

  if (!selectableServices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.disabled = true;
    option.selected = true;
    option.textContent = "Brak dostępnych usług dla lekarza";
    select.appendChild(option);
    renderAvailableTimeButtons();
    return;
  }

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Wybierz usługę";
  select.appendChild(placeholderOption);

  selectableServices.forEach((service) => {
    const option = document.createElement("option");
    option.value = String(service.id || service.service_id || service.name || service.specialization);
    option.textContent = `${service.name || service.specialization}${service.durationMinutes ? ` (${service.durationMinutes} min)` : ""}${isActiveService(service) ? "" : " — Nieaktywna"}`;
    const backendId = service.service_id || service.id;
    if (backendId) option.dataset.backendId = backendId;
    option.dataset.duration = service.durationMinutes || service.duration || 30;
    select.appendChild(option);
  });

  if (preserveSelected) {
    const target = String(previousBackendId || previousValue || "");
    const stillAvailable = target && Array.from(select.options).some((option) => {
      return option.value === target || option.dataset.backendId === target;
    });
    if (stillAvailable) {
      setSelectValueByIdOrValue(select, target);
    } else {
      select.value = "";
    }
  } else {
    select.value = "";
  }
  syncAppointmentCabinetFromDoctor();
  renderAvailableTimeButtons();
}

function refreshAppointmentServiceOptionsForDoctor({ preserveSelected = true } = {}) {
  const doctor = getSelectedDoctor();
  const matchingServices = getAppointmentServicesForDoctor(doctor);
  setAppointmentServiceOptions(matchingServices, { preserveSelected });
}

function getAppointmentCompatibleCabinets(doctor = getSelectedDoctor(), service = getSelectedService()) {
  if (doctor && service && !doctorCanPerformService(doctor, service)) {
    return [];
  }
  const specialization = getAppointmentServiceSpecialization(service, doctor);
  if (!specialization) {
    return cabinets.filter(isAvailableCabinet);
  }
  return getCompatibleCabinetsForSpecialization(specialization);
}

function setAppointmentCabinetOptions(sourceCabinets, { preserveSelected = true } = {}) {
  const select = elements.appointmentForm?.elements.cabinet;
  if (!select) return;
  const previousValue = select.value;
  const previousBackendId = select.selectedOptions?.[0]?.dataset.backendId || "";
  select.replaceChildren();
  select.disabled = false;

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = sourceCabinets.length ? "Wybierz gabinet" : "Brak zgodnych gabinetów";
  select.appendChild(placeholderOption);

  sourceCabinets.forEach((cabinet) => {
    const option = document.createElement("option");
    const backendId = cabinet.cabinet_id || cabinet.id || "";
    option.value = String(backendId || cabinet.name);
    option.textContent = cabinet.name;
    if (backendId) option.dataset.backendId = backendId;
    option.dataset.cabinetName = cabinet.name || "";
    option.dataset.cabinetType = normalizeCabinetType(getCabinetTypeSource(cabinet));
    select.appendChild(option);
  });

  if (preserveSelected) {
    const target = String(previousBackendId || previousValue || "");
    const stillAvailable = target && Array.from(select.options).some((option) => {
      return option.value === target || option.dataset.backendId === target || option.dataset.cabinetName === target;
    });
    if (stillAvailable) {
      setSelectValueByIdOrValue(select, target);
    } else {
      select.value = "";
    }
  } else {
    select.value = "";
  }

  if (!getSelectedOptionBackendId(select) && sourceCabinets.length) {
    const firstOption = Array.from(select.options).find((option) => option.dataset.backendId || option.value);
    if (firstOption) {
      select.value = firstOption.value;
    }
  }
}

function populateCabinetFields(sourceCabinets = cabinets) {
  const fallbackCabinets = Object.entries(cabinetBackendIds).map(([name, id]) => normalizeCabinet({ id, name, is_active: true })).filter(Boolean);
  const cabinetSource = sourceCabinets.length ? sourceCabinets : fallbackCabinets;
  const availableCabinets = cabinetSource.filter(isAvailableCabinet);
  const cabinetOptions = availableCabinets.map((cabinet) => ({
    value: String(cabinet.id || cabinet.cabinet_id || cabinet.name),
    label: cabinet.name,
    backendId: cabinet.cabinet_id || cabinet.id,
  }));

  replaceSelectOptions(elements.cabinetFilter, cabinetSource.map((cabinet) => ({
    value: String(cabinet.id || cabinet.cabinet_id || cabinet.name),
    label: cabinet.name,
    backendId: cabinet.cabinet_id || cabinet.id,
  })), "Wszystkie gabinety");
  replaceSelectOptions(elements.appointmentForm?.elements.cabinet, cabinetOptions, "Wybierz gabinet");
}

function setLoadedCollection(name, loaded, storageKey) {
  if (!Array.isArray(loaded)) {
    console.warn(`[MediPlus] ${name} loader returned invalid data; keeping current state.`);
    return false;
  }

  if (name === "patients") patients = loaded;
  if (name === "appointments") appointments = loaded;
  if (name === "doctors") {
    doctors = loaded;
    backendDoctors = doctors;
  }
  if (name === "services") {
    services = loaded;
    backendServices = services;
  }
  if (name === "cabinets") cabinets = loaded;
  if (name === "users") users = loaded;

  if (storageKey) saveCollection(storageKey, loaded);
  return true;
}

async function loadEntityCollection({ name, endpoint, collectionKey, normalizer, storageKey, fallback = [] }) {
  const raw = await apiGet(endpoint, collectionKey);

  if (raw === null) {
    const local = loadCollection(storageKey, fallback, normalizer);
    setLoadedCollection(name, local, null);
    return local;
  }

  if (!Array.isArray(raw)) {
    console.warn(`[MediPlus] ${endpoint} did not return an array; keeping current ${name}.`);
    return { patients, appointments, doctors, services, cabinets, users }[name] || [];
  }

  const normalized = raw.map(normalizer).filter(Boolean);
  setLoadedCollection(name, normalized, storageKey);
  return normalized;
}

function loadPatients() {
  return loadEntityCollection({
    name: "patients",
    endpoint: "backend/api/patients.php",
    collectionKey: "patients",
    normalizer: normalizePatient,
    storageKey: storageKeys.patients,
    fallback: patients,
  });
}

function loadAppointments() {
  return loadEntityCollection({
    name: "appointments",
    endpoint: "backend/api/appointments.php",
    collectionKey: "appointments",
    normalizer: normalizeAppointment,
    storageKey: storageKeys.appointments,
    fallback: appointments.length ? appointments : initialAppointments,
  });
}

function loadDoctors() {
  return loadEntityCollection({
    name: "doctors",
    endpoint: "backend/api/doctors.php",
    collectionKey: "doctors",
    normalizer: normalizeDoctor,
    storageKey: storageKeys.doctors,
    fallback: doctors,
  }).then((loaded) => {
    populateDoctorFields(Array.isArray(loaded) ? loaded : doctors);
    return loaded;
  });
}

function loadServices() {
  return loadEntityCollection({
    name: "services",
    endpoint: "backend/api/services.php",
    collectionKey: "services",
    normalizer: normalizeService,
    storageKey: storageKeys.services,
    fallback: services,
  }).then((loaded) => {
    populateServiceFields(Array.isArray(loaded) ? loaded : services);
    return loaded;
  });
}

function loadCabinets() {
  return loadEntityCollection({
    name: "cabinets",
    endpoint: "backend/api/cabinets.php",
    collectionKey: "cabinets",
    normalizer: normalizeCabinet,
    storageKey: storageKeys.cabinets,
    fallback: cabinets,
  }).then((loaded) => {
    populateCabinetFields(Array.isArray(loaded) ? loaded : cabinets);
    return loaded;
  });
}

function loadUsers() {
  return loadEntityCollection({
    name: "users",
    endpoint: "backend/api/users.php",
    collectionKey: "users",
    normalizer: normalizeUser,
    storageKey: storageKeys.users,
    fallback: users,
  });
}

async function loadDoctorAbsences() {
  const raw = await apiGet("backend/api/doctor_absences.php", "doctor_absences");

  if (raw === null) {
    doctorAbsences = loadCollection(storageKeys.doctorAbsences, [], normalizeDoctorAbsence);
    return doctorAbsences;
  }

  if (!Array.isArray(raw)) {
    console.warn("[MediPlus] doctor_absences loader returned invalid data; keeping current state.");
    return doctorAbsences;
  }

  doctorAbsences = raw.map(normalizeDoctorAbsence).filter(Boolean);
  saveDoctorAbsences();
  return doctorAbsences;
}

function loadDoctorsFromBackend() {
  return loadDoctors();
}

function loadServicesFromBackend() {
  return loadServices();
}

async function loadBackendReferenceData() {
  const loaders = [
    loadPatients(),
    loadAppointments(),
    loadDoctors(),
    loadServices(),
    loadCabinets(),
    loadDoctorAbsences(),
    loadClinicWorkingHours(),
    loadSystemSettings(),
    loadEmailSettings(),
  ];

  if (authRoleKey(currentUser.role) === "recepcja") {
    loaders.push(loadUsers());
  }

  await Promise.allSettled(loaders);
  renderCalendar();
}

function stableDataSignature(items, projector = (item) => item) {
  const source = Array.isArray(items) ? items : [];
  return JSON.stringify(source.map(projector).sort((a, b) => String(a.id || "").localeCompare(String(b.id || ""))));
}

function appointmentSyncShape(appointment) {
  return {
    id: String(appointment.id || appointment.appointment_id || ""),
    appointment_id: String(appointment.appointment_id || appointment.id || ""),
    patient_id: String(appointment.patient_id || appointment.patientId || ""),
    doctor_id: String(appointment.doctor_id || appointment.doctorId || ""),
    service_id: String(appointment.service_id || appointment.serviceId || ""),
    cabinet_id: String(appointment.cabinet_id || appointment.cabinetId || ""),
    appointment_date: String(appointment.appointment_date || appointment.date || ""),
    start_time: formatTime(appointment.start_time || appointment.startTime || appointment.time || ""),
    end_time: formatTime(appointment.end_time || appointment.endTime || ""),
    status: String(appointment.status || ""),
    notes: String(appointment.notes || appointment.note || ""),
  };
}

function doctorSyncShape(doctor) {
  return {
    id: String(doctor.id || doctor.doctor_id || ""),
    firstName: String(doctor.firstName || doctor.first_name || ""),
    lastName: String(doctor.lastName || doctor.last_name || ""),
    specialization: String(doctor.specialization || ""),
    cabinet: String(doctor.cabinet || doctor.cabinet_id || ""),
    status: String(doctor.status || ""),
    avatarDataUrl: String(doctor.avatarDataUrl || doctor.avatar_data_url || ""),
    schedule: doctor.schedule || doctor.schedule_json || null,
  };
}

function absenceSyncShape(absence) {
  return {
    id: String(absence.id || ""),
    doctorId: String(absence.doctorId || absence.doctor_id || ""),
    type: String(absence.type || ""),
    dateFrom: String(absence.dateFrom || absence.date_from || ""),
    dateTo: String(absence.dateTo || absence.date_to || ""),
    timeFrom: formatTime(absence.timeFrom || absence.time_from || ""),
    timeTo: formatTime(absence.timeTo || absence.time_to || ""),
    note: String(absence.note || ""),
    status: String(absence.status || ""),
  };
}

function refreshActiveViewAfterDataSync(source) {
  const refreshableViews = new Set(["dashboard", "calendar", "history", "patientCard", "doctorCard", "registration"]);
  if (!refreshableViews.has(activeView)) {
    return;
  }

  if (activeView === "calendar") {
    renderCalendar();
    return;
  }
  if (activeView === "patientCard") {
    renderPatientCard(selectedPatientId, patientCardMode);
    return;
  }
  if (activeView === "doctorCard") {
    renderDoctorCard(selectedDoctorId, doctorCardMode);
    return;
  }
  if (source === "settings" && !["dashboard", "registration", "calendar"].includes(activeView)) {
    return;
  }
  renderActiveView(activeView);
}

function warnPollingFailureOnce(error) {
  if (dataPollingWarningShown) return;
  dataPollingWarningShown = true;
  console.warn("[MediPlus] Automatyczna synchronizacja danych chwilowo niedostępna:", error?.message || error);
}

async function pollAppointments() {
  try {
    const response = await apiRequest("backend/api/appointments.php");
    const raw = extractApiData(response, "appointments");
    if (!Array.isArray(raw)) return;
    const next = raw.map(normalizeAppointment).filter(Boolean);
    const before = stableDataSignature(appointments, appointmentSyncShape);
    const after = stableDataSignature(next, appointmentSyncShape);
    if (before === after) return;
    appointments = next;
    saveCollection(storageKeys.appointments, appointments);
    refreshActiveViewAfterDataSync("appointments");
  } catch (error) {
    warnPollingFailureOnce(error);
  }
}

async function pollDoctorAbsences() {
  try {
    const response = await apiRequest("backend/api/doctor_absences.php");
    const raw = extractApiData(response, "doctor_absences");
    if (!Array.isArray(raw)) return;
    const next = raw.map(normalizeDoctorAbsence).filter(Boolean);
    const before = stableDataSignature(doctorAbsences, absenceSyncShape);
    const after = stableDataSignature(next, absenceSyncShape);
    if (before === after) return;
    doctorAbsences = next;
    saveDoctorAbsences();
    refreshActiveViewAfterDataSync("doctor_absences");
  } catch (error) {
    warnPollingFailureOnce(error);
  }
}

async function pollDoctors() {
  try {
    const response = await apiRequest("backend/api/doctors.php");
    const raw = extractApiData(response, "doctors");
    if (!Array.isArray(raw)) return;
    const next = raw.map(normalizeDoctor).filter(Boolean);
    const before = stableDataSignature(doctors, doctorSyncShape);
    const after = stableDataSignature(next, doctorSyncShape);
    if (before === after) return;
    doctors = next;
    backendDoctors = next;
    saveCollection(storageKeys.doctors, doctors);
    refreshActiveViewAfterDataSync("doctors");
  } catch (error) {
    warnPollingFailureOnce(error);
  }
}

async function pollSettings() {
  const before = JSON.stringify({
    clinicWorkingHours,
    clinicSettings,
    appointmentSettings,
    securitySettings,
  });

  try {
    const [hoursResult, settingsResult] = await Promise.allSettled([
      apiRequest("backend/api/settings.php?action=clinic_working_hours"),
      apiRequest("backend/api/settings.php?action=system_settings"),
    ]);

    if (hoursResult.status === "fulfilled") {
      const hours = extractApiData(hoursResult.value, "clinic_working_hours");
      clinicWorkingHours = normalizeClinicWorkingHours(hours);
      saveJsonSetting(settingsStorageKeys.workingHours, clinicWorkingHours);
    }

    if (settingsResult.status === "fulfilled") {
      const raw = extractApiData(settingsResult.value, "system_settings");
      if (raw && typeof raw === "object") {
        clinicSettings = normalizeClinicSettings(raw.clinic);
        appointmentSettings = normalizeAppointmentSettings(raw.appointment);
        securitySettings = normalizeSecuritySettings(raw.security);
        systemSettings = { clinic: clinicSettings, appointment: appointmentSettings, security: securitySettings };
        saveJsonSetting(settingsStorageKeys.clinic, clinicSettings);
        saveJsonSetting(settingsStorageKeys.appointment, appointmentSettings);
        saveJsonSetting(settingsStorageKeys.security, securitySettings);
      }
    }

    if (hoursResult.status === "rejected" && settingsResult.status === "rejected") {
      warnPollingFailureOnce(hoursResult.reason || settingsResult.reason);
      return;
    }
  } catch (error) {
    warnPollingFailureOnce(error);
    return;
  }

  const after = JSON.stringify({
    clinicWorkingHours,
    clinicSettings,
    appointmentSettings,
    securitySettings,
  });
  if (before !== after) {
    refreshActiveViewAfterDataSync("settings");
  }
}

function startDataPolling() {
  if (dataPollingStarted) return;
  dataPollingStarted = true;
  dataPollingWarningShown = false;
  dataPollingTimers = {
    appointments: window.setInterval(pollAppointments, 15000),
    doctorAbsences: window.setInterval(pollDoctorAbsences, 20000),
    doctors: window.setInterval(pollDoctors, 30000),
    settings: window.setInterval(pollSettings, 60000),
  };
}

function stopDataPolling() {
  Object.values(dataPollingTimers).forEach((timerId) => window.clearInterval(timerId));
  dataPollingTimers = {};
  dataPollingStarted = false;
}

// ==============================
// Notifications
// ==============================
function notificationButton() {
  return document.querySelector(".notification-button");
}

function notificationBadge() {
  return document.querySelector(".notification-count");
}

function normalizeNotification(notification) {
  return {
    id: String(notification?.id || ""),
    type: String(notification?.type || "info"),
    title: String(notification?.title || "Powiadomienie"),
    message: String(notification?.message || ""),
    entityType: notification?.entity_type || notification?.entityType || "",
    entityId: notification?.entity_id ?? notification?.entityId ?? null,
    severity: ["info", "success", "warning", "danger"].includes(notification?.severity) ? notification.severity : "info",
    createdAt: notification?.created_at || notification?.createdAt || "",
    isRead: Boolean(notification?.is_read ?? notification?.isRead),
    readAt: notification?.read_at || notification?.readAt || "",
  };
}

function formatNotificationTimestamp(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadNotifications({ silent = false } = {}) {
  try {
    const response = await apiRequest("backend/api/notifications.php");
    const rows = response.notifications || response.data || [];
    notifications = Array.isArray(rows) ? rows.map(normalizeNotification).filter((item) => item.id) : [];
    notificationUnreadCount = Number(response.unread_count ?? notifications.filter((item) => !item.isRead).length) || 0;
    renderNotificationBell();
    if (notificationDropdownOpen) {
      renderNotificationDropdown();
    }
  } catch (error) {
    if (!silent) {
      console.warn("[notifications] load failed", error);
    }
  }
}

function renderNotificationBell() {
  const button = notificationButton();
  if (!button) return;
  let badge = notificationBadge();
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "notification-count";
    button.appendChild(badge);
  }
  button.setAttribute("aria-label", `Powiadomienia${notificationUnreadCount ? `: ${notificationUnreadCount} nieprzeczytane` : ""}`);
  badge.textContent = String(Math.min(notificationUnreadCount, 99));
  badge.hidden = notificationUnreadCount <= 0;
}

function ensureNotificationDropdown() {
  let dropdown = document.querySelector("#notificationDropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "notificationDropdown";
    dropdown.className = "notification-dropdown";
    dropdown.hidden = true;
    document.body.appendChild(dropdown);
  }
  return dropdown;
}

function positionNotificationDropdown() {
  const button = notificationButton();
  const dropdown = ensureNotificationDropdown();
  if (!button) return;
  const rect = button.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 10}px`;
  dropdown.style.right = `${Math.max(16, window.innerWidth - rect.right)}px`;
}

function closeNotificationDropdown() {
  notificationDropdownOpen = false;
  const dropdown = document.querySelector("#notificationDropdown");
  if (dropdown) dropdown.hidden = true;
}

function notificationPreview(message, expanded) {
  const text = String(message || "");
  if (expanded || text.length <= 120) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, 120).trim())}...`;
}

function renderNotificationDropdown() {
  const dropdown = ensureNotificationDropdown();
  positionNotificationDropdown();
  const unreadText = notificationUnreadCount === 1 ? "1 nieprzeczytane" : `${notificationUnreadCount} nieprzeczytanych`;
  const listHtml = notifications.length
    ? notifications.map((item) => {
        const expanded = expandedNotificationIds.has(item.id);
        const isLong = item.message.length > 120;
        return `
          <article class="notification-item notification-${escapeHtml(item.severity)} ${item.isRead ? "is-read" : "is-unread"}" data-notification-id="${escapeHtml(item.id)}" tabindex="0">
            <div class="notification-marker"></div>
            <div class="notification-content">
              <div class="notification-item-head">
                <strong>${escapeHtml(item.title)}</strong>
                <time>${escapeHtml(formatNotificationTimestamp(item.createdAt))}</time>
              </div>
              <p class="${expanded ? "is-expanded" : ""}">${notificationPreview(item.message, expanded)}</p>
              ${isLong ? `<button class="notification-expand" type="button" data-notification-expand="${escapeHtml(item.id)}">${expanded ? "Zwiń" : "Rozwiń"}</button>` : ""}
            </div>
            ${item.isRead ? "" : `<span class="notification-unread-dot" aria-label="Nieprzeczytane"></span>`}
            <button class="notification-delete" type="button" data-notification-delete="${escapeHtml(item.id)}" aria-label="Usuń powiadomienie">×</button>
          </article>
        `;
      }).join("")
    : `<div class="notification-empty">Brak powiadomień.</div>`;

  dropdown.innerHTML = `
    <div class="notification-panel-head">
      <div>
        <strong>Powiadomienia</strong>
        <span>${escapeHtml(unreadText)}</span>
      </div>
      <button class="notification-mark-all" type="button" ${notificationUnreadCount ? "" : "disabled"}>Oznacz wszystkie jako przeczytane</button>
    </div>
    <div class="notification-list">${listHtml}</div>
  `;
  dropdown.hidden = !notificationDropdownOpen;

  dropdown.querySelector(".notification-mark-all")?.addEventListener("click", markAllNotificationsRead);
  dropdown.querySelectorAll("[data-notification-expand]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.getAttribute("data-notification-expand");
      if (!id) return;
      if (expandedNotificationIds.has(id)) expandedNotificationIds.delete(id);
      else expandedNotificationIds.add(id);
      renderNotificationDropdown();
    });
  });
  dropdown.querySelectorAll("[data-notification-delete]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.getAttribute("data-notification-delete");
      if (id) deleteNotification(id);
    });
  });
  dropdown.querySelectorAll(".notification-item").forEach((item) => {
    item.addEventListener("click", () => markNotificationRead(item.getAttribute("data-notification-id")));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        markNotificationRead(item.getAttribute("data-notification-id"));
      }
    });
  });
}

function bindNotificationBell() {
  const button = notificationButton();
  if (!button || notificationBellBound) return;
  notificationBellBound = true;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    notificationDropdownOpen = !notificationDropdownOpen;
    if (notificationDropdownOpen) renderNotificationDropdown();
    else closeNotificationDropdown();
  });

  document.addEventListener("click", (event) => {
    const dropdown = document.querySelector("#notificationDropdown");
    if (!notificationDropdownOpen) return;
    if (dropdown?.contains(event.target) || button.contains(event.target)) return;
    closeNotificationDropdown();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNotificationDropdown();
  });

  window.addEventListener("resize", () => {
    if (notificationDropdownOpen) positionNotificationDropdown();
  });
}

async function markNotificationRead(id) {
  if (!id) return;
  const item = notifications.find((notification) => notification.id === String(id));
  if (item?.isRead) return;
  try {
    await apiRequest("backend/api/notifications.php", {
      method: "PATCH",
      body: { action: "mark_read", id: Number(id) },
    });
    await loadNotifications({ silent: true });
  } catch (error) {
    console.warn("[notifications] mark_read failed", error);
  }
}

async function markAllNotificationsRead(event) {
  event?.preventDefault?.();
  try {
    await apiRequest("backend/api/notifications.php", {
      method: "PATCH",
      body: { action: "mark_all_read" },
    });
    await loadNotifications({ silent: true });
  } catch (error) {
    console.warn("[notifications] mark_all_read failed", error);
  }
}

async function deleteNotification(id) {
  if (!id) return;
  try {
    await apiRequest("backend/api/notifications.php", {
      method: "PATCH",
      body: { action: "delete", id: Number(id) },
    });
    expandedNotificationIds.delete(String(id));
    await loadNotifications({ silent: true });
  } catch (error) {
    console.warn("[notifications] delete failed", error);
  }
}

function startNotificationPolling() {
  bindNotificationBell();
  if (notificationPollingInterval) return;
  loadNotifications({ silent: true });
  notificationPollingInterval = window.setInterval(() => loadNotifications({ silent: true }), 15000);
}

function stopNotificationPolling() {
  if (notificationPollingInterval) {
    window.clearInterval(notificationPollingInterval);
  }
  notificationPollingInterval = null;
  notifications = [];
  notificationUnreadCount = 0;
  expandedNotificationIds.clear();
  closeNotificationDropdown();
  renderNotificationBell();
}

// ==============================
// Doctors and doctor card
// ==============================
const doctorScheduleDays = [
  { key: "monday", label: "Poniedziałek", short: "Pn" },
  { key: "tuesday", label: "Wtorek", short: "Wt" },
  { key: "wednesday", label: "Środa", short: "Śr" },
  { key: "thursday", label: "Czwartek", short: "Cz" },
  { key: "friday", label: "Piątek", short: "Pt" },
  { key: "saturday", label: "Sobota", short: "Sb" },
  { key: "sunday", label: "Niedziela", short: "Nd" },
];

function normalizeDoctorAbsence(absence) {
  if (!absence) return null;
  const doctorId = String(absence.doctorId ?? absence.doctor_id ?? absence.doctor ?? "").trim();
  const dateFrom = String(absence.dateFrom ?? absence.date_from ?? absence.from ?? "").slice(0, 10);
  const dateTo = String(absence.dateTo ?? absence.date_to ?? absence.to ?? dateFrom).slice(0, 10);
  if (!doctorId || !dateFrom) return null;
  const type = doctorAbsenceTypes.includes(absence.type) ? absence.type : "Inne";
  const timeFrom = formatTime(absence.timeFrom ?? absence.time_from ?? "");
  const timeTo = formatTime(absence.timeTo ?? absence.time_to ?? "");
  return {
    id: String(absence.id || `absence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    doctorId,
    type,
    dateFrom,
    dateTo: dateTo && dateTo >= dateFrom ? dateTo : dateFrom,
    timeFrom,
    timeTo,
    note: String(absence.note || "").trim(),
    status: String(absence.status || "active").toLowerCase() === "cancelled" ? "cancelled" : "active",
    createdAt: absence.createdAt || absence.created_at || new Date().toISOString(),
    cancelledAt: absence.cancelledAt || absence.cancelled_at || "",
  };
}

function saveDoctorAbsences() {
  saveCollection(storageKeys.doctorAbsences, doctorAbsences);
}

function upsertDoctorAbsence(absence) {
  const normalized = normalizeDoctorAbsence(absence);
  if (!normalized) return null;
  const index = doctorAbsences.findIndex((item) => String(item.id) === String(normalized.id));
  if (index >= 0) {
    doctorAbsences[index] = { ...doctorAbsences[index], ...normalized };
  } else {
    doctorAbsences.push(normalized);
  }
  saveDoctorAbsences();
  return normalized;
}

function refreshAfterDoctorAbsenceChange(doctorId) {
  if (activeView === "doctorCard") renderDoctorCard(doctorId, "view");
  if (activeView === "calendar") renderCalendar();
  if (activeView === "registration") renderRegistration();
  if (activeView === "dashboard") renderDashboard();
}

function doctorAbsenceAppliesToDate(absence, date) {
  const dateIso = String(date || today()).slice(0, 10);
  return absence?.status === "active" && dateIso >= absence.dateFrom && dateIso <= absence.dateTo;
}

function getDoctorAbsencesForDate(doctorId, date) {
  return doctorAbsences.filter((absence) => String(absence.doctorId) === String(doctorId) && doctorAbsenceAppliesToDate(absence, date));
}

function isWholeDayAbsence(absence) {
  return !absence?.timeFrom && !absence?.timeTo;
}

function absenceTimeRange(absence, date) {
  const startTime = absence.timeFrom || `${String(CALENDAR_START_HOUR).padStart(2, "0")}:00`;
  const endTime = absence.timeTo || `${String(CALENDAR_END_HOUR).padStart(2, "0")}:00`;
  return {
    start: combineLocalDateTime(date, startTime),
    end: combineLocalDateTime(date, endTime),
  };
}

function doctorIsAbsentInRange(doctorId, date, start, end) {
  return getDoctorAbsencesForDate(doctorId, date).some((absence) => {
    if (isWholeDayAbsence(absence)) return true;
    const range = absenceTimeRange(absence, date);
    return Boolean(range.start && range.end && range.start < end && range.end > start);
  });
}

function doctorHasWholeDayAbsence(doctorId, date) {
  return getDoctorAbsencesForDate(doctorId, date).some(isWholeDayAbsence);
}

function renderAbsenceDateRange(absence) {
  const dates = absence.dateFrom === absence.dateTo ? absence.dateFrom : `${absence.dateFrom} – ${absence.dateTo}`;
  const times = absence.timeFrom && absence.timeTo ? `, ${absence.timeFrom}–${absence.timeTo}` : "";
  return `${dates}${times}`;
}

function doctorBaseStatusLabel(doctor) {
  const value = String(doctor?.status || "").trim().toLowerCase();
  if (value.includes("urlop")) return "Urlop";
  if (value.includes("nie") || value.includes("inactive")) return "Nieaktywny";
  return "Aktywny";
}

function doctorIsAbsentToday(doctor) {
  const doctorId = getDoctorEntityId(doctor);
  return Boolean(doctorId && getDoctorAbsencesForDate(doctorId, today()).length);
}

function doctorStatusLabel(doctor) {
  const baseStatus = doctorBaseStatusLabel(doctor);
  if (baseStatus === "Aktywny" && doctorIsAbsentToday(doctor)) return "Nieobecny";
  if (baseStatus === "Urlop") return "Nieobecny";
  return baseStatus;
}

function doctorStatusBadge(doctor) {
  const label = doctorStatusLabel(doctor);
  const className = label === "Aktywny" ? "active" : label === "Nieobecny" ? "warning" : "inactive";
  return `<span class="status ${className}">${escapeHtml(label)}</span>`;
}

function getDoctorEntityId(doctor) {
  return doctor?.id ?? doctor?.doctor_id ?? "";
}

function findDoctorById(doctorId) {
  if (!doctorId) return null;
  return doctors.find((doctor) => String(doctor.id ?? doctor.doctor_id) === String(doctorId)) || null;
}

function isDoctorActive(doctor) {
  return doctorBaseStatusLabel(doctor) === "Aktywny";
}

function getDoctorCabinetName(doctor) {
  if (doctor?.cabinet) return doctor.cabinet;
  const cabinet = findCabinetByBackendId(doctor?.cabinet_id);
  return cabinet?.name || "Brak gabinetu";
}

function filterDoctorsForView() {
  const query = doctorSearchQuery.trim().toLowerCase();
  return doctors.filter((doctor) => {
    const status = doctorStatusLabel(doctor);
    if (doctorStatusFilter === "active" && status !== "Aktywny") return false;
    if (doctorStatusFilter === "inactive" && status !== "Nieaktywny") return false;
    if (doctorStatusFilter === "vacation" && status !== "Nieobecny") return false;
    if (!query) return true;

    return [
      doctorFullName(doctor),
      doctor.specialization,
      doctor.phone,
      doctor.email,
      getDoctorCabinetName(doctor),
    ].join(" ").toLowerCase().includes(query);
  });
}

function renderDoctorFilterTabs() {
  const counts = {
    all: doctors.length,
    active: doctors.filter((doctor) => doctorStatusLabel(doctor) === "Aktywny").length,
    inactive: doctors.filter((doctor) => doctorStatusLabel(doctor) === "Nieaktywny").length,
    vacation: doctors.filter((doctor) => doctorStatusLabel(doctor) === "Nieobecny").length,
  };
  const tabs = [
    ["all", "Wszyscy", counts.all],
    ["active", "Aktywni", counts.active],
    ["inactive", "Nieaktywni", counts.inactive],
    ["vacation", "Nieobecny", counts.vacation],
  ];

  return `
    <div class="doctor-filter-tabs">
      ${tabs.map(([key, label, count]) => `
        <button type="button" data-doctor-filter="${key}" class="${doctorStatusFilter === key ? "active" : ""}">
          ${label} <span>${count}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderDoctors() {
  const view = document.querySelector("#doctorsView");
  if (!view) return;

  const visibleDoctors = filterDoctorsForView();

  view.innerHTML = `
    <section class="page-head">
      <div>
        <h1>Lekarze</h1>
        <p>Zarządzaj personelem medycznym kliniki.</p>
      </div>
      <div class="page-actions">
        <button class="primary-button" type="button" data-add-doctor>+ Dodaj lekarza</button>
      </div>
    </section>
    <section class="doctor-controls card">
      <div class="doctor-control-row">
        <input class="doctor-search-input" type="search" data-doctor-search value="${escapeHtml(doctorSearchQuery)}" placeholder="Szukaj lekarza po imieniu, nazwisku, specjalizacji, telefonie lub e-mailu...">
        <button class="secondary-button" type="button" data-doctor-clear>Wyczyść</button>
      </div>
      ${renderDoctorFilterTabs()}
    </section>
    <section class="table-card doctors-table-card">
      <table>
        <thead>
          <tr>
            <th>Lekarz</th>
            <th>Specjalizacja</th>
            <th>Gabinet</th>
            <th>Telefon</th>
            <th>Email</th>
            <th>Status</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          ${visibleDoctors.length ? visibleDoctors.map((doctor) => {
            const id = escapeHtml(getDoctorEntityId(doctor));
            const statusAction = isDoctorActive(doctor) ? "Dezaktywuj" : "Aktywuj";
            const cabinetName = getDoctorCabinetName(doctor);
            const doctorEmail = doctor.email || "Brak danych";
            return `
              <tr>
                <td><div class="person-cell">${renderDoctorAvatar(doctor, { size: 42 })}<div><strong>${escapeHtml(doctorFullName(doctor))}</strong></div></div></td>
                <td>${escapeHtml(doctor.specialization || "Brak danych")}</td>
                <td class="doctor-nowrap-cell" title="${escapeHtml(cabinetName)}">${escapeHtml(cabinetName)}</td>
                <td>${escapeHtml(doctor.phone || "Brak danych")}</td>
                <td class="doctor-nowrap-cell" title="${escapeHtml(doctorEmail)}">${escapeHtml(doctorEmail)}</td>
                <td>${doctorStatusBadge(doctor)}</td>
                <td><div class="row-actions doctor-row-actions">
                  <button class="secondary-button" type="button" data-doctor-details="${id}">Szczegóły</button>
                  <button class="secondary-button" type="button" data-doctor-toggle="${id}">${statusAction}</button>
                </div></td>
              </tr>
            `;
          }).join("") : `<tr><td colspan="7"><div class="empty-state">Brak lekarzy do wyświetlenia.</div></td></tr>`}
        </tbody>
      </table>
    </section>
  `;

  bindDoctorsEvents(view);
}

function bindDoctorsEvents(view) {
  view.querySelector("[data-add-doctor]")?.addEventListener("click", openAddDoctor);
  view.querySelector("[data-doctor-search]")?.addEventListener("input", (event) => {
    doctorSearchQuery = event.target.value;
    const cursorPosition = event.target.selectionStart;
    clearTimeout(doctorSearchRenderTimer);
    doctorSearchRenderTimer = setTimeout(() => {
      rerenderPreservingSearchFocus(renderDoctors, "[data-doctor-search]", cursorPosition);
    }, 120);
  });
  view.querySelector("[data-doctor-clear]")?.addEventListener("click", () => {
    doctorSearchQuery = "";
    doctorStatusFilter = "all";
    renderDoctors();
  });
  view.querySelectorAll("[data-doctor-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      doctorStatusFilter = button.dataset.doctorFilter || "all";
      renderDoctors();
    });
  });
  view.querySelectorAll("[data-doctor-details]").forEach((button) => {
    button.addEventListener("click", () => openDoctorCard(button.dataset.doctorDetails, "view"));
  });
  view.querySelectorAll("[data-doctor-edit]").forEach((button) => {
    button.addEventListener("click", () => openDoctorCard(button.dataset.doctorEdit, "edit"));
  });
  view.querySelectorAll("[data-doctor-toggle]").forEach((button) => {
    button.addEventListener("click", () => toggleDoctorStatus(button.dataset.doctorToggle));
  });
}

function openDoctorCard(doctorId, mode = "view") {
  selectedDoctorId = doctorId;
  doctorCardMode = mode;
  doctorPendingAvatarDataUrl = "";
  showView("doctorCard");
}

function openAddDoctor() {
  selectedDoctorId = null;
  doctorCardMode = "create";
  clearDoctorEditDirtyState();
  showView("doctorCard");
}

function getBlankDoctor() {
  return normalizeDoctor({
    id: `new-doctor-${Date.now()}`,
    firstName: "",
    lastName: "",
    name: "Nowy lekarz",
    specialization: "",
    status: "Aktywny",
    schedule: getDefaultDoctorSchedule(),
  });
}

function getDefaultDoctorSchedule() {
  return {
    monday: { active: true, start: "08:00", end: "16:00" },
    tuesday: { active: true, start: "08:00", end: "16:00" },
    wednesday: { active: true, start: "08:00", end: "16:00" },
    thursday: { active: true, start: "08:00", end: "16:00" },
    friday: { active: true, start: "08:00", end: "16:00" },
    saturday: { active: false, start: "", end: "" },
    sunday: { active: false, start: "", end: "" },
  };
}

function getDoctorSchedule(doctor) {
  return normalizeScheduleValue(doctor?.schedule) || getDefaultDoctorSchedule();
}

function renderDoctorScheduleRows(doctor) {
  const schedule = getDoctorSchedule(doctor);
  return doctorScheduleDays.map((day) => {
    const entry = normalizeWorkingWindow(schedule[day.key], getDefaultDoctorSchedule()[day.key]);
    const closed = !entry?.active;
    return `
      <div class="doctor-schedule-display-row ${closed ? "closed" : ""}">
        <span class="doctor-day-badge">${day.short}</span>
        <div>
          <strong>${day.label}</strong>
          <span>${closed ? "Nie pracuje" : `${escapeHtml(entry.start)}–${escapeHtml(entry.end)}`}</span>
        </div>
      </div>
    `;
  }).join("");
}

function getDoctorAssignedServices(doctor) {
  return services.filter((service) => doctorCanPerformRegistrationService(doctor, service));
}

function getDoctorUpcomingAppointments(doctor) {
  const doctorId = getDoctorEntityId(doctor);
  const now = new Date();
  return appointments
    .filter((appointment) => isAppointmentForDoctor(appointment, doctorId))
    .filter((appointment) => {
      const status = getResolvedAppointmentStatus(appointment);
      const start = appointmentStartDateTime(appointment);
      return ["Zaplanowana", "W trakcie"].includes(status) && (!start || start >= now || status === "W trakcie");
    })
    .sort((a, b) => (appointmentStartDateTime(a)?.getTime() || 0) - (appointmentStartDateTime(b)?.getTime() || 0));
}

function renderDoctorUpcomingVisits(doctor) {
  const visits = getDoctorUpcomingAppointments(doctor).slice(0, 6);
  if (!visits.length) return `<p class="empty-note">Brak nadchodzących wizyt.</p>`;

  return `
    <div class="patient-visit-history">
      ${visits.map((appointment) => {
        const start = appointmentStartDateTime(appointment);
        return `
          <div class="visit-row">
            <div class="visit-time"><strong>${escapeHtml(start ? formatFullDate(start) : "Brak daty")}</strong><span>${escapeHtml(start ? formatTime(start) : "—")}</span></div>
            <div><strong>${escapeHtml(appointment.patient || "Brak pacjenta")}</strong><span>${escapeHtml(appointment.serviceName || appointment.specialization || "Brak usługi")}</span></div>
            <div class="visit-status">${appointmentStatusBadge(appointment)}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function getDoctorEditSnapshot(form) {
  if (!form) return "";
  const data = new FormData(form);
  return JSON.stringify(Array.from(data.entries()).sort(([a], [b]) => a.localeCompare(b)));
}

function setDoctorEditDirty(form) {
  if (doctorCardMode !== "edit") return;
  doctorEditHasUnsavedChanges = getDoctorEditSnapshot(form) !== doctorEditInitialSnapshot;
}

function clearDoctorEditDirtyState() {
  doctorEditInitialSnapshot = "";
  doctorEditHasUnsavedChanges = false;
  doctorPendingAvatarDataUrl = "";
}

function confirmDoctorEditNavigation() {
  if (!doctorEditHasUnsavedChanges) return true;
  return window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz opuścić stronę?");
}

function getPatientEditSnapshot(form) {
  if (!form) return "";
  const data = new FormData(form);
  return JSON.stringify(Array.from(data.entries()).sort(([a], [b]) => a.localeCompare(b)));
}

function setPatientEditDirty(form) {
  if (patientCardMode !== "edit") return;
  patientCardDirty = getPatientEditSnapshot(form) !== patientEditInitialSnapshot;
}

function clearPatientEditDirtyState() {
  patientEditInitialSnapshot = "";
  patientCardDirty = false;
}

function confirmPatientCardNavigation() {
  if (!patientCardDirty) return true;
  const confirmed = window.confirm("Masz niezapisane zmiany w karcie pacjenta. Czy na pewno chcesz opuścić stronę?");
  if (confirmed) {
    clearPatientEditDirtyState();
    patientCardMode = "view";
  }
  return confirmed;
}

window.addEventListener("beforeunload", (event) => {
  if (!doctorEditHasUnsavedChanges && !patientCardDirty) return;
  event.preventDefault();
  event.returnValue = "";
});

function renderDoctorForm(doctor, mode) {
  const isCreate = mode === "create";
  const schedule = getDoctorSchedule(doctor);
  const specialization = doctor?.specialization || doctorSpecializations[0];
  const cabinetOptions = renderDoctorCabinetOptions(doctor, specialization);

  return `
    <section class="doctor-edit-card card">
      <form class="doctor-card-edit-form" data-doctor-form>
        <div class="doctor-edit-head">
          <div>
            <h1>${isCreate ? "Dodaj lekarza" : "Edytuj lekarza"}</h1>
            <p>${isCreate ? "Utwórz nowy profil lekarza." : "Zaktualizuj dane profilu lekarza."}</p>
          </div>
          <div class="doctor-avatar-edit-block" data-doctor-avatar-preview>
            ${renderDoctorAvatar(doctorPendingAvatarDataUrl ? { ...doctor, avatarDataUrl: doctorPendingAvatarDataUrl } : doctor, { size: 96 })}
            <button class="secondary-button doctor-avatar-button" type="button" data-doctor-avatar-change>Zmień zdjęcie</button>
            <input class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" data-doctor-avatar-input>
            <span class="doctor-avatar-status" data-doctor-avatar-status></span>
          </div>
        </div>
        <div class="doctor-card-edit-grid">
          <label>Imię<input name="firstName" value="${escapeHtml(doctor?.firstName || "")}" required></label>
          <label>Nazwisko<input name="lastName" value="${escapeHtml(doctor?.lastName || "")}" required></label>
          <label>Specjalizacja<select name="specialization" required>${renderDoctorSpecializationOptions(specialization)}</select></label>
          <label>Telefon<input name="phone" value="${escapeHtml(doctor?.phone || "")}"></label>
          <label>E-mail<span class="doctor-email-field"><input name="email" type="text" value="${escapeHtml(formatDoctorEmail(doctor?.email || ""))}" data-doctor-email><span>${DOCTOR_EMAIL_DOMAIN}</span></span></label>
          <label>Gabinet<select name="cabinet"><option value="">Brak gabinetu</option>${cabinetOptions}</select></label>
          <label>Status<select name="status">
            ${["Aktywny", "Nieaktywny", "Urlop"].map((status) => `<option value="${status}" ${doctorBaseStatusLabel(doctor) === status ? "selected" : ""}>${status}</option>`).join("")}
          </select></label>
        </div>
        <input type="hidden" name="schedule" value="${escapeHtml(JSON.stringify(schedule))}">
        <input type="hidden" name="avatarDataUrl" data-doctor-avatar-field value="${escapeHtml(doctorPendingAvatarDataUrl || doctor.avatarDataUrl || doctor.avatar_data_url || "")}">
        <div class="modal-actions">
          <button class="secondary-button" type="button" data-doctor-cancel>Anuluj</button>
          <button class="primary-button" type="submit">${isCreate ? "Utwórz lekarza" : "Zapisz zmiany"}</button>
        </div>
        <p class="form-status" data-doctor-form-status></p>
      </form>
    </section>
  `;
}

function renderDoctorSpecializationOptions(selectedValue = "") {
  const selected = String(selectedValue || "").trim();
  const values = Array.from(new Set([...doctorSpecializations, selected].filter(Boolean)));
  return values.map((specialization) => {
    return `<option value="${escapeHtml(specialization)}" ${normalizeSpecialization(selected) === normalizeSpecialization(specialization) ? "selected" : ""}>${escapeHtml(specialization)}</option>`;
  }).join("");
}

function getCompatibleCabinetsForSpecialization(specialization) {
  return cabinets.filter((cabinet) => isAvailableCabinet(cabinet) && isCabinetCompatibleWithSpecialization(cabinet, specialization));
}

function getCompatibleCabinetsForDoctor(doctor) {
  if (!doctor) return [];
  const defaultCabinet = getDoctorDefaultCabinet(doctor);
  const compatible = getCompatibleCabinetsForSpecialization(doctor.specialization);
  if (!defaultCabinet || !compatible.some((cabinet) => String(cabinet.id ?? cabinet.cabinet_id) === String(defaultCabinet.id ?? defaultCabinet.cabinet_id))) {
    return compatible;
  }
  return [
    defaultCabinet,
    ...compatible.filter((cabinet) => String(cabinet.id ?? cabinet.cabinet_id) !== String(defaultCabinet.id ?? defaultCabinet.cabinet_id)),
  ];
}

function renderDoctorCabinetOptions(doctor, specialization = doctor?.specialization) {
  const compatibleCabinets = getCompatibleCabinetsForSpecialization(specialization);
  const doctorCabinetId = getDoctorCabinetId(doctor);
  return compatibleCabinets.map((cabinet) => {
    const backendId = cabinet.cabinet_id ?? cabinet.id ?? "";
    const value = backendId || cabinet.name;
    const cabinetType = normalizeCabinetType(getCabinetTypeSource(cabinet));
    const selected = String(doctorCabinetId || doctor?.cabinet || "") === String(backendId || value)
      || String(doctor?.cabinet || "") === String(cabinet.name);
    return `<option value="${escapeHtml(value)}" data-backend-id="${escapeHtml(backendId)}" data-cabinet-type="${escapeHtml(cabinetType)}" data-cabinet-name="${escapeHtml(cabinet.name)}" ${selected ? "selected" : ""}>${escapeHtml(cabinet.name)} · ${escapeHtml(cabinetType)}</option>`;
  }).join("");
}

function renderDoctorInlineSummary(doctor, isEditing) {
  if (!isEditing) {
    return `
      <div class="details-list">
        <div class="details-row"><dt>Imię i nazwisko</dt><dd>${escapeHtml(doctorFullName(doctor))}</dd></div>
        <div class="details-row"><dt>Specjalizacja</dt><dd>${escapeHtml(doctor.specialization || "Brak danych")}</dd></div>
        <div class="details-row"><dt>Telefon</dt><dd>${escapeHtml(doctor.phone || "Brak danych")}</dd></div>
        <div class="details-row"><dt>Email</dt><dd>${escapeHtml(doctor.email || "Brak danych")}</dd></div>
        <div class="details-row"><dt>Gabinet</dt><dd>${escapeHtml(getDoctorCabinetName(doctor))}</dd></div>
        <div class="details-row"><dt>Status</dt><dd>${doctorStatusBadge(doctor)}</dd></div>
      </div>
    `;
  }

  return `
    <div class="doctor-inline-edit-grid">
      <label>Imię<input name="firstName" value="${escapeHtml(doctor?.firstName || "")}" required></label>
      <label>Nazwisko<input name="lastName" value="${escapeHtml(doctor?.lastName || "")}" required></label>
      <label>Specjalizacja<select name="specialization" required>${renderDoctorSpecializationOptions(doctor?.specialization || doctorSpecializations[0])}</select></label>
      <label>Telefon<input name="phone" value="${escapeHtml(doctor?.phone || "")}" inputmode="numeric" autocomplete="tel"></label>
      <label>E-mail<span class="doctor-email-field"><input name="email" type="text" value="${escapeHtml(formatDoctorEmail(doctor?.email || ""))}" data-doctor-email><span>${DOCTOR_EMAIL_DOMAIN}</span></span></label>
      <label>Gabinet<select name="cabinet"><option value="">Brak gabinetu</option>${renderDoctorCabinetOptions(doctor, doctor?.specialization)}</select></label>
      <label>Status<select name="status">
        ${["Aktywny", "Nieaktywny", "Urlop"].map((status) => `<option value="${status}" ${doctorBaseStatusLabel(doctor) === status ? "selected" : ""}>${status}</option>`).join("")}
      </select></label>
    </div>
  `;
}

function renderDoctorCard(doctorId, mode = "view") {
  const view = document.querySelector("#doctorCardView");
  if (!view) return;

  const doctor = mode === "create" ? getBlankDoctor() : findDoctorById(doctorId) || currentUserDoctorProfile() || doctors[0] || null;
  if (!doctor) {
    view.innerHTML = `<section class="empty-state">Brak wybranego lekarza.</section>`;
    return;
  }

  if (mode !== "create") selectedDoctorId = getDoctorEntityId(doctor);
  doctorCardMode = mode;

  if (mode === "create") {
    view.innerHTML = renderDoctorForm(doctor, mode);
    bindPolishPhoneInputs(view);
    bindDoctorEmailInputs(view);
    bindDoctorCardEvents(view, doctor, mode);
    return;
  }

  const isEditing = mode === "edit";
  const assignedServices = getDoctorAssignedServices(doctor);
  const upcomingVisits = getDoctorUpcomingAppointments(doctor);
  const schedule = getDoctorSchedule(doctor);
  const formOpen = isEditing ? `<form class="doctor-card-inline-form" data-doctor-form>` : "";
  const formClose = isEditing ? `
    <input type="hidden" name="schedule" value="${escapeHtml(JSON.stringify(schedule))}">
    <input type="hidden" name="avatarDataUrl" data-doctor-avatar-field value="${escapeHtml(doctor.avatarDataUrl || doctor.avatar_data_url || "")}">
    <p class="form-status" data-doctor-form-status></p>
  </form>` : "";

  view.innerHTML = `
    ${formOpen}
    <section class="doctor-profile-header card">
      <div class="profile-hero">
        <div class="hero-person">
          <div class="doctor-inline-avatar" data-doctor-avatar-preview>
            ${renderDoctorAvatar(isEditing && doctorPendingAvatarDataUrl ? { ...doctor, avatarDataUrl: doctorPendingAvatarDataUrl } : doctor, { size: 112 })}
            ${isEditing ? `
              <button class="secondary-button doctor-avatar-button" type="button" data-doctor-avatar-change>Zmień zdjęcie</button>
              <input class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" data-doctor-avatar-input>
              <span class="doctor-avatar-status" data-doctor-avatar-status></span>
            ` : ""}
          </div>
          <div>
            <h1>${escapeHtml(doctorFullName(doctor))}</h1>
            ${doctorStatusBadge(doctor)}
            <div class="meta-line">
              <span>${escapeHtml(doctor.specialization || "Brak specjalizacji")}</span>
              <span>☎ ${escapeHtml(doctor.phone || "Brak telefonu")}</span>
              <span>✉ ${escapeHtml(doctor.email || "Brak e-maila")}</span>
              <span>Gabinet: ${escapeHtml(getDoctorCabinetName(doctor))}</span>
            </div>
          </div>
        </div>
        <div class="patient-card-actions">
          ${authRoleKey(currentUser.role) === "recepcja" && !isEditing ? `<button class="secondary-button" type="button" data-doctor-edit-card>Edytuj dane</button><button class="secondary-button" type="button" data-doctor-schedule-edit>Edytuj harmonogram</button>` : ""}
          ${authRoleKey(currentUser.role) === "recepcja" && isEditing ? `<button class="secondary-button" type="button" data-doctor-cancel>Anuluj</button><button class="primary-button" type="submit">Zapisz zmiany</button>` : ""}
          <button class="secondary-button icon-only" type="button" data-back-doctors aria-label="Powrót do listy lekarzy" title="Powrót do listy lekarzy">${uiIcon("back")}</button>
        </div>
      </div>
      <nav class="doctor-card-tabs" data-doctor-card-nav>
        <button class="active" type="button" data-target="doctor-summary-section">Podsumowanie</button>
        <button type="button" data-target="doctor-schedule-section">Harmonogram pracy</button>
        <button type="button" data-target="doctor-services-section">Usługi</button>
        <button type="button" data-target="doctor-visits-section">Wizyty</button>
        <button type="button" data-target="doctor-absences-section">Nieobecności</button>
        <button type="button" data-target="doctor-stats-section">Statystyki</button>
      </nav>
    </section>
    <section class="doctor-card-sections">
      <section class="doctor-anchor-section card" id="doctor-summary-section">
        <h3>Informacje podstawowe</h3>
        ${renderDoctorInlineSummary(doctor, isEditing)}
      </section>
      <section class="doctor-anchor-section card" id="doctor-schedule-section">
        <h3>Harmonogram pracy</h3>
        ${renderDoctorScheduleRows(doctor)}
      </section>
      <section class="doctor-anchor-section card" id="doctor-services-section">
        <h3>Usługi wykonywane przez lekarza</h3>
        ${assignedServices.length ? assignedServices.map((service) => `<div class="history-service-row"><span>${escapeHtml(serviceName(service))}</span><strong>${escapeHtml(service.durationMinutes || 30)} min</strong></div>`).join("") : `<p class="empty-note">Brak przypisanych usług dla specjalizacji.</p>`}
      </section>
      <section class="doctor-anchor-section card" id="doctor-visits-section">
        <h3>Najbliższe wizyty</h3>
        ${renderDoctorUpcomingVisits(doctor)}
      </section>
      <section class="doctor-anchor-section card" id="doctor-stats-section">
        <h3>Statystyki</h3>
        <div class="doctor-stats form-grid">
          <div><b>${upcomingVisits.length}</b><span>Nadchodzące wizyty</span></div>
          <div><b>${appointments.filter((appointment) => isAppointmentForDoctor(appointment, getDoctorEntityId(doctor))).length}</b><span>Wszystkie wizyty</span></div>
          <div><b>${assignedServices.length}</b><span>Usługi</span></div>
        </div>
      </section>
      <section class="doctor-anchor-section card" id="doctor-absences-section">
        <div class="section-title-row">
          <h3>Nieobecności</h3>
          <button class="doctor-absence-add-button" type="button" data-doctor-absence-add="${escapeHtml(getDoctorEntityId(doctor))}" aria-label="Dodaj nieobecność" title="Dodaj nieobecność"></button>
        </div>
        ${renderDoctorAbsences(doctor)}
      </section>
    </section>
    ${formClose}
  `;

  bindPolishPhoneInputs(view);
  bindDoctorEmailInputs(view);
  bindDoctorCardEvents(view, doctor, mode);
}

function renderDoctorAbsences(doctor) {
  const doctorId = String(getDoctorEntityId(doctor));
  const items = doctorAbsences
    .filter((absence) => String(absence.doctorId) === doctorId)
    .sort((a, b) => `${b.dateFrom} ${b.timeFrom || ""}`.localeCompare(`${a.dateFrom} ${a.timeFrom || ""}`));

  if (!items.length) {
    return `<p class="empty-note compact">Brak zarejestrowanych nieobecności.</p>`;
  }

  return `
    <div class="doctor-absence-list">
      ${items.map((absence) => `
        <div class="doctor-absence-row ${absence.status === "cancelled" ? "cancelled" : ""}">
          <div>
            <strong>${escapeHtml(absence.type)}</strong>
            <span>${escapeHtml(renderAbsenceDateRange(absence))}</span>
            ${absence.note ? `<small>${escapeHtml(absence.note)}</small>` : ""}
          </div>
          <span class="status ${absence.status === "active" ? "warning" : "inactive"}">${absence.status === "active" ? "Aktywna" : "Anulowana"}</span>
          ${absence.status === "active" ? `<button class="secondary-button compact" type="button" data-doctor-absence-cancel="${escapeHtml(absence.id)}">Anuluj nieobecność</button>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function bindDoctorCardEvents(view, doctor, mode) {
  view.querySelector("[data-back-doctors]")?.addEventListener("click", () => showView("doctors"));
  view.querySelector("[data-doctor-edit-card]")?.addEventListener("click", () => openDoctorCard(getDoctorEntityId(doctor), "edit"));
  view.querySelector("[data-doctor-schedule-edit]")?.addEventListener("click", () => openDoctorScheduleEditor(doctor));
  view.querySelector("[data-doctor-absence-add]")?.addEventListener("click", () => openDoctorAbsenceModal(doctor));
  view.querySelectorAll("[data-doctor-absence-cancel]").forEach((button) => {
    button.addEventListener("click", () => cancelDoctorAbsence(button.dataset.doctorAbsenceCancel, doctor));
  });
  view.querySelector("[data-doctor-cancel]")?.addEventListener("click", cancelDoctorEdit);
  const doctorForm = view.querySelector("[data-doctor-form]");
  doctorForm?.addEventListener("submit", (event) => saveDoctor(event, mode, doctor));
  doctorForm?.elements.specialization?.addEventListener("change", () => {
    const cabinetSelect = doctorForm.elements.cabinet;
    if (!cabinetSelect) return;
    const currentValue = cabinetSelect.value;
    const currentBackendId = cabinetSelect.selectedOptions?.[0]?.dataset.backendId || "";
    const specialization = doctorForm.elements.specialization.value;
    cabinetSelect.innerHTML = `<option value="">Brak gabinetu</option>${renderDoctorCabinetOptions({ ...doctor, cabinet_id: currentValue, cabinet: currentValue }, specialization)}`;
    setSelectValueByIdOrValue(cabinetSelect, currentBackendId || currentValue);
    setDoctorEditDirty(doctorForm);
  });

  if (mode === "edit" && doctorForm) {
    doctorEditInitialSnapshot = getDoctorEditSnapshot(doctorForm);
    doctorEditHasUnsavedChanges = false;
    doctorForm.addEventListener("input", () => setDoctorEditDirty(doctorForm));
    doctorForm.addEventListener("change", () => setDoctorEditDirty(doctorForm));
  } else if (mode !== "edit") {
    clearDoctorEditDirtyState();
  }

  const avatarInput = view.querySelector("[data-doctor-avatar-input]");
  view.querySelector("[data-doctor-avatar-change]")?.addEventListener("click", () => avatarInput?.click());
  avatarInput?.addEventListener("change", (event) => {
    const file = event.currentTarget.files?.[0];
    if (file) openDoctorAvatarCropper(file, view, doctorForm);
    event.currentTarget.value = "";
  });

  const navButtons = Array.from(view.querySelectorAll("[data-doctor-card-nav] button"));
  const anchorSections = Array.from(view.querySelectorAll(".doctor-anchor-section"));
  const setActiveDoctorSection = (targetId) => {
    navButtons.forEach((button) => button.classList.toggle("active", button.dataset.target === targetId));
    anchorSections.forEach((section) => section.classList.toggle("active", section.id === targetId));
  };

  setActiveDoctorSection("doctor-summary-section");

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = view.querySelector(`#${button.dataset.target}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveDoctorSection(button.dataset.target);
    });
  });

  if ("IntersectionObserver" in window && navButtons.length) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      setActiveDoctorSection(visible.target.id);
    }, { threshold: [0.35, 0.6], rootMargin: "-120px 0px -45% 0px" });
    anchorSections.forEach((section) => observer.observe(section));
  }
}

function buildDoctorPayloadFromForm(form, existingDoctor = null) {
  formatPolishPhoneFields(form);
  const cabinet = getSelectedDoctorCabinetFromForm(form);
  const cabinetId = cabinet?.cabinet_id ?? cabinet?.id ?? null;
  const firstName = String(form.elements.firstName?.value || "").trim();
  const lastName = String(form.elements.lastName?.value || "").trim();
  const specialization = String(form.elements.specialization?.value || "").trim();
  const email = getDoctorEmailSubmitValue(form.elements.email);
  const schedule = normalizeScheduleValue(form.elements.schedule?.value) || existingDoctor?.schedule || getDefaultDoctorSchedule();

  return {
    id: existingDoctor?.id || `doctor-${Date.now()}`,
    doctor_id: existingDoctor?.doctor_id ?? existingDoctor?.id ?? null,
    firstName,
    lastName,
    first_name: firstName,
    last_name: lastName,
    name: `${firstName} ${lastName}`.trim(),
    specialization,
    phone: String(form.elements.phone?.value || "").trim(),
    email,
    cabinet: cabinet?.name || "",
    cabinet_name: cabinet?.name || "",
    cabinetName: cabinet?.name || "",
    cabinet_id: cabinetId,
    cabinetId,
    cabinet_type: cabinet ? normalizeCabinetType(getCabinetTypeSource(cabinet)) : "",
    status: form.elements.status?.value || "Aktywny",
    avatarDataUrl: String(form.elements.avatarDataUrl?.value || existingDoctor?.avatarDataUrl || existingDoctor?.avatar_data_url || ""),
    avatar_data_url: String(form.elements.avatarDataUrl?.value || existingDoctor?.avatarDataUrl || existingDoctor?.avatar_data_url || ""),
    schedule,
  };
}

function setDoctorAvatarError(view, message = "") {
  const status = view?.querySelector("[data-doctor-avatar-status]");
  if (status) status.textContent = message;
}

function openDoctorAvatarCropper(file, view, form) {
  setDoctorAvatarError(view, "");
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    setDoctorAvatarError(view, "Nieprawidłowy format pliku.");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    setDoctorAvatarError(view, "Zdjęcie jest za duże. Maksymalny rozmiar to 2 MB.");
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => setDoctorAvatarError(view, "Nie udało się wczytać zdjęcia.");
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => setDoctorAvatarError(view, "Nie udało się wczytać zdjęcia.");
    image.onload = () => renderDoctorAvatarCropper(image, view, form);
    image.src = String(reader.result || "");
  };
  reader.readAsDataURL(file);
}

function renderDoctorAvatarCropper(image, view, form) {
  document.querySelector("[data-doctor-cropper]")?.remove();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.dataset.doctorCropper = "true";
  backdrop.innerHTML = `
    <div class="modal doctor-crop-modal" role="dialog" aria-modal="true">
      <div class="modal-heading">
        <h2>Kadrowanie zdjęcia</h2>
        <button class="modal-close" type="button" data-crop-cancel>×</button>
      </div>
      <div class="doctor-crop-body">
        <div class="doctor-crop-area" data-crop-area>
          <canvas width="360" height="360" data-crop-canvas></canvas>
          <div class="doctor-crop-grid"></div>
        </div>
        <label class="doctor-zoom-label">Przybliżenie
          <input type="range" min="1" max="3" step="0.01" value="1" data-crop-zoom>
        </label>
      </div>
      <div class="doctor-crop-actions modal-actions">
        <button class="secondary-button" type="button" data-crop-cancel>Anuluj</button>
        <button class="primary-button" type="button" data-crop-apply>Zastosuj</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const canvas = backdrop.querySelector("[data-crop-canvas]");
  const zoomInput = backdrop.querySelector("[data-crop-zoom]");
  const area = backdrop.querySelector("[data-crop-area]");
  const ctx = canvas.getContext("2d");
  const state = { zoom: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 };

  const draw = () => {
    const size = canvas.width;
    const coverScale = Math.max(size / image.width, size / image.height);
    const scale = coverScale * state.zoom;
    const width = image.width * scale;
    const height = image.height * scale;
    const minX = size - width;
    const minY = size - height;
    state.x = Math.min(0, Math.max(minX, state.x || (size - width) / 2));
    state.y = Math.min(0, Math.max(minY, state.y || (size - height) / 2));
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(image, state.x, state.y, width, height);
  };

  zoomInput.addEventListener("input", () => {
    state.zoom = Number(zoomInput.value || 1);
    draw();
  });

  area.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.originX = state.x;
    state.originY = state.y;
    area.setPointerCapture?.(event.pointerId);
  });
  area.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    state.x = state.originX + event.clientX - state.startX;
    state.y = state.originY + event.clientY - state.startY;
    draw();
  });
  area.addEventListener("pointerup", () => { state.dragging = false; });
  area.addEventListener("pointercancel", () => { state.dragging = false; });

  backdrop.querySelectorAll("[data-crop-cancel]").forEach((button) => button.addEventListener("click", () => backdrop.remove()));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) backdrop.remove();
  });
  backdrop.querySelector("[data-crop-apply]")?.addEventListener("click", () => {
    const output = document.createElement("canvas");
    output.width = 256;
    output.height = 256;
    output.getContext("2d").drawImage(canvas, 0, 0, 256, 256);
    const dataUrl = output.toDataURL("image/jpeg", 0.85);
    doctorPendingAvatarDataUrl = dataUrl;
    const hidden = form?.elements.avatarDataUrl || view.querySelector("[data-doctor-avatar-field]");
    if (hidden) hidden.value = dataUrl;
    const preview = view.querySelector("[data-doctor-avatar-preview]");
    if (preview) {
      const doctor = findDoctorById(selectedDoctorId) || {};
      preview.querySelector(".doctor-avatar, .doctor-photo-avatar, img.doctor-avatar")?.remove();
      preview.insertAdjacentHTML("afterbegin", renderDoctorAvatar({ ...doctor, avatarDataUrl: dataUrl }, { size: doctorCardMode === "create" ? 96 : 112 }));
    }
    setDoctorEditDirty(form);
    backdrop.remove();
  });

  draw();
}

async function saveDoctor(event, mode = doctorCardMode, existingDoctor = null) {
  event?.preventDefault?.();
  const form = event?.currentTarget || document.querySelector("[data-doctor-form]");
  if (!form) return;

  clearFieldErrors(form);
  const firstName = String(form.elements.firstName?.value || "").trim();
  const lastName = String(form.elements.lastName?.value || "").trim();
  const specialization = String(form.elements.specialization?.value || "").trim();
  const email = getDoctorEmailSubmitValue(form.elements.email);
  const status = form.querySelector("[data-doctor-form-status]");

  if (!firstName || !lastName || !specialization) {
    if (!firstName) setFieldError(form.elements.firstName, "Podaj imię.");
    if (!lastName) setFieldError(form.elements.lastName, "Podaj nazwisko.");
    if (!specialization) setFieldError(form.elements.specialization, "Podaj specjalizację.");
    setStatus(status, "Uzupełnij wymagane pola.");
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError(form.elements.email, "Podaj poprawny adres e-mail.");
    setStatus(status, "Popraw błędy w formularzu.");
    return;
  }
  const selectedCabinet = getSelectedDoctorCabinetFromForm(form);
  if (selectedCabinet && !isCabinetCompatibleWithSpecialization(selectedCabinet, specialization)) {
    setFieldError(form.elements.cabinet, "Wybierz gabinet zgodny ze specjalizacją.");
    setStatus(status, "Wybrany gabinet nie pasuje do specjalizacji lekarza.");
    return;
  }

  const payload = buildDoctorPayloadFromForm(form, mode === "create" ? null : existingDoctor);
  let normalized = normalizeDoctor(payload);
  let backendSaved = false;

  try {
    const endpoint = mode === "create" ? "backend/api/doctors.php" : `backend/api/doctors.php?id=${encodeURIComponent(existingDoctor?.doctor_id ?? existingDoctor?.id ?? payload.id)}`;
    const response = await apiRequest(endpoint, {
      method: mode === "create" ? "POST" : "PUT",
      body: payload,
    });
    const returned = response.doctor || response.data?.doctor || response.data || response;
    normalized = normalizeDoctor({
      ...payload,
      ...returned,
      cabinet: payload.cabinet,
      cabinet_name: payload.cabinet_name,
      cabinetName: payload.cabinetName,
      cabinet_id: payload.cabinet_id,
      cabinetId: payload.cabinetId,
      cabinet_type: payload.cabinet_type,
    }) || normalized;
    backendSaved = true;
  } catch {
    backendSaved = false;
  }

  if (!normalized) {
    setStatus(status, "Nie udało się zapisać lekarza.");
    return;
  }

  const index = doctors.findIndex((doctor) => String(doctor.id ?? doctor.doctor_id) === String(existingDoctor?.id ?? existingDoctor?.doctor_id ?? normalized.id));
  if (index >= 0) doctors[index] = { ...doctors[index], ...normalized };
  else doctors.push(normalized);

  saveCollection(storageKeys.doctors, doctors);
  populateDoctorFields(doctors);
  selectedDoctorId = getDoctorEntityId(normalized);
  doctorCardMode = "view";
  clearDoctorEditDirtyState();
  setStatus(status, backendSaved ? "Lekarz zapisany w bazie danych." : "Backend niedostępny. Lekarz zapisany lokalnie.");
  updateCurrentUser(currentUser);
  renderDoctorCard(selectedDoctorId, "view");
  if (activeView === "doctors") renderDoctors();
  renderCalendar();
}

function cancelDoctorEdit() {
  if (doctorCardMode === "create") {
    clearDoctorEditDirtyState();
    showView("doctors");
    return;
  }
  doctorCardMode = "view";
  clearDoctorEditDirtyState();
  renderDoctorCard(selectedDoctorId, "view");
}

function toggleDoctorStatus(doctorId) {
  const doctor = findDoctorById(doctorId);
  if (!doctor) return;
  doctor.status = isDoctorActive(doctor) ? "Nieaktywny" : "Aktywny";
  doctor.isActive = isDoctorActive(doctor);
  saveCollection(storageKeys.doctors, doctors);
  populateDoctorFields(doctors);
  renderDoctors();
  renderCalendar();
}

function openDoctorScheduleEditor(doctor) {
  if (!doctor) return;
  const schedule = getDoctorSchedule(doctor);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.dataset.doctorScheduleModal = "true";
  backdrop.innerHTML = `
    <div class="modal doctor-schedule-modal" role="dialog" aria-modal="true">
      <div class="modal-heading">
        <h2>Edytuj harmonogram</h2>
        <button class="modal-close" type="button" data-close-schedule>×</button>
      </div>
      <form class="doctor-schedule-form" data-doctor-schedule-form>
        <div class="doctor-schedule-grid">
          ${doctorScheduleDays.map((day) => {
            const entry = normalizeWorkingWindow(schedule[day.key], getDefaultDoctorSchedule()[day.key]);
            const active = Boolean(entry?.active);
            return `
              <div class="schedule-row">
                <label class="schedule-active"><input type="checkbox" name="${day.key}_active" ${active ? "checked" : ""}> ${day.label}</label>
                <label>Od<input type="time" name="${day.key}_start" value="${escapeHtml(entry?.start || "08:00")}"></label>
                <label>Do<input type="time" name="${day.key}_end" value="${escapeHtml(entry?.end || "16:00")}"></label>
              </div>
            `;
          }).join("")}
        </div>
        <div class="modal-actions">
          <button class="secondary-button" type="button" data-close-schedule>Anuluj</button>
          <button class="primary-button" type="submit">Zapisz harmonogram</button>
        </div>
        <p class="form-status" data-schedule-status></p>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelectorAll("[data-close-schedule]").forEach((button) => button.addEventListener("click", close));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector("[data-doctor-schedule-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveDoctorSchedule(doctor, event.currentTarget, backdrop);
  });
}

function readScheduleForm(form) {
  const schedule = {};
  doctorScheduleDays.forEach((day) => {
    schedule[day.key] = {
      active: Boolean(form.elements[`${day.key}_active`]?.checked),
      start: formatTime(form.elements[`${day.key}_start`]?.value || "08:00"),
      end: formatTime(form.elements[`${day.key}_end`]?.value || "16:00"),
    };
  });
  return schedule;
}

async function saveDoctorSchedule(doctor, form, backdrop) {
  const schedule = readScheduleForm(form);
  const status = form.querySelector("[data-schedule-status]");
  const payload = { ...doctor, schedule, schedule_json: JSON.stringify(schedule) };
  let savedDoctor = normalizeDoctor(payload);

  try {
    const response = await apiRequest(`backend/api/doctors.php?id=${encodeURIComponent(doctor.doctor_id ?? doctor.id)}`, {
      method: "PUT",
      body: payload,
    });
    savedDoctor = normalizeDoctor({ ...payload, ...(response.doctor || response.data?.doctor || response.data || {}) }) || savedDoctor;
  } catch {
    let localSchedules = {};
    try {
      localSchedules = JSON.parse(localStorage.getItem("doctorSchedules") || "{}") || {};
    } catch {
      localSchedules = {};
    }
    localSchedules[String(doctor.id ?? doctor.doctor_id)] = schedule;
    localStorage.setItem("doctorSchedules", JSON.stringify(localSchedules));
  }

  const index = doctors.findIndex((item) => String(item.id ?? item.doctor_id) === String(doctor.id ?? doctor.doctor_id));
  if (index >= 0 && savedDoctor) doctors[index] = { ...doctors[index], ...savedDoctor, schedule };
  saveCollection(storageKeys.doctors, doctors);
  populateDoctorFields(doctors);
  setStatus(status, "Harmonogram zapisany.");
  backdrop?.remove();
  renderDoctorCard(getDoctorEntityId(doctors[index] || doctor), "view");
  renderCalendar();
}

function openDoctorAbsenceModal(doctor) {
  if (!doctor) return;
  const doctorId = getDoctorEntityId(doctor);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.dataset.doctorAbsenceModal = "true";
  backdrop.innerHTML = `
    <div class="modal doctor-absence-modal" role="dialog" aria-modal="true" aria-label="Dodaj nieobecność lekarza">
      <div class="modal-heading doctor-absence-heading">
        <div class="doctor-absence-heading-main">
          <span class="doctor-absence-heading-icon">${uiIcon("calendar")}</span>
          ${renderDoctorAvatar(doctor, { size: 48 })}
          <div>
            <h2>Dodaj nieobecność</h2>
            <p>${escapeHtml(doctorFullName(doctor))} · ${escapeHtml(doctor?.specialization || "Lekarz")}</p>
          </div>
        </div>
        <button class="modal-close" type="button" data-close-absence aria-label="Zamknij">×</button>
      </div>
      <form class="doctor-absence-form" data-doctor-absence-form>
        <div class="absence-modal-body">
          <section class="absence-form-card">
            <span class="absence-form-label">Typ nieobecności</span>
            <select name="type" required>
              ${doctorAbsenceTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}
            </select>
          </section>
          <section class="absence-form-card">
            <span class="absence-form-label">Zakres</span>
            <div class="absence-mode-toggle">
              <label><input type="radio" name="absenceMode" value="full" checked data-absence-full-mode> Cały dzień / dni</label>
              <label><input type="radio" name="absenceMode" value="time"> Zakres godzin</label>
            </div>
            <p class="absence-appointment-hint" data-absence-appointment-hint hidden></p>
          </section>
          <section class="absence-form-card absence-date-range">
            <span class="absence-form-label">Daty</span>
            <label>Od dnia<input type="date" name="dateFrom" required value="${escapeHtml(today())}"></label>
            <label>Do dnia<input type="date" name="dateTo" required value="${escapeHtml(today())}"></label>
          </section>
          <section class="absence-form-card absence-time-range is-disabled" data-absence-time-range>
            <span class="absence-form-label">Godziny nieobecności</span>
            <label>Od godziny<input type="time" name="timeFrom" disabled></label>
            <label>Do godziny<input type="time" name="timeTo" disabled></label>
          </section>
          <section class="absence-form-card">
            <span class="absence-form-label">Notatka</span>
            <textarea name="note" rows="3" placeholder="Opcjonalna informacja dla recepcji"></textarea>
          </section>
        </div>
        <p class="form-message" data-doctor-absence-status></p>
        <div class="modal-actions doctor-absence-actions">
          <button class="secondary-button" type="button" data-close-absence>Anuluj</button>
          <button class="primary-button" type="submit">Zapisz nieobecność</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelectorAll("[data-close-absence]").forEach((button) => button.addEventListener("click", () => backdrop.remove()));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) backdrop.remove();
  });
  const modeInputs = backdrop.querySelectorAll('input[name="absenceMode"]');
  const timeRange = backdrop.querySelector("[data-absence-time-range]");
  const dateFromInput = backdrop.querySelector('input[name="dateFrom"]');
  const dateToInput = backdrop.querySelector('input[name="dateTo"]');
  const fullModeInput = backdrop.querySelector("[data-absence-full-mode]");
  const timedModeInput = backdrop.querySelector('input[name="absenceMode"][value="time"]');
  const timeFromInput = backdrop.querySelector('input[name="timeFrom"]');
  const timeToInput = backdrop.querySelector('input[name="timeTo"]');
  const appointmentHint = backdrop.querySelector("[data-absence-appointment-hint]");
  const syncAppointmentLimits = () => {
    const dateFrom = String(dateFromInput?.value || "").slice(0, 10);
    const dateTo = String(dateToInput?.value || dateFrom).slice(0, 10);
    const blocking = getDoctorAppointmentsInDateRange(doctorId, dateFrom, dateTo);
    const hasAppointments = blocking.length > 0;
    if (fullModeInput) fullModeInput.disabled = hasAppointments;
    if (hasAppointments && timedModeInput) timedModeInput.checked = true;
    if (appointmentHint) {
      appointmentHint.hidden = !hasAppointments;
      appointmentHint.textContent = hasAppointments
        ? "Lekarz ma już wizyty w wybranym dniu. Nieobecność można dodać tylko jako zakres godzin poza zajętym czasem."
        : "";
    }
    if (timeFromInput) {
      const lastEnd = dateFrom && dateFrom === dateTo ? getDoctorLastAppointmentEndTime(doctorId, dateFrom) : "";
      timeFromInput.min = lastEnd || "";
      if (lastEnd && (!timeFromInput.value || timeToMinutes(timeFromInput.value) < timeToMinutes(lastEnd))) {
        timeFromInput.value = lastEnd;
      }
    }
    syncMode();
  };
  const syncMode = () => {
    const timed = backdrop.querySelector('input[name="absenceMode"]:checked')?.value === "time";
    timeRange?.classList.toggle("is-disabled", !timed);
    timeRange?.querySelectorAll("input").forEach((input) => {
      input.disabled = !timed;
      if (!timed) input.value = "";
    });
  };
  const syncDateRange = () => {
    if (!dateFromInput || !dateToInput) return;
    dateToInput.min = dateFromInput.value || "";
    if (dateFromInput.value && (!dateToInput.value || dateToInput.value < dateFromInput.value)) {
      dateToInput.value = dateFromInput.value;
    }
    syncAppointmentLimits();
  };
  modeInputs.forEach((input) => input.addEventListener("change", syncMode));
  dateFromInput?.addEventListener("change", syncDateRange);
  dateToInput?.addEventListener("change", syncAppointmentLimits);
  syncDateRange();
  syncAppointmentLimits();
  backdrop.querySelector("[data-doctor-absence-form]")?.addEventListener("submit", (event) => saveDoctorAbsence(event, doctorId, backdrop));
}

function getDoctorAppointmentsInDateRange(doctorId, dateFrom, dateTo) {
  if (!doctorId || !dateFrom || !dateTo) return [];
  return appointments
    .filter((appointment) => isAppointmentForDoctor(appointment, doctorId))
    .filter((appointment) => !["Anulowana", "Nieobecny pacjent"].includes(getResolvedAppointmentStatus(appointment)))
    .filter((appointment) => {
      const date = String(appointment.date || appointment.appointment_date || "").slice(0, 10);
      return date && date >= dateFrom && date <= dateTo;
    })
    .sort((a, b) => (appointmentStartDateTime(a)?.getTime() || 0) - (appointmentStartDateTime(b)?.getTime() || 0));
}

function getDoctorLastAppointmentEndTime(doctorId, date) {
  const lastEnd = getDoctorAppointmentsInDateRange(doctorId, date, date)
    .map(appointmentEndDateTime)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return lastEnd ? formatTime(lastEnd) : "";
}

function doctorAbsenceOverlapsAppointments(doctorId, dateFrom, dateTo, timeFrom = "", timeTo = "") {
  const blockingAppointments = getDoctorAppointmentsInDateRange(doctorId, dateFrom, dateTo);
  if (!blockingAppointments.length) return false;
  if (!timeFrom || !timeTo) return true;
  return blockingAppointments.some((appointment) => {
    const date = String(appointment.date || appointment.appointment_date || "").slice(0, 10);
    const absenceStart = combineLocalDateTime(date, timeFrom);
    const absenceEnd = combineLocalDateTime(date, timeTo);
    return Boolean(absenceStart && absenceEnd && appointmentOverlaps(appointment, absenceStart, absenceEnd));
  });
}

async function saveDoctorAbsence(event, doctorId, backdrop) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector("[data-doctor-absence-status]");
  clearFieldErrors(form);
  setStatus(status, "");

  const type = String(form.elements.type?.value || "").trim();
  const absenceMode = String(form.elements.absenceMode?.value || "full");
  const dateFrom = String(form.elements.dateFrom?.value || "").slice(0, 10);
  const dateTo = String(form.elements.dateTo?.value || "").slice(0, 10);
  const timeFrom = absenceMode === "time" ? formatTime(form.elements.timeFrom?.value || "") : "";
  const timeTo = absenceMode === "time" ? formatTime(form.elements.timeTo?.value || "") : "";
  let valid = true;

  if (!doctorId) {
    setStatus(status, "Nie można ustalić lekarza.", "error");
    return;
  }
  if (!type) {
    setFieldError(form.elements.type, "Wybierz typ nieobecności.");
    valid = false;
  }
  if (!dateFrom) {
    setFieldError(form.elements.dateFrom, "Wybierz datę początkową.");
    valid = false;
  }
  if (!dateTo || dateTo < dateFrom) {
    setFieldError(form.elements.dateTo, "Data końcowa nie może być wcześniejsza niż początkowa.");
    valid = false;
  }
  if ((timeFrom && !timeTo) || (!timeFrom && timeTo)) {
    setFieldError(timeFrom ? form.elements.timeTo : form.elements.timeFrom, "Uzupełnij obie godziny albo zostaw obie puste.");
    valid = false;
  }
  if (absenceMode === "time" && (!timeFrom || !timeTo)) {
    setFieldError(!timeFrom ? form.elements.timeFrom : form.elements.timeTo, "Wybierz godziny nieobecności.");
    valid = false;
  }
  if (timeFrom && timeTo && timeToMinutes(timeTo) <= timeToMinutes(timeFrom)) {
    setFieldError(form.elements.timeTo, "Godzina końcowa musi być późniejsza niż początkowa.");
    valid = false;
  }
  if (valid && doctorAbsenceOverlapsAppointments(doctorId, dateFrom, dateTo, timeFrom, timeTo)) {
    if (absenceMode === "time") {
      setFieldError(form.elements.timeFrom, "Zakres nieobecności nakłada się na istniejącą wizytę lekarza.");
      setStatus(status, "Wybierz zakres godzin poza zaplanowanymi wizytami lekarza.", "error");
    } else {
      setStatus(status, "Lekarz ma już wizyty w wybranym dniu. Wybierz zakres godzin poza zajętym czasem.", "error");
    }
    valid = false;
  }
  if (valid && absenceMode === "time" && dateFrom === dateTo) {
    const lastAppointmentEnd = getDoctorLastAppointmentEndTime(doctorId, dateFrom);
    if (lastAppointmentEnd && timeToMinutes(timeFrom) < timeToMinutes(lastAppointmentEnd)) {
      setFieldError(form.elements.timeFrom, `Nieobecność może rozpocząć się najwcześniej po ostatniej wizycie: ${lastAppointmentEnd}.`);
      valid = false;
    }
  }
  if (!valid) return;

  const absence = normalizeDoctorAbsence({
    doctorId,
    type,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    note: form.elements.note?.value || "",
    status: "active",
  });
  if (!absence) {
    setStatus(status, "Nie udało się zapisać nieobecności.", "error");
    return;
  }

  const savedAbsence = await apiPost("backend/api/doctor_absences.php", {
    doctor_id: doctorId,
    doctorId,
    type,
    date_from: dateFrom,
    dateFrom,
    date_to: dateTo,
    dateTo,
    time_from: timeFrom,
    timeFrom,
    time_to: timeTo,
    timeTo,
    note: form.elements.note?.value || "",
    status: "active",
  });

  upsertDoctorAbsence(savedAbsence || absence);
  backdrop?.remove();
  refreshAfterDoctorAbsenceChange(doctorId);
}

async function cancelDoctorAbsence(absenceId, doctor) {
  const absence = doctorAbsences.find((item) => String(item.id) === String(absenceId));
  if (!absence) return;
  const response = await apiPatch("backend/api/doctor_absences.php", {
    id: absenceId,
    status: "cancelled",
  });
  upsertDoctorAbsence(response || { ...absence, status: "cancelled", cancelledAt: new Date().toISOString() });
  refreshAfterDoctorAbsenceChange(getDoctorEntityId(doctor));
}

// ==============================
// Patients and patient card
// ==============================
function patientStatusLabel(patient) {
  if (!isActivePatient(patient)) return "Archiwalny";
  return getPatientProfileStatus(patient) === "complete" ? "Kompletny" : "Niepełny";
}

function patientStatusBadge(patient) {
  const complete = getPatientProfileStatus(patient) === "complete";
  if (!isActivePatient(patient)) return `<span class="status archived">Archiwalny</span>`;
  return `<span class="status ${complete ? "complete" : "incomplete"}">${complete ? "Kompletny" : "Niepełny"}</span>`;
}

function findPatientForAppointment(appointment) {
  const patientId = appointment?.patient_id ?? appointment?.patientId;
  if (patientId) {
    const byId = findPatientById(patientId);
    if (byId) return byId;
  }

  const appointmentName = String(appointment?.patient || appointment?.patient_name || "").trim().toLowerCase();
  if (appointmentName) {
    const byName = patients.find((patient) => patientFullName(patient).toLowerCase() === appointmentName);
    if (byName) return byName;
  }

  return normalizePatient({
    id: patientId || `appointment-patient-${appointment?.id || appointmentName}`,
    name: appointment?.patient || appointment?.patient_name || "Pacjent",
    phone: appointment?.phone || appointment?.patient_phone || "",
    email: appointment?.email || appointment?.patient_email || "",
    profile_status: "incomplete",
  });
}

function isAppointmentForPatient(appointment, patient) {
  if (!appointment || !patient) return false;
  const appointmentPatientId = appointment.patient_id ?? appointment.patientId;
  const patientId = patient.id ?? patient.patient_id;
  if (appointmentPatientId && patientId && String(appointmentPatientId) === String(patientId)) return true;
  const normalizePhoneIdentity = (value) => {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("48")) digits = digits.slice(2);
    return digits;
  };
  const appointmentPhone = normalizePhoneIdentity(appointment.patient_phone || appointment.phone);
  const patientPhone = normalizePhoneIdentity(patient.phone);
  if (appointmentPhone && patientPhone && appointmentPhone === patientPhone) return true;
  const appointmentPesel = String(appointment.patient_pesel || appointment.pesel || "").trim();
  const patientPesel = String(patient.pesel || "").trim();
  if (appointmentPesel && patientPesel && appointmentPesel === patientPesel) return true;
  return String(appointment.patient || "").trim().toLowerCase() === patientFullName(patient).toLowerCase();
}

function getPatientAppointments(patient, { doctorId = null } = {}) {
  return appointments
    .filter((appointment) => isAppointmentForPatient(appointment, patient))
    .filter((appointment) => !doctorId || isAppointmentForDoctor(appointment, doctorId))
    .sort((a, b) => {
      const startA = appointmentStartDateTime(a);
      const startB = appointmentStartDateTime(b);
      return (startA?.getTime() || 0) - (startB?.getTime() || 0);
    });
}

function getDoctorPatients() {
  const doctorId = getCurrentDoctorId();
  if (!doctorId) return [];

  const map = new Map();
  appointments
    .filter((appointment) => isAppointmentForDoctor(appointment, doctorId))
    .forEach((appointment) => {
      const patient = findPatientForAppointment(appointment);
      if (!patient) return;
      const key = String(patient.id ?? patient.patient_id ?? patientFullName(patient));
      if (!map.has(key)) map.set(key, patient);
    });

  return Array.from(map.values());
}

function findPatientForCard(patientId) {
  if (!patientId) return patients[0] || getDoctorPatients()[0] || null;
  return findPatientById(patientId)
    || getDoctorPatients().find((patient) => String(patient.id ?? patient.patient_id) === String(patientId))
    || patients[0]
    || null;
}

function filterPatientsForView(sourcePatients, { doctorMode = false } = {}) {
  const query = patientSearchQuery.trim().toLowerCase();
  return sourcePatients.filter((patient) => {
    const status = getPatientProfileStatus(patient);
    const active = isActivePatient(patient);
    if (patientStatusFilter === "complete" && status !== "complete") return false;
    if (patientStatusFilter === "complete" && !active) return false;
    if (patientStatusFilter === "incomplete" && (status === "complete" || !active)) return false;

    if (!query) return true;

    const haystack = doctorMode
      ? [
          patientFullName(patient),
          patient.notes,
          patient.allergies,
          patient.chronic_diseases,
          patient.chronicDiseases,
        ].join(" ").toLowerCase()
      : [
          patientFullName(patient),
          patient.pesel,
          patient.phone,
          patient.email,
        ].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function getPatientVisitSummary(patient, { doctorId = null } = {}) {
  const patientAppointments = getPatientAppointments(patient, { doctorId });
  const now = new Date();
  const past = patientAppointments
    .filter((appointment) => {
      const start = appointmentStartDateTime(appointment);
      return start && start < now && getResolvedAppointmentStatus(appointment) === "Zrealizowana";
    })
    .sort((a, b) => (appointmentStartDateTime(b)?.getTime() || 0) - (appointmentStartDateTime(a)?.getTime() || 0));
  const upcoming = patientAppointments
    .filter((appointment) => {
      const status = getResolvedAppointmentStatus(appointment);
      const start = appointmentStartDateTime(appointment);
      return ["Zaplanowana", "W trakcie"].includes(status) && (!start || start >= now || status === "W trakcie");
    })
    .sort((a, b) => (appointmentStartDateTime(a)?.getTime() || 0) - (appointmentStartDateTime(b)?.getTime() || 0));

  return {
    count: patientAppointments.length,
    last: past[0] || null,
    next: upcoming[0] || null,
  };
}

function formatAppointmentDateTime(appointment) {
  if (!appointment) return "—";
  const start = appointmentStartDateTime(appointment);
  if (!start) return "Brak danych";
  return `${formatFullDate(start)}, ${formatTime(start)}`;
}

function calculatePatientAge(patient) {
  const birth = patient?.birthDate || patient?.birth_date;
  if (!birth) return "";
  const date = parseLocalDate(birth);
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) age -= 1;
  return Number.isFinite(age) ? `${age} lat` : "";
}

function renderPatientFilterTabs(sourcePatients) {
  const activePatients = sourcePatients.filter(isActivePatient);
  const complete = activePatients.filter((patient) => getPatientProfileStatus(patient) === "complete").length;
  const incomplete = activePatients.filter((patient) => getPatientProfileStatus(patient) !== "complete").length;
  return `
    <div class="patient-filter-tabs" data-patient-filters>
      <button type="button" data-filter="all" class="${patientStatusFilter === "all" ? "active" : ""}">Wszyscy <span>${sourcePatients.length}</span></button>
      <button type="button" data-filter="complete" class="${patientStatusFilter === "complete" ? "active" : ""}">Kompletny <span>${complete}</span></button>
      <button type="button" data-filter="incomplete" class="${patientStatusFilter === "incomplete" ? "active" : ""}">Niepełny <span>${incomplete}</span></button>
    </div>
  `;
}

function renderPatients() {
  if (authRoleKey(currentUser.role) === "lekarz") {
    renderDoctorPatients();
    return;
  }
  renderReceptionPatients();
}

function getPatientSortValue(patient, key, { doctorId = null } = {}) {
  const summary = getPatientVisitSummary(patient, { doctorId });
  if (key === "name") return patientFullName(patient).toLowerCase();
  if (key === "phone") return String(patient.phone || "").toLowerCase();
  if (key === "pesel") return String(patient.pesel || "");
  if (key === "birthDate") return String(patient.birthDate || "");
  if (key === "profileStatus") {
    if (!isActivePatient(patient)) return "2-archiwalny";
    return getPatientProfileStatus(patient) === "complete" ? "0-kompletny" : "1-niepelny";
  }
  if (key === "lastVisit") return appointmentStartDateTime(summary.last)?.getTime() || 0;
  if (key === "nextVisit") return appointmentStartDateTime(summary.next)?.getTime() || 0;
  return "";
}

function sortPatientsForTable(sourcePatients, options = {}) {
  return [...sourcePatients].sort((a, b) => {
    const first = getPatientSortValue(a, patientSortKey, options);
    const second = getPatientSortValue(b, patientSortKey, options);
    const result = typeof first === "number" || typeof second === "number"
      ? Number(first || 0) - Number(second || 0)
      : String(first || "").localeCompare(String(second || ""), "pl", { sensitivity: "base" });
    return patientSortDirection === "asc" ? result : -result;
  });
}

function patientSortButton(key, label) {
  const active = patientSortKey === key;
  const indicator = active ? (patientSortDirection === "asc" ? "↑" : "↓") : "";
  return `<button class="table-sort-button ${active ? "active" : ""}" type="button" data-patient-sort="${escapeHtml(key)}"><span class="sort-title"><span aria-hidden="true"></span><span>${escapeHtml(label)}</span><span class="sort-indicator">${indicator}</span></span></button>`;
}

function rerenderPreservingSearchFocus(renderFn, selector, cursorPosition = null) {
  renderFn();
  requestAnimationFrame(() => {
    const input = document.querySelector(selector);
    if (!input) return;
    input.focus({ preventScroll: true });
    const position = Math.min(Number.isInteger(cursorPosition) ? cursorPosition : input.value.length, input.value.length);
    input.setSelectionRange?.(position, position);
  });
}

function bindPatientsControls(container) {
  container.querySelector("[data-patient-search]")?.addEventListener("input", (event) => {
    patientSearchQuery = event.target.value;
    const cursorPosition = event.target.selectionStart;
    clearTimeout(patientSearchRenderTimer);
    patientSearchRenderTimer = setTimeout(() => {
      rerenderPreservingSearchFocus(renderPatients, "[data-patient-search]", cursorPosition);
    }, 120);
  });

  container.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      patientStatusFilter = button.dataset.filter || "all";
      renderPatients();
    });
  });

  container.querySelectorAll("[data-patient-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.patientSort;
      if (patientSortKey === key) {
        patientSortDirection = patientSortDirection === "asc" ? "desc" : "asc";
      } else {
        patientSortKey = key;
        patientSortDirection = "asc";
      }
      renderPatients();
    });
  });

  container.querySelectorAll("[data-patient-details]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirmPatientCardNavigation()) return;
      selectedPatientId = button.dataset.patientDetails;
      patientCardMode = "view";
      showView("patientCard");
    });
  });

  container.querySelectorAll("[data-patient-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirmPatientCardNavigation()) return;
      selectedPatientId = button.dataset.patientEdit;
      patientCardMode = "edit";
      showView("patientCard");
    });
  });

  container.querySelectorAll("[data-patient-appointment]").forEach((button) => {
    button.addEventListener("click", () => {
      if (canCreateAppointments()) openAppointmentModal({ patientId: button.dataset.patientAppointment });
    });
  });
}

function renderReceptionPatients() {
  const view = document.querySelector("#patientsView");
  if (!view) return;

  const visiblePatients = sortPatientsForTable(filterPatientsForView(patients));

  view.innerHTML = `
    <section class="page-head">
      <div>
        <h1>Pacjenci</h1>
        <p>Zarządzaj danymi pacjentów kliniki.</p>
      </div>
    </section>
    <section class="patient-controls card">
      <div class="patient-control-row">
        <input class="patient-search-input" type="search" data-patient-search value="${escapeHtml(patientSearchQuery)}" placeholder="Szukaj po imieniu, nazwisku, PESEL, telefonie lub e-mailu...">
        <button class="secondary-button" type="button" data-patient-clear>Wyczyść</button>
      </div>
      ${renderPatientFilterTabs(patients)}
    </section>
    <p class="result-count">Znaleziono ${visiblePatients.length} pacjentów</p>
    <section class="table-card patients-table-card">
      <table>
        <thead>
          <tr>
            <th class="patient-col-patient">${patientSortButton("name", "Pacjent")}</th>
            <th class="patient-col-phone">${patientSortButton("phone", "Telefon")}</th>
            <th class="patient-col-pesel">${patientSortButton("pesel", "PESEL")}</th>
            <th class="patient-col-birth">${patientSortButton("birthDate", "Data urodzenia")}</th>
            <th class="patient-col-status">${patientSortButton("profileStatus", "Status profilu")}</th>
            <th class="patient-col-last">${patientSortButton("lastVisit", "Ostatnia wizyta")}</th>
            <th class="patient-col-actions">Akcje</th>
          </tr>
        </thead>
        <tbody>
          ${visiblePatients.length ? visiblePatients.map((patient) => {
            const summary = getPatientVisitSummary(patient);
            return `
              <tr>
                <td class="patient-col-patient"><div class="person-cell">${renderPatientInitials(patientFullName(patient))}<div><strong>${escapeHtml(patientFullName(patient) || "Brak danych")}</strong></div></div></td>
                <td class="patient-col-phone patient-cell-center">${escapeHtml(patient.phone || "Brak danych")}</td>
                <td class="patient-col-pesel patient-cell-center">${escapeHtml(patient.pesel || "—")}</td>
                <td class="patient-col-birth patient-cell-center">${escapeHtml(patient.birthDate || "—")}</td>
                <td class="patient-col-status patient-cell-center">${patientStatusBadge(patient)}</td>
                <td class="patient-col-last patient-cell-center">${escapeHtml(formatAppointmentDateTime(summary.last))}</td>
                <td class="patient-col-actions"><div class="row-actions patients-row-actions"><button class="secondary-button" type="button" data-patient-details="${escapeHtml(patient.id)}">Szczegóły</button><button class="secondary-button" type="button" data-patient-edit="${escapeHtml(patient.id)}">Edytuj</button></div></td>
              </tr>
            `;
          }).join("") : `<tr><td colspan="7"><div class="empty-state">Brak pacjentów do wyświetlenia.</div></td></tr>`}
        </tbody>
      </table>
    </section>
  `;

  view.querySelector("[data-patient-clear]")?.addEventListener("click", () => {
    patientSearchQuery = "";
    patientStatusFilter = "all";
    renderPatients();
  });
  bindPatientsControls(view);
}

function renderDoctorPatients() {
  const view = document.querySelector("#patientsView");
  if (!view) return;

  const doctorId = getCurrentDoctorId();
  const doctorPatients = sortPatientsForTable(filterPatientsForView(getDoctorPatients(), { doctorMode: true }), { doctorId });

  view.innerHTML = `
    <section class="page-head">
      <div>
        <h1>Pacjenci</h1>
        <p>Pacjenci powiązani z Twoimi wizytami.</p>
      </div>
    </section>
    <section class="patient-controls card">
      <div class="patient-control-row">
        <input class="patient-search-input" type="search" data-patient-search value="${escapeHtml(patientSearchQuery)}" placeholder="Szukaj pacjenta lub notatki medycznej...">
        <button class="secondary-button" type="button" data-patient-clear>Wyczyść</button>
      </div>
      ${renderPatientFilterTabs(getDoctorPatients())}
    </section>
    <p class="result-count">Znaleziono ${doctorPatients.length} pacjentów</p>
    <section class="table-card patients-table-card doctor-patients-table">
      <table>
        <thead>
          <tr>
            <th>${patientSortButton("name", "Pacjent")}</th>
            <th class="doctor-patient-col-center">${patientSortButton("birthDate", "Data urodzenia / wiek")}</th>
            <th class="doctor-patient-col-center">${patientSortButton("profileStatus", "Status profilu")}</th>
            <th class="doctor-patient-col-center">${patientSortButton("lastVisit", "Ostatnia wizyta u tego lekarza")}</th>
            <th class="doctor-patient-col-center">${patientSortButton("nextVisit", "Następna wizyta u tego lekarza")}</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          ${doctorPatients.length ? doctorPatients.map((patient) => {
            const summary = getPatientVisitSummary(patient, { doctorId });
            return `
              <tr>
                <td><div class="person-cell">${renderPatientInitials(patientFullName(patient))}<div><strong>${escapeHtml(patientFullName(patient) || "Brak danych")}</strong></div></div></td>
                <td class="doctor-patient-cell-center"><strong>${escapeHtml(patient.birthDate || "—")}</strong>${calculatePatientAge(patient) ? `<span>${escapeHtml(calculatePatientAge(patient))}</span>` : ""}</td>
                <td class="doctor-patient-cell-center">${patientStatusBadge(patient)}</td>
                <td class="doctor-patient-cell-center">${escapeHtml(formatAppointmentDateTime(summary.last))}</td>
                <td class="doctor-patient-cell-center">${escapeHtml(formatAppointmentDateTime(summary.next))}</td>
                <td><div class="row-actions single-action"><button class="secondary-button" type="button" data-patient-details="${escapeHtml(patient.id)}">Szczegóły</button></div></td>
              </tr>
            `;
          }).join("") : `<tr><td colspan="6"><div class="empty-state">Brak pacjentów powiązanych z Twoimi wizytami.</div></td></tr>`}
        </tbody>
      </table>
    </section>
  `;

  view.querySelector("[data-patient-clear]")?.addEventListener("click", () => {
    patientSearchQuery = "";
    patientStatusFilter = "all";
    renderPatients();
  });
  bindPatientsControls(view);
}

function renderPatientVisitRows(patient, { doctorId = null } = {}) {
  const patientAppointments = getPatientAppointments(patient, { doctorId }).sort((a, b) => (appointmentStartDateTime(b)?.getTime() || 0) - (appointmentStartDateTime(a)?.getTime() || 0));
  if (!patientAppointments.length) return `<p class="empty-note">Brak historii wizyt.</p>`;

  return `
    <div class="patient-visit-history">
      ${patientAppointments.map((appointment) => `
        <div class="visit-row">
          <div class="visit-time"><strong>${escapeHtml(formatFullDate(appointmentStartDateTime(appointment)))}</strong><span>${escapeHtml(formatTime(appointment.time || appointment.start_time))}</span></div>
          <div><strong>${escapeHtml(appointment.doctor || doctorFullName(findDoctorByAppointment(appointment)) || "Brak lekarza")}</strong><span>${escapeHtml(appointment.specialization || appointment.serviceName || "Brak usługi")}</span></div>
          <div class="visit-status">${appointmentStatusBadge(appointment)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPatientCard(patientId, mode = "view") {
  const view = document.querySelector("#patientCardView");
  if (!view) return;

  const patient = findPatientForCard(patientId);
  if (!patient) {
    view.innerHTML = `<section class="empty-state">Brak wybranego pacjenta.</section>`;
    return;
  }

  selectedPatientId = patient.id;
  const isDoctor = authRoleKey(currentUser.role) === "lekarz";
  const isEditing = mode === "edit" && !isDoctor;
  patientCardMode = isEditing ? "edit" : "view";
  const doctorId = isDoctor ? getCurrentDoctorId() : null;
  const summary = getPatientVisitSummary(patient, { doctorId });
  const age = calculatePatientAge(patient);
  const bloodGroup = normalizePatientBloodGroup(patient.bloodGroup || patient.blood_group);
  const contactMarkup = isDoctor ? "" : `
    <span>☎ ${escapeHtml(patient.phone || "Brak telefonu")}</span>
    <span>✉ ${escapeHtml(patient.email || "Brak e-maila")}</span>
  `;

  view.innerHTML = `
    <section class="patient-profile-header card">
      <div class="profile-hero">
        <div class="hero-person">
          ${renderPatientInitials(patientFullName(patient))}
          <div>
            <h1>${escapeHtml(patientFullName(patient) || "Pacjent")}</h1>
            ${patientStatusBadge(patient)}
            <div class="meta-line">
              <span>Data urodzenia: ${escapeHtml(patient.birthDate || "Brak danych")}${age ? ` (${escapeHtml(age)})` : ""}</span>
              <span>Płeć: ${escapeHtml(patient.gender || "Brak danych")}</span>
              ${!isDoctor ? `<span>PESEL: ${escapeHtml(patient.pesel || "—")}</span>` : ""}
              ${contactMarkup}
            </div>
          </div>
        </div>
        <div class="patient-card-actions">
          ${isEditing ? `
            <button class="primary-button" type="submit" form="patientInlineEditForm">Zapisz zmiany</button>
            <button class="secondary-button" type="button" data-patient-cancel-edit>Anuluj</button>
          ` : `
            ${!isDoctor && patient.isActive !== false ? `<button class="primary-button" type="button" data-patient-appointment="${escapeHtml(patient.id)}">Nowa wizyta</button>` : ""}
            ${!isDoctor ? `<button class="${patient.isActive === false ? "restore-button" : "archive-button"}" type="button" data-patient-archive-toggle="${escapeHtml(patient.id)}">${patient.isActive === false ? "Przywróć pacjenta" : "Archiwizuj pacjenta"}</button>` : ""}
            ${!isDoctor ? `<button class="secondary-button" type="button" data-patient-edit="${escapeHtml(patient.id)}">Edytuj dane</button>` : ""}
          `}
          <button class="secondary-button icon-only patient-back-button" type="button" data-back-patients aria-label="Powrót do listy pacjentów">${uiIcon("back")}</button>
        </div>
      </div>
      <nav class="patient-card-tabs" data-patient-card-nav>
        <button class="active" type="button" data-target="patient-summary-section">Podsumowanie</button>
        <button type="button" data-target="patient-visits-section">Historia wizyt</button>
        <button type="button" data-target="patient-medical-section">Dane medyczne</button>
        <button type="button" data-target="patient-notes-section">Notatki</button>
      </nav>
    </section>

    ${isEditing ? `<form class="patient-card-inline-form" id="patientInlineEditForm" data-patient-inline-form>` : ""}
    <section class="patient-card-sections">
      <section class="patient-anchor-section card" id="patient-summary-section">
        <h3>Podsumowanie</h3>
        <div class="patient-priority-card">
          <div>
            <span>Dane pacjenta</span>
            <strong>${escapeHtml(patientFullName(patient) || "Brak danych")}</strong>
            <small>
              ${escapeHtml(patient.birthDate || "Brak daty urodzenia")}${age ? ` · ${escapeHtml(age)}` : ""}
              ${patient.gender ? ` · ${escapeHtml(patient.gender)}` : ""}
              ${!isDoctor && patient.pesel ? ` · PESEL ${escapeHtml(patient.pesel)}` : ""}
            </small>
          </div>
          ${patientStatusBadge(patient)}
        </div>
        ${isEditing ? `
          <div class="patient-basic-grid patient-inline-grid">
            <label class="patient-inline-field">Imię<input name="firstName" required value="${escapeHtml(patient.firstName || "")}"></label>
            <label class="patient-inline-field">Nazwisko<input name="lastName" required value="${escapeHtml(patient.lastName || "")}"></label>
            <label class="patient-inline-field">Data urodzenia<input name="birthDate" type="date" value="${escapeHtml(patient.birthDate || "")}"></label>
            <label class="patient-inline-field">Płeć
              <select name="gender">
                <option value="">Wybierz</option>
                <option value="Kobieta" ${normalizePatientGenderDisplay(patient.gender) === "Kobieta" ? "selected" : ""}>Kobieta</option>
                <option value="Mężczyzna" ${normalizePatientGenderDisplay(patient.gender) === "Mężczyzna" ? "selected" : ""}>Mężczyzna</option>
                <option value="Inna" ${normalizePatientGenderDisplay(patient.gender) === "Inna" ? "selected" : ""}>Inna</option>
              </select>
            </label>
            <label class="patient-inline-field">PESEL<input name="pesel" value="${escapeHtml(patient.pesel || "")}" maxlength="11"></label>
            <label class="patient-inline-field">Telefon<input name="phone" type="tel" value="${escapeHtml(patient.phone || "")}"></label>
            <label class="patient-inline-field">E-mail<input name="email" type="email" value="${escapeHtml(patient.email || "")}"></label>
          </div>
          <p class="form-status" data-patient-inline-status></p>
        ` : `
          <div class="patient-basic-grid">
            <div class="details-row"><dt>Imię i nazwisko</dt><dd>${escapeHtml(patientFullName(patient) || "Brak danych")}</dd></div>
            <div class="details-row"><dt>Data urodzenia</dt><dd>${escapeHtml(patient.birthDate || "Brak danych")}${age ? ` · ${escapeHtml(age)}` : ""}</dd></div>
            <div class="details-row"><dt>Płeć</dt><dd>${escapeHtml(patient.gender || "Brak danych")}</dd></div>
            ${!isDoctor ? `<div class="details-row"><dt>PESEL</dt><dd>${escapeHtml(patient.pesel || "Brak danych")}</dd></div>` : ""}
            ${!isDoctor ? `<div class="details-row"><dt>Telefon</dt><dd>${escapeHtml(patient.phone || "Brak danych")}</dd></div>` : ""}
            ${!isDoctor ? `<div class="details-row"><dt>E-mail</dt><dd>${escapeHtml(patient.email || "Brak danych")}</dd></div>` : ""}
          </div>
        `}
        <div class="patient-summary-grid">
          <div><span>Liczba wizyt</span><strong>${summary.count}</strong></div>
          <div><span>Ostatnia wizyta</span><strong>${escapeHtml(formatAppointmentDateTime(summary.last))}</strong></div>
          <div><span>Następna wizyta</span><strong>${escapeHtml(formatAppointmentDateTime(summary.next))}</strong></div>
          <div><span>Status profilu</span><strong>${escapeHtml(patientStatusLabel(patient))}</strong></div>
        </div>
      </section>
      <section class="patient-anchor-section card" id="patient-visits-section">
        <h3>Historia wizyt</h3>
        ${renderPatientVisitRows(patient, { doctorId })}
      </section>
      <section class="patient-anchor-section card" id="patient-medical-section">
        <h3>Dane medyczne</h3>
        ${isEditing ? `
          <div class="details-list patient-inline-medical">
            <label class="patient-inline-field">Grupa krwi${renderPatientBloodGroupSelect(bloodGroup)}</label>
            <label class="patient-inline-field">Ubezpieczyciel<input name="insurer" value="${escapeHtml(patient.insurer || patient.insurance || "")}"></label>
            <label class="patient-inline-field full">Alergie<textarea name="allergies" rows="3">${escapeHtml(patient.allergies || "")}</textarea></label>
            <label class="patient-inline-field full">Przewlekłe choroby<textarea name="chronicDiseases" rows="3">${escapeHtml(patient.chronicDiseases || patient.chronic_diseases || "")}</textarea></label>
          </div>
        ` : `
          <div class="details-list">
            <div class="details-row"><dt>Grupa krwi</dt><dd>${escapeHtml(bloodGroup || "Brak danych")}</dd></div>
            <div class="details-row"><dt>Alergie</dt><dd>${escapeHtml(patient.allergies || "Brak danych")}</dd></div>
            <div class="details-row"><dt>Przewlekłe choroby</dt><dd>${escapeHtml(patient.chronic_diseases || patient.chronicDiseases || "Brak danych")}</dd></div>
            ${!isDoctor ? `<div class="details-row"><dt>Ubezpieczenie</dt><dd>${escapeHtml(patient.insurer || patient.insurance || "Brak danych")}</dd></div>` : ""}
          </div>
        `}
      </section>
      <section class="patient-anchor-section card" id="patient-notes-section">
        <h3>Notatki</h3>
        ${isEditing
          ? `<label class="patient-inline-field full"><textarea name="notes" rows="4">${escapeHtml(patient.notes || "")}</textarea></label>`
          : `<p class="patient-note-text">${escapeHtml(patient.notes || "Brak notatek.")}</p>`}
      </section>
    </section>
    ${isEditing ? `</form>` : ""}
  `;

  bindPatientCardEvents(view, patient, mode);
}

function bindPatientCardEvents(view, patient = null, mode = patientCardMode) {
  view.querySelector("[data-back-patients]")?.addEventListener("click", () => showView("patients"));
  view.querySelector("[data-patient-appointment]")?.addEventListener("click", (event) => {
    if (canCreateAppointments()) openAppointmentModal({ patientId: event.currentTarget.dataset.patientAppointment });
  });
  view.querySelector("[data-patient-edit]")?.addEventListener("click", (event) => {
    selectedPatientId = event.currentTarget.dataset.patientEdit;
    patientCardMode = "edit";
    renderPatientCard(selectedPatientId, "edit");
  });
  view.querySelector("[data-patient-cancel-edit]")?.addEventListener("click", () => {
    clearPatientEditDirtyState();
    patientCardMode = "view";
    renderPatientCard(selectedPatientId, "view");
  });
  view.querySelector("[data-patient-archive-toggle]")?.addEventListener("click", (event) => {
    togglePatientArchive(event.currentTarget.dataset.patientArchiveToggle);
  });
  view.querySelector("[data-patient-inline-form]")?.addEventListener("submit", (event) => savePatientInlineEdit(event, patient));

  const navButtons = Array.from(view.querySelectorAll("[data-patient-card-nav] button"));
  const anchorSections = Array.from(view.querySelectorAll(".patient-anchor-section"));
  let navClickLockUntil = 0;
  const setActivePatientSection = (targetId) => {
    navButtons.forEach((button) => button.classList.toggle("active", button.dataset.target === targetId));
    anchorSections.forEach((section) => section.classList.toggle("active", section.id === targetId));
  };

  setActivePatientSection("patient-summary-section");

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = view.querySelector(`#${button.dataset.target}`);
      navClickLockUntil = Date.now() + 1000;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActivePatientSection(button.dataset.target);
      window.setTimeout(() => setActivePatientSection(button.dataset.target), 450);
    });
  });

  if (patientCardScrollHandler) {
    window.removeEventListener("scroll", patientCardScrollHandler);
    patientCardScrollHandler = null;
  }
  if (patientCardObserver) {
    patientCardObserver.disconnect();
    patientCardObserver = null;
  }

  if ("IntersectionObserver" in window && navButtons.length) {
    patientCardObserver = new IntersectionObserver((entries) => {
      if (Date.now() < navClickLockUntil) return;
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      setActivePatientSection(visible.target.id);
    }, { threshold: [0.35, 0.6], rootMargin: "-120px 0px -45% 0px" });
    anchorSections.forEach((section) => patientCardObserver.observe(section));
  }

  if (mode === "edit") {
    const form = view.querySelector("[data-patient-inline-form]");
    patientEditInitialSnapshot = getPatientEditSnapshot(form);
    patientCardDirty = false;
    form?.addEventListener("input", () => setPatientEditDirty(form));
    form?.addEventListener("change", () => setPatientEditDirty(form));
    bindPolishPhoneInputs(view);
    bindPeselInputs(view);
  }
}

async function savePatientInlineEdit(event, patient) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector("[data-patient-inline-status]");
  clearFieldErrors(form);
  setStatus(status, "");
  formatPolishPhoneFields(form);
  formatPeselFields(form);

  const firstName = form.elements.firstName?.value.trim() || "";
  const lastName = form.elements.lastName?.value.trim() || "";
  const email = form.elements.email?.value.trim() || "";
  const pesel = form.elements.pesel?.value.trim() || "";
  const phoneDigits = extractPolishPhoneDigits(form.elements.phone?.value || "");
  const phoneValue = phoneDigits ? formatPolishPhone(phoneDigits) : "";
  let valid = true;

  if (!firstName) {
    setFieldError(form.elements.firstName, "Podaj imię pacjenta.");
    valid = false;
  }
  if (!lastName) {
    setFieldError(form.elements.lastName, "Podaj nazwisko pacjenta.");
    valid = false;
  }
  if (pesel && !/^\d{11}$/.test(pesel)) {
    setFieldError(form.elements.pesel, "PESEL musi zawierać 11 cyfr.");
    valid = false;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError(form.elements.email, "Podaj poprawny adres e-mail.");
    valid = false;
  }
  if (phoneDigits && phoneDigits.length !== 9) {
    setFieldError(form.elements.phone, "Podaj pełny numer telefonu: 9 cyfr po +48.");
    valid = false;
  }
  if (!valid) return;
  const bloodGroup = normalizePatientBloodGroup(form.elements.bloodGroup?.value);

  let updated = normalizePatient({
    ...patient,
    firstName,
    first_name: firstName,
    lastName,
    last_name: lastName,
    name: `${firstName} ${lastName}`.trim(),
    pesel,
    birthDate: form.elements.birthDate?.value || "",
    birth_date: form.elements.birthDate?.value || "",
    gender: form.elements.gender?.value || "",
    phone: phoneValue,
    email,
    bloodGroup,
    blood_group: bloodGroup,
    insurer: form.elements.insurer?.value.trim() || "",
    allergies: form.elements.allergies?.value.trim() || "",
    chronicDiseases: form.elements.chronicDiseases?.value.trim() || "",
    chronic_diseases: form.elements.chronicDiseases?.value.trim() || "",
    notes: form.elements.notes?.value.trim() || "",
    updatedAt: new Date().toISOString(),
  });

  if (!updated) {
    setStatus(status, "Nie udało się zapisać danych pacjenta.", "error");
    return;
  }

  try {
    updated = await persistPatientUpdate(updated);
  } catch (error) {
    setStatus(status, "Nie udało się zapisać w bazie. Zapisano lokalnie jako kopię roboczą.");
  }

  const index = patients.findIndex((item) => String(item.id) === String(patient.id) || String(item.patient_id) === String(patient.id));
  if (index >= 0) {
    patients[index] = { ...patients[index], ...updated };
  } else {
    patients.push(updated);
  }
  saveCollection(storageKeys.patients, patients);
  selectedPatientId = updated.id;
  clearPatientEditDirtyState();
  patientCardMode = "view";
  renderPatientCard(updated.id, "view");
}

function openPatientEditModal(patientId) {
  const patient = findPatientForCard(patientId);
  if (!patient || authRoleKey(currentUser.role) === "lekarz") return;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.dataset.patientEditModal = "true";
  backdrop.innerHTML = `
    <div class="modal patient-edit-modal" role="dialog" aria-modal="true" aria-label="Edycja danych pacjenta">
      <div class="modal-heading">
        <div>
          <h2>Edytuj dane pacjenta</h2>
          <p>Uzupełnij dane administracyjne i medyczne profilu.</p>
        </div>
        <button class="modal-close" type="button" data-close-patient-edit aria-label="Zamknij">×</button>
      </div>
      <form class="patient-edit-form" data-patient-edit-form>
        <div class="patient-edit-grid">
          <label>Imię<input name="firstName" required value="${escapeHtml(patient.firstName || "")}"></label>
          <label>Nazwisko<input name="lastName" required value="${escapeHtml(patient.lastName || "")}"></label>
          <label>PESEL<input name="pesel" value="${escapeHtml(patient.pesel || "")}" maxlength="11"></label>
          <label>Data urodzenia<input name="birthDate" type="date" value="${escapeHtml(patient.birthDate || "")}"></label>
          <label>Płeć
            <select name="gender">
              <option value="">Wybierz</option>
              <option value="Kobieta" ${normalizePatientGenderDisplay(patient.gender) === "Kobieta" ? "selected" : ""}>Kobieta</option>
              <option value="Mężczyzna" ${normalizePatientGenderDisplay(patient.gender) === "Mężczyzna" ? "selected" : ""}>Mężczyzna</option>
              <option value="Inna" ${normalizePatientGenderDisplay(patient.gender) === "Inna" ? "selected" : ""}>Inna</option>
            </select>
          </label>
          <label>Telefon<input name="phone" type="tel" value="${escapeHtml(patient.phone || "")}"></label>
          <label>E-mail<input name="email" type="email" value="${escapeHtml(patient.email || "")}"></label>
          <label>Grupa krwi${renderPatientBloodGroupSelect(patient.bloodGroup || patient.blood_group)}</label>
          <label>Ubezpieczyciel<input name="insurer" value="${escapeHtml(patient.insurer || patient.insurance || "")}"></label>
          <label class="full">Alergie<textarea name="allergies" rows="3">${escapeHtml(patient.allergies || "")}</textarea></label>
          <label class="full">Przewlekłe choroby<textarea name="chronicDiseases" rows="3">${escapeHtml(patient.chronicDiseases || patient.chronic_diseases || "")}</textarea></label>
          <label class="full">Notatki<textarea name="notes" rows="3">${escapeHtml(patient.notes || "")}</textarea></label>
        </div>
        <p class="form-status" data-patient-edit-status></p>
        <div class="form-actions">
          <button class="secondary-button" type="button" data-close-patient-edit>Anuluj</button>
          <button class="primary-button" type="submit">Zapisz zmiany</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);
  bindPolishPhoneInputs(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelectorAll("[data-close-patient-edit]").forEach((button) => button.addEventListener("click", close));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector("[data-patient-edit-form]")?.addEventListener("submit", (event) => {
    savePatientEdit(event, patient, backdrop);
  });
}

function buildPatientApiPayload(patient, overrides = {}) {
  const merged = { ...patient, ...overrides };
  return {
    id: merged.patient_id || merged.id,
    first_name: String(merged.firstName ?? merged.first_name ?? "").trim(),
    last_name: String(merged.lastName ?? merged.last_name ?? "").trim(),
    pesel: String(merged.pesel || "").trim(),
    birth_date: merged.birthDate || merged.birth_date || null,
    gender: patientGenderToBackend(merged.gender),
    phone: String(merged.phone || "").trim(),
    email: String(merged.email || "").trim(),
    document_number: merged.documentNumber || merged.document_number || null,
    insurer: merged.insurer || merged.insurance || null,
    insurance_number: merged.insuranceNumber || merged.insurance_number || null,
    blood_group: normalizePatientBloodGroup(merged.bloodGroup || merged.blood_group) || null,
    allergies: merged.allergies || null,
    chronic_diseases: merged.chronicDiseases || merged.chronic_diseases || null,
    notes: merged.notes || null,
    personal_data_consent: merged.personal_data_consent || merged.personalDataConsent || 0,
    is_active: merged.isActive === false || merged.is_active === 0 || merged.is_active === false ? 0 : 1,
  };
}

async function persistPatientUpdate(patient, overrides = {}) {
  const payload = buildPatientApiPayload(patient, overrides);
  const response = await apiRequest("backend/api/patients.php", {
    method: "PUT",
    body: payload,
  });
  const returned = response.patient || response.data?.patient || response.data || response;
  return normalizePatient({ ...patient, ...payload, ...returned });
}

async function savePatientEdit(event, patient, backdrop) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector("[data-patient-edit-status]");
  clearFieldErrors(form);
  setStatus(status, "");
  formatPolishPhoneFields(form);

  const firstName = form.elements.firstName?.value.trim() || "";
  const lastName = form.elements.lastName?.value.trim() || "";
  const email = form.elements.email?.value.trim() || "";
  const pesel = form.elements.pesel?.value.trim() || "";
  const phoneDigits = extractPolishPhoneDigits(form.elements.phone?.value || "");
  const phoneValue = phoneDigits ? formatPolishPhone(phoneDigits) : "";
  let valid = true;

  if (!firstName) {
    setFieldError(form.elements.firstName, "Podaj imię pacjenta.");
    valid = false;
  }
  if (!lastName) {
    setFieldError(form.elements.lastName, "Podaj nazwisko pacjenta.");
    valid = false;
  }
  if (pesel && !/^\d{11}$/.test(pesel)) {
    setFieldError(form.elements.pesel, "PESEL musi zawierać 11 cyfr.");
    valid = false;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError(form.elements.email, "Podaj poprawny adres e-mail.");
    valid = false;
  }
  if (phoneDigits && phoneDigits.length !== 9) {
    setFieldError(form.elements.phone, "Podaj pełny numer telefonu: 9 cyfr po +48.");
    valid = false;
  }
  if (!valid) return;

  let updated = normalizePatient({
    ...patient,
    firstName,
    first_name: firstName,
    lastName,
    last_name: lastName,
    name: `${firstName} ${lastName}`.trim(),
    pesel,
    birthDate: form.elements.birthDate?.value || "",
    birth_date: form.elements.birthDate?.value || "",
    gender: form.elements.gender?.value || "",
    phone: phoneValue,
    email,
    bloodGroup: normalizePatientBloodGroup(form.elements.bloodGroup?.value),
    blood_group: normalizePatientBloodGroup(form.elements.bloodGroup?.value),
    insurer: form.elements.insurer?.value.trim() || "",
    allergies: form.elements.allergies?.value.trim() || "",
    chronicDiseases: form.elements.chronicDiseases?.value.trim() || "",
    chronic_diseases: form.elements.chronicDiseases?.value.trim() || "",
    notes: form.elements.notes?.value.trim() || "",
    updatedAt: new Date().toISOString(),
  });

  if (!updated) {
    setStatus(status, "Nie udało się zapisać danych pacjenta.", "error");
    return;
  }

  try {
    updated = await persistPatientUpdate(updated);
  } catch (error) {
    setStatus(status, "Nie udało się zapisać w bazie. Zapisano lokalnie jako kopię roboczą.");
  }

  const index = patients.findIndex((item) => String(item.id) === String(patient.id) || String(item.patient_id) === String(patient.id));
  if (index >= 0) {
    patients[index] = { ...patients[index], ...updated };
  } else {
    patients.push(updated);
  }
  saveCollection(storageKeys.patients, patients);
  selectedPatientId = updated.id;
  backdrop.remove();
  renderPatientCard(updated.id);
}

async function togglePatientArchive(patientId) {
  const patient = findPatientForCard(patientId);
  if (!patient || authRoleKey(currentUser.role) === "lekarz") return;
  const shouldRestore = patient.isActive === false;
  const message = shouldRestore
    ? "Czy na pewno chcesz przywrócić tego pacjenta z archiwum?"
    : "Czy na pewno chcesz zarchiwizować tego pacjenta? Historia wizyt pozostanie zachowana.";
  if (!window.confirm(message)) return;

  let updated = normalizePatient({ ...patient, is_active: shouldRestore ? 1 : 0, isActive: shouldRestore });
  try {
    updated = await persistPatientUpdate(updated, { is_active: shouldRestore ? 1 : 0, isActive: shouldRestore });
  } catch {
    // Backend unavailable: keep local archive state so the UI remains usable.
  }

  const index = patients.findIndex((item) => String(item.id) === String(patient.id) || String(item.patient_id) === String(patient.id));
  if (index >= 0 && updated) {
    patients[index] = { ...patients[index], ...updated, isActive: shouldRestore, is_active: shouldRestore ? 1 : 0 };
  }
  saveCollection(storageKeys.patients, patients);
  selectedPatientId = patient.id;
  if (activeView === "registration") renderRegistration();
  renderAvailableTimeButtons();
  renderPatientCard(patient.id);
}

// ==============================
// Medical services catalog
// ==============================
function getServiceEntityId(service) {
  return service?.id ?? service?.service_id ?? "";
}

function serviceStatusLabel(service) {
  const value = String(service?.status || "").trim().toLowerCase();
  if (value.includes("nie") || value.includes("inactive") || value === "0") return "Nieaktywna";
  return "Aktywna";
}

function serviceStatusBadge(service) {
  const active = serviceStatusLabel(service) === "Aktywna";
  return `<span class="status ${active ? "active" : "inactive"}">${active ? "Aktywna" : "Nieaktywna"}</span>`;
}

function findServiceById(serviceId) {
  if (!serviceId) return null;
  return services.find((service) => String(service.id ?? service.service_id) === String(serviceId)) || null;
}

function filterServicesForView() {
  const query = serviceSearchQuery.trim().toLowerCase();
  return services.filter((service) => {
    const active = serviceStatusLabel(service) === "Aktywna";
    if (serviceStatusFilter === "active" && !active) return false;
    if (serviceStatusFilter === "inactive" && active) return false;
    if (!query) return true;

    return [
      serviceName(service),
      service.specialization,
      service.description,
    ].join(" ").toLowerCase().includes(query);
  }).sort((a, b) => {
    const specializationCompare = String(a.specialization || "").localeCompare(String(b.specialization || ""), "pl", { sensitivity: "base" });
    if (specializationCompare !== 0) return specializationCompare;
    return serviceName(a).localeCompare(serviceName(b), "pl", { sensitivity: "base" });
  });
}

function ensureSelectedService(visibleServices) {
  if (selectedServiceId && visibleServices.some((service) => String(getServiceEntityId(service)) === String(selectedServiceId))) {
    return selectedServiceId;
  }
  selectedServiceId = visibleServices[0] ? String(getServiceEntityId(visibleServices[0])) : null;
  return selectedServiceId;
}

function renderServiceFilterTabs() {
  const active = services.filter((service) => serviceStatusLabel(service) === "Aktywna").length;
  const inactive = Math.max(0, services.length - active);
  const tabs = [
    ["all", "Wszystkie", services.length],
    ["active", "Aktywne", active],
    ["inactive", "Nieaktywne", inactive],
  ];

  return `
    <div class="service-filter-tabs">
      ${tabs.map(([key, label, count]) => `
        <button type="button" data-service-filter="${key}" class="${serviceStatusFilter === key ? "active" : ""}">
          ${label} <span>${count}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function getAppointmentsForService(service) {
  const serviceId = String(service?.id ?? service?.service_id ?? "");
  const serviceLabel = String(serviceName(service)).toLowerCase();
  return appointments
    .filter((appointment) => {
      const appointmentServiceId = appointment.service_id ?? appointment.serviceId;
      if (appointmentServiceId && serviceId) return String(appointmentServiceId) === serviceId;
      const name = String(appointment.serviceName || appointment.specialization || appointment.service || "").toLowerCase();
      return Boolean(serviceLabel && name === serviceLabel);
    })
    .sort((a, b) => (appointmentStartDateTime(b)?.getTime() || 0) - (appointmentStartDateTime(a)?.getTime() || 0));
}

function getDoctorsForService(service) {
  const specialization = normalizeSpecialization(service?.specialization);
  if (!specialization) return [];
  return doctors.filter((doctor) => normalizeSpecialization(doctor.specialization) === specialization);
}

function getServiceSpecializationOptions(selectedValue = "") {
  const values = new Set();
  doctors.forEach((doctor) => {
    const specialization = String(doctor.specialization || "").trim();
    if (specialization) values.add(specialization);
  });
  services.forEach((service) => {
    const specialization = String(service.specialization || "").trim();
    if (specialization) values.add(specialization);
  });
  if (selectedValue) values.add(String(selectedValue).trim());

  return Array.from(values)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pl"))
    .map((specialization) => `<option value="${escapeHtml(specialization)}" ${String(selectedValue) === specialization ? "selected" : ""}>${escapeHtml(specialization)}</option>`)
    .join("");
}

function renderServiceAppointments(service) {
  const serviceAppointments = getAppointmentsForService(service).slice(0, 8);
  if (!serviceAppointments.length) return `<p class="empty-note">Brak wizyt dla tej usługi.</p>`;

  return `
    <div class="patient-visit-history">
      ${serviceAppointments.map((appointment) => {
        const start = appointmentStartDateTime(appointment);
        return `
          <div class="visit-row">
            <div class="visit-time"><strong>${escapeHtml(start ? formatFullDate(start) : "Brak daty")}</strong><span>${escapeHtml(start ? formatTime(start) : "—")}</span></div>
            <div><strong>${escapeHtml(appointment.patient || "Brak pacjenta")}</strong><span>${escapeHtml(appointment.doctor || "Brak lekarza")}</span></div>
            <div class="visit-status">${appointmentStatusBadge(appointment)}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderServiceDetail(service) {
  if (!service) {
    return `<aside class="service-detail card"><div class="empty-state">Brak wybranej usługi.</div></aside>`;
  }

  const assignedDoctors = getDoctorsForService(service);
  const colorClass = getSpecializationColor(service.specialization || serviceName(service));
  return `
    <aside class="service-detail card">
      <div class="service-detail-head">
        <span class="service-icon large ${escapeHtml(colorClass)}">+</span>
        <div>
          <h2>${escapeHtml(serviceName(service) || "Usługa")}</h2>
          <div class="service-detail-status">${serviceStatusBadge(service)}</div>
          <p>${escapeHtml(service.description || "Brak opisu.")}</p>
        </div>
      </div>
      <section class="service-panel-section service-detail-summary">
        <div class="info-list">
          <div><span>Specjalizacja</span><strong>${escapeHtml(service.specialization || "Brak danych")}</strong></div>
          <div><span>Czas trwania</span><strong>${escapeHtml(service.durationMinutes || service.duration || 30)} min</strong></div>
          <div><span>Cena</span><strong>${escapeHtml(service.price || "0")} PLN</strong></div>
          <div><span>Liczba wizyt</span><strong>${getAppointmentsForService(service).length}</strong></div>
        </div>
      </section>
      <section class="service-panel-section">
        <h3>Wizyty dla tej usługi</h3>
        ${renderServiceAppointments(service)}
      </section>
      <section class="service-panel-section">
        <h3>Lekarze</h3>
        ${assignedDoctors.length ? assignedDoctors.map((doctor) => `
          <div class="history-person">
            ${renderDoctorAvatar(doctor, { size: 32 })}
            <div class="history-person-text"><strong>${escapeHtml(doctorFullName(doctor))}</strong><span>${escapeHtml(doctor.specialization || "")}</span></div>
          </div>
        `).join("") : `<p class="empty-note">Brak lekarzy przypisanych do tej specjalizacji.</p>`}
      </section>
    </aside>
  `;
}

function renderServices() {
  const view = document.querySelector("#servicesView");
  if (!view) return;

  const visibleServices = filterServicesForView();
  const currentServiceId = ensureSelectedService(visibleServices);
  const selectedService = findServiceById(currentServiceId);

  view.innerHTML = `
    <section class="page-head">
      <div>
        <h1>Usługi medyczne</h1>
        <p>Zarządzaj katalogiem usług i parametrami rezerwacji.</p>
      </div>
      <div class="page-actions">
        <button class="primary-button" type="button" data-add-service>+ Dodaj usługę</button>
      </div>
    </section>
    <section class="services-layout">
      <div class="services-main">
        <section class="service-controls card">
          <div class="service-control-row">
            <input class="service-search-input" type="search" data-service-search value="${escapeHtml(serviceSearchQuery)}" placeholder="Szukaj usługi po nazwie, specjalizacji lub opisie...">
            <button class="secondary-button" type="button" data-service-clear>Wyczyść</button>
          </div>
          ${renderServiceFilterTabs()}
        </section>
        <section class="table-card services-table-card">
          <table>
            <thead>
              <tr>
                <th>Nazwa usługi</th>
                <th>Specjalizacja</th>
                <th>Czas trwania</th>
                <th>Cena</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              ${visibleServices.length ? visibleServices.map((service) => {
                const id = escapeHtml(getServiceEntityId(service));
                const active = serviceStatusLabel(service) === "Aktywna";
                const colorClass = getSpecializationColor(service.specialization || serviceName(service));
                return `
                  <tr data-service-row="${id}" class="${String(currentServiceId) === String(getServiceEntityId(service)) ? "selected" : ""}">
                    <td><div class="person-cell service-name-cell"><span class="service-icon ${escapeHtml(colorClass)}">+</span><div><strong>${escapeHtml(serviceName(service) || "Brak nazwy")}</strong><span>${escapeHtml(service.description || "Brak opisu")}</span></div></div></td>
                    <td class="service-specialization-cell">${escapeHtml(service.specialization || "Brak danych")}</td>
                    <td class="service-duration-cell">${escapeHtml(service.durationMinutes || service.duration || 30)} min</td>
                    <td class="service-price-cell">${escapeHtml(service.price || "0")} PLN</td>
                    <td class="service-status-cell">${serviceStatusBadge(service)}</td>
                    <td class="service-actions-cell"><div class="row-actions service-row-actions">
                      <button class="secondary-button" type="button" data-service-edit="${id}">Edytuj</button>
                      <button class="secondary-button" type="button" data-service-toggle="${id}">${active ? "Dezaktywuj" : "Aktywuj"}</button>
                    </div></td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="6"><div class="empty-state">Brak usług w katalogu.</div></td></tr>`}
            </tbody>
          </table>
        </section>
      </div>
      ${renderServiceDetail(selectedService)}
    </section>
  `;

  bindServicesEvents(view);
}

function bindServicesEvents(view) {
  view.querySelector("[data-add-service]")?.addEventListener("click", () => openServiceModal("create"));
  view.querySelector("[data-service-search]")?.addEventListener("input", (event) => {
    serviceSearchQuery = event.target.value;
    const cursorPosition = event.target.selectionStart;
    rerenderPreservingSearchFocus(renderServices, "[data-service-search]", cursorPosition);
  });
  view.querySelector("[data-service-clear]")?.addEventListener("click", () => {
    serviceSearchQuery = "";
    serviceStatusFilter = "all";
    renderServices();
  });
  view.querySelectorAll("[data-service-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      serviceStatusFilter = button.dataset.serviceFilter || "all";
      renderServices();
    });
  });
  view.querySelectorAll("[data-service-row]").forEach((row) => {
    row.addEventListener("click", () => selectService(row.dataset.serviceRow));
  });
  view.querySelectorAll("[data-service-edit]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openServiceModal("edit", button.dataset.serviceEdit);
    });
  });
  view.querySelectorAll("[data-service-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleServiceStatus(button.dataset.serviceToggle);
    });
  });
}

function selectService(serviceId) {
  selectedServiceId = serviceId;
  renderServices();
}

function openServiceModal(mode, serviceId = null) {
  const service = mode === "edit" ? findServiceById(serviceId) : null;
  const specializationOptions = getServiceSpecializationOptions(service?.specialization || "");
  const serviceColorClass = getSpecializationColor(service?.specialization || serviceName(service));
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.dataset.serviceModal = "true";
  backdrop.innerHTML = `
    <div class="modal service-modal editor-modal editor-modal-orange" role="dialog" aria-modal="true">
      <div class="modal-heading service-modal-heading">
        <div class="service-modal-heading-main">
          <span class="service-modal-heading-icon ${escapeHtml(serviceColorClass)}">${uiIcon("services")}</span>
          <div>
            <span class="modal-eyebrow">Katalog usług</span>
            <h2>${mode === "edit" ? "Edytuj usługę" : "Dodaj usługę"}</h2>
            <p>Uzupełnij parametry usługi używane przy rejestracji wizyt.</p>
          </div>
        </div>
        <button class="modal-close" type="button" data-close-service-modal>×</button>
      </div>
      <form class="service-form" data-service-form>
        <div class="form-grid service-form-grid">
          <label>Nazwa usługi<input name="name" value="${escapeHtml(serviceName(service) || "")}" required></label>
          <label>Specjalizacja<select name="specialization"><option value="">Wybierz specjalizację</option>${specializationOptions}</select></label>
          <label>Czas trwania w minutach
            <input name="duration" type="number" min="1" value="${escapeHtml(service?.durationMinutes || service?.duration || 30)}" required>
            <span class="duration-quick-buttons">
              ${[15, 30, 45, 60].map((value) => `<button type="button" data-duration-preset="${value}">${value}</button>`).join("")}
            </span>
          </label>
          <label>Cena<input name="price" type="number" min="0" step="0.01" value="${escapeHtml(service?.price || 0)}"></label>
          <label>Status<select name="status">
            <option value="active" ${serviceStatusLabel(service) !== "Nieaktywna" ? "selected" : ""}>Aktywna</option>
            <option value="inactive" ${serviceStatusLabel(service) === "Nieaktywna" ? "selected" : ""}>Nieaktywna</option>
          </select></label>
          <label class="full-width">Opis<textarea name="description">${escapeHtml(service?.description || "")}</textarea></label>
        </div>
        <div class="modal-actions">
          <button class="secondary-button" type="button" data-close-service-modal>Anuluj</button>
          <button class="primary-button" type="submit">${mode === "edit" ? "Zapisz zmiany" : "Dodaj usługę"}</button>
        </div>
        <p class="form-status" data-service-form-status></p>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelectorAll("[data-close-service-modal]").forEach((button) => button.addEventListener("click", close));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelectorAll("[data-duration-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = backdrop.querySelector("[name='duration']");
      if (input) input.value = button.dataset.durationPreset || "30";
    });
  });
  backdrop.querySelector("[data-service-form]")?.addEventListener("submit", (event) => saveService(event, mode, service, backdrop));
}

function buildServicePayload(form, existingService = null) {
  const duration = Number(form.elements.duration?.value || 0);
  const price = Number(form.elements.price?.value || 0);
  return {
    id: existingService?.id || `service-${Date.now()}`,
    service_id: existingService?.service_id ?? existingService?.id ?? null,
    name: String(form.elements.name?.value || "").trim(),
    service_name: String(form.elements.name?.value || "").trim(),
    description: String(form.elements.description?.value || "").trim(),
    specialization: String(form.elements.specialization?.value || "").trim(),
    durationMinutes: duration,
    duration_minutes: duration,
    price,
    status: form.elements.status?.value || "active",
    is_active: form.elements.status?.value !== "inactive",
  };
}

async function saveService(event, mode = "create", existingService = null, backdrop = null) {
  event?.preventDefault?.();
  const form = event?.currentTarget;
  if (!form) return;
  clearFieldErrors(form);
  const status = form.querySelector("[data-service-form-status]");
  const name = String(form.elements.name?.value || "").trim();
  const duration = Number(form.elements.duration?.value || 0);
  const price = Number(form.elements.price?.value || 0);

  if (!name || !duration || duration <= 0 || price < 0) {
    if (!name) setFieldError(form.elements.name, "Podaj nazwę usługi.");
    if (!duration || duration <= 0) setFieldError(form.elements.duration, "Czas trwania musi być większy od 0.");
    if (price < 0) setFieldError(form.elements.price, "Cena nie może być ujemna.");
    setStatus(status, "Popraw błędy w formularzu.");
    return;
  }

  const payload = buildServicePayload(form, existingService);
  let normalized = normalizeService(payload);
  let backendSaved = false;

  try {
    const endpoint = mode === "edit" ? `backend/api/services.php?id=${encodeURIComponent(existingService?.service_id ?? existingService?.id)}` : "backend/api/services.php";
    const response = await apiRequest(endpoint, {
      method: mode === "edit" ? "PUT" : "POST",
      body: payload,
    });
    const returned = response.service || response.data?.service || response.data || response;
    normalized = normalizeService({ ...payload, ...returned }) || normalized;
    backendSaved = true;
  } catch {
    backendSaved = false;
  }

  if (!normalized) {
    setStatus(status, "Nie udało się zapisać usługi.");
    return;
  }

  const targetId = existingService?.id ?? existingService?.service_id ?? normalized.id;
  const index = services.findIndex((service) => String(service.id ?? service.service_id) === String(targetId));
  if (index >= 0) services[index] = { ...services[index], ...normalized };
  else services.push(normalized);

  selectedServiceId = getServiceEntityId(normalized);
  saveCollection(storageKeys.services, services);
  populateServiceFields(services);
  setStatus(status, backendSaved ? "Usługa zapisana w bazie danych." : "Backend niedostępny. Usługa zapisana lokalnie.");
  backdrop?.remove();
  renderServices();
}

function toggleServiceStatus(serviceId) {
  const service = findServiceById(serviceId);
  if (!service) return;
  const active = serviceStatusLabel(service) === "Aktywna";
  service.status = active ? "inactive" : "active";
  service.isActive = !active;
  saveCollection(storageKeys.services, services);
  populateServiceFields(services);
  renderServices();
}

// ==============================
// Rooms / cabinets
// ==============================
function getCabinetEntityId(cabinet) {
  return String(cabinet?.id ?? cabinet?.cabinet_id ?? cabinet?.name ?? "");
}

function cabinetNumber(cabinet) {
  return String(cabinet?.number || cabinet?.room_number || cabinet?.name?.replace(/[^\d]/g, "") || "Brak danych").trim();
}

function cabinetStatusLabel(cabinet) {
  return isAvailableCabinet(cabinet) ? "Aktywny" : "Nieaktywny";
}

function cabinetStatusBadge(cabinet) {
  const active = cabinetStatusLabel(cabinet) === "Aktywny";
  return `<span class="status-badge ${active ? "status-zrealizowana" : "status-nieobecny-pacjent"}">${active ? "Aktywny" : "Nieaktywny"}</span>`;
}

function findCabinetById(cabinetId) {
  if (!cabinetId) return null;
  return cabinets.find((cabinet) => String(getCabinetEntityId(cabinet)) === String(cabinetId) || String(cabinet.cabinet_id) === String(cabinetId)) || null;
}

function filterCabinetsForView() {
  const query = cabinetSearchQuery.trim().toLowerCase();
  return cabinets.filter((cabinet) => {
    const active = isAvailableCabinet(cabinet);
    if (cabinetStatusFilter === "active" && !active) return false;
    if (cabinetStatusFilter === "inactive" && active) return false;
    if (!query) return true;

    return [cabinet.name, cabinetNumber(cabinet), cabinet.floor, cabinet.type, cabinet.description, cabinet.equipment]
      .some((value) => String(value || "").toLowerCase().includes(query));
  }).sort((a, b) => compareCabinetNumbers(a, b));
}

function compareCabinetNumbers(a, b) {
  const numberA = cabinetNumber(a);
  const numberB = cabinetNumber(b);
  const numericA = Number(String(numberA).match(/\d+/)?.[0] ?? Number.POSITIVE_INFINITY);
  const numericB = Number(String(numberB).match(/\d+/)?.[0] ?? Number.POSITIVE_INFINITY);
  if (numericA !== numericB) return numericA - numericB;
  return String(numberA).localeCompare(String(numberB), "pl", { numeric: true, sensitivity: "base" });
}

function ensureSelectedCabinet(visibleCabinets) {
  const current = selectedCabinetId ? visibleCabinets.find((cabinet) => String(getCabinetEntityId(cabinet)) === String(selectedCabinetId)) : null;
  if (current) return getCabinetEntityId(current);
  selectedCabinetId = visibleCabinets[0] ? getCabinetEntityId(visibleCabinets[0]) : null;
  return selectedCabinetId;
}

function renderCabinetFilterTabs() {
  const counts = cabinets.reduce((acc, cabinet) => {
    acc.all += 1;
    acc[isAvailableCabinet(cabinet) ? "active" : "inactive"] += 1;
    return acc;
  }, { all: 0, active: 0, inactive: 0 });

  return `
    <div class="room-filter-tabs">
      ${[
        ["all", "Wszystkie", counts.all],
        ["active", "Aktywne", counts.active],
        ["inactive", "Nieaktywne", counts.inactive],
      ].map(([key, label, count]) => `
        <button type="button" class="${cabinetStatusFilter === key ? "active" : ""}" data-cabinet-filter="${key}">
          ${label} <span>${count}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function getCabinetDoctors(cabinet) {
  if (!cabinet) return [];
  const cabinetId = cabinet.cabinet_id ?? cabinet.id;
  const cabinetName = cabinet.name;
  return doctors.filter((doctor) => {
    const doctorCabinetId = doctor.cabinet_id ?? doctor.cabinetId;
    if (doctorCabinetId && cabinetId) {
      return String(doctorCabinetId) === String(cabinetId);
    }
    return !doctorCabinetId && String(doctor.cabinet || doctor.cabinetName || "").trim() === String(cabinetName).trim();
  });
}

function isAppointmentForCabinet(appointment, cabinet) {
  if (!appointment || !cabinet) return false;
  const cabinetId = cabinet.cabinet_id ?? cabinet.id;
  const appointmentCabinet = appointment.cabinet_id ?? appointment.cabinetId;
  if (cabinetId && appointmentCabinet) return String(cabinetId) === String(appointmentCabinet);
  const cabinetName = String(cabinet.name || "").trim().toLowerCase();
  return Boolean(cabinetName && String(appointment.cabinet || appointment.cabinet_name || "").trim().toLowerCase() === cabinetName);
}

function getCabinetAppointments(cabinet) {
  return appointments
    .filter((appointment) => isAppointmentForCabinet(appointment, cabinet))
    .sort((a, b) => (appointmentStartDateTime(a)?.getTime() || 0) - (appointmentStartDateTime(b)?.getTime() || 0));
}

function renderCabinetDoctors(cabinet) {
  const assigned = getCabinetDoctors(cabinet);
  if (!assigned.length && cabinet?.assignedDoctors) {
    return `<p class="empty-note">${escapeHtml(cabinet.assignedDoctors)}</p>`;
  }
  if (!assigned.length) {
    return `<p class="empty-note">Brak przypisanych lekarzy.</p>`;
  }
  return assigned.map((doctor) => `
    <div class="doctor-mini-row">
      ${renderDoctorAvatar(doctor, { size: 32 })}
      <div><strong>${escapeHtml(doctorFullName(doctor))}</strong><span>${escapeHtml(doctor.specialization || "Brak specjalizacji")}</span></div>
    </div>
  `).join("");
}

function renderCabinetAppointmentRows(cabinet) {
  const cabinetAppointments = getCabinetAppointments(cabinet).slice(0, 8);
  if (!cabinetAppointments.length) {
    return `<p class="empty-note">Brak wizyt w tym gabinecie.</p>`;
  }
  return `
    <div class="patient-visit-history cabinet-visit-history">
      ${cabinetAppointments.map((appointment) => {
        const start = appointmentStartDateTime(appointment);
        const end = appointmentEndDateTime(appointment);
        const doctor = findDoctorByAppointment(appointment);
        const patient = findPatientForAppointment(appointment);
        const service = findServiceByIdOrValue(appointment.service_id || appointment.serviceId || appointment.service || appointment.service_name || appointment.specialization);
        return `
          <div class="visit-row cabinet-visit-row">
            <div class="visit-time">
              <strong>${escapeHtml(start ? formatFullDate(start) : "Brak daty")}</strong>
              <span>${escapeHtml(start ? formatTime(start) : formatTime(appointment.start_time || appointment.time))}${end ? `-${escapeHtml(formatTime(end))}` : ""}</span>
            </div>
            <div>
              <strong>${escapeHtml(patientFullName(patient) || appointment.patient || "Brak pacjenta")}</strong>
              <span>${escapeHtml(doctorFullName(doctor) || appointment.doctor || "Brak lekarza")}</span>
            </div>
            <div class="visit-row-meta">
              <span class="row-link">${escapeHtml(serviceName(service) || appointment.service_name || appointment.specialization || "Brak usługi")}</span>
              ${appointmentStatusBadge(appointment)}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderCabinetDetail(cabinet) {
  if (!cabinet) {
    return `<aside class="card room-detail"><div class="empty-state">Wybierz gabinet, aby zobaczyć szczegóły.</div></aside>`;
  }

  const cabinetAppointments = getCabinetAppointments(cabinet);
  const plannedCount = cabinetAppointments.filter((appointment) => ["Zaplanowana", "W trakcie"].includes(getResolvedAppointmentStatus(appointment))).length;
  const doctorsCount = getCabinetDoctors(cabinet).length;
  const equipment = String(cabinet.equipment || "EKG, Ciśnieniomierz, Stetoskop").split(",").map((item) => item.trim()).filter(Boolean);

  return `
    <aside class="card room-detail">
      <div class="room-detail-head">
        <span class="room-icon large">${escapeHtml(cabinetNumber(cabinet))}</span>
        <div>
          <h2>${escapeHtml(cabinet.name)} ${cabinetStatusBadge(cabinet)}</h2>
          <p>${escapeHtml(cabinet.type || "Brak typu")} · Piętro ${escapeHtml(cabinet.floor || "Brak danych")}</p>
        </div>
      </div>
      <div class="room-metrics">
        <div><span>Numer</span><strong>${escapeHtml(cabinetNumber(cabinet))}</strong></div>
        <div><span>Piętro</span><strong>${escapeHtml(cabinet.floor || "—")}</strong></div>
        <div><span>Lekarze</span><strong>${doctorsCount}</strong></div>
        <div><span>Wizyty</span><strong>${plannedCount}</strong></div>
      </div>
      <section class="room-panel-section">
        <h3>Opis</h3>
        <p>${escapeHtml(cabinet.description || "Brak opisu gabinetu.")}</p>
      </section>
      <section class="room-panel-section">
        <h3>Wyposażenie</h3>
        <div class="equipment-tags">${equipment.length ? equipment.map((item) => `<span>✓ ${escapeHtml(item)}</span>`).join("") : `<span>Brak danych</span>`}</div>
      </section>
      <section class="room-panel-section">
        <h3>Przypisani lekarze</h3>
        ${renderCabinetDoctors(cabinet)}
      </section>
      <section class="room-panel-section">
        <h3>Wizyty w gabinecie</h3>
        ${renderCabinetAppointmentRows(cabinet)}
      </section>
      <section class="room-panel-section">
        <h3>Podsumowanie wykorzystania</h3>
        <p class="empty-note">Wszystkie wizyty: ${cabinetAppointments.length}. Aktywne lub bieżące: ${plannedCount}.</p>
      </section>
    </aside>
  `;
}

function renderRooms() {
  const view = document.querySelector("#roomsView");
  if (!view) return;

  const restoreSearchFocus = Boolean(cabinetSearchFocusState?.active);
  const searchSelectionStart = Number.isFinite(cabinetSearchFocusState?.start) ? cabinetSearchFocusState.start : cabinetSearchQuery.length;
  const searchSelectionEnd = Number.isFinite(cabinetSearchFocusState?.end) ? cabinetSearchFocusState.end : searchSelectionStart;
  const visibleCabinets = filterCabinetsForView();
  const currentCabinetId = ensureSelectedCabinet(visibleCabinets);
  const selectedCabinet = findCabinetById(currentCabinetId);

  view.innerHTML = `
    <section class="page-head">
      <div>
        <h1>Gabinety</h1>
        <p>Zarządzaj gabinetami i ich wyposażeniem.</p>
      </div>
      <div class="page-actions">
        <button class="primary-button" type="button" data-add-cabinet>+ Dodaj gabinet</button>
      </div>
    </section>
    <section class="rooms-layout">
      <div class="rooms-main">
        <section class="room-controls card">
          <div class="room-control-row">
            <input class="room-search-input" type="search" data-cabinet-search value="${escapeHtml(cabinetSearchQuery)}" placeholder="Szukaj gabinetu po nazwie, numerze lub piętrze...">
            <button class="secondary-button" type="button" data-cabinet-clear>Wyczyść</button>
          </div>
          ${renderCabinetFilterTabs()}
        </section>
        <section class="table-card rooms-table-card">
          <table>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Numer</th>
                <th>Piętro</th>
                <th>Status</th>
                <th>Lekarze</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              ${visibleCabinets.length ? visibleCabinets.map((cabinet) => {
                const id = escapeHtml(getCabinetEntityId(cabinet));
                const active = isAvailableCabinet(cabinet);
                const assigned = getCabinetDoctors(cabinet);
                return `
                  <tr data-cabinet-row="${id}" class="${String(currentCabinetId) === String(getCabinetEntityId(cabinet)) ? "selected" : ""}">
                    <td><div class="person-cell"><span class="room-icon">${escapeHtml(cabinetNumber(cabinet))}</span><div><strong>${escapeHtml(cabinet.name)}</strong><span>${escapeHtml(cabinet.type || "Brak typu")}</span></div></div></td>
                    <td class="room-number-cell">${escapeHtml(cabinetNumber(cabinet))}</td>
                    <td class="room-floor-cell">${escapeHtml(cabinet.floor || "—")}</td>
                    <td class="room-status-cell">${cabinetStatusBadge(cabinet)}</td>
                    <td><div class="assigned-doctors">
                      ${assigned.slice(0, 3).map((doctor) => renderDoctorAvatar(doctor, { size: 32 })).join("")}
                      ${assigned.length > 3 ? `<span class="avatar-count">+${assigned.length - 3}</span>` : ""}
                      ${!assigned.length ? "—" : ""}
                    </div></td>
                    <td class="room-actions-cell"><div class="row-actions">
                      <button class="secondary-button" type="button" data-cabinet-edit="${id}">Edytuj</button>
                      <button class="secondary-button" type="button" data-cabinet-toggle="${id}">${active ? "Dezaktywuj" : "Aktywuj"}</button>
                    </div></td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="6"><div class="empty-state">Brak gabinetów do wyświetlenia.</div></td></tr>`}
            </tbody>
          </table>
        </section>
      </div>
      ${renderCabinetDetail(selectedCabinet)}
    </section>
  `;

  bindRoomsEvents(view);
  if (restoreSearchFocus) {
    setTimeout(() => {
      const searchInput = document.querySelector("#roomsView [data-cabinet-search]");
      if (!searchInput) return;
      searchInput.focus({ preventScroll: true });
      searchInput.setSelectionRange?.(
        Math.min(searchSelectionStart, searchInput.value.length),
        Math.min(searchSelectionEnd, searchInput.value.length)
      );
    }, 0);
  }
}

function bindRoomsEvents(view) {
  view.querySelector("[data-add-cabinet]")?.addEventListener("click", () => openCabinetModal("create"));
  view.querySelector("[data-cabinet-search]")?.addEventListener("input", (event) => {
    const input = event.currentTarget;
    cabinetSearchQuery = input.value;
    cabinetSearchFocusState = {
      active: true,
      start: input.selectionStart ?? cabinetSearchQuery.length,
      end: input.selectionEnd ?? input.selectionStart ?? cabinetSearchQuery.length,
    };
    renderRooms();
  });
  view.querySelector("[data-cabinet-clear]")?.addEventListener("click", () => {
    cabinetSearchQuery = "";
    cabinetSearchFocusState = null;
    cabinetStatusFilter = "all";
    renderRooms();
  });
  view.querySelectorAll("[data-cabinet-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      cabinetStatusFilter = button.dataset.cabinetFilter || "all";
      renderRooms();
    });
  });
  view.querySelectorAll("[data-cabinet-row]").forEach((row) => {
    row.addEventListener("click", () => selectCabinet(row.dataset.cabinetRow));
  });
  view.querySelectorAll("[data-cabinet-edit]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openCabinetModal("edit", button.dataset.cabinetEdit);
    });
  });
  view.querySelectorAll("[data-cabinet-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCabinetStatus(button.dataset.cabinetToggle);
    });
  });
}

function selectCabinet(cabinetId) {
  selectedCabinetId = cabinetId;
  renderRooms();
}

function getCabinetTypeOptions(selectedType = "") {
  const selected = normalizeCabinetType(selectedType);
  return cabinetTypes.map((type) => (
    `<option value="${escapeHtml(type)}" ${selected === type ? "selected" : ""}>${escapeHtml(type)}</option>`
  )).join("");
}

function openCabinetModal(mode, cabinetId = null) {
  const cabinet = mode === "edit" ? findCabinetById(cabinetId) : null;
  const cabinetActive = cabinet ? isAvailableCabinet(cabinet) : true;
  const availability = String(cabinet?.availability || "Dostępny");
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.dataset.cabinetModal = "true";
  backdrop.innerHTML = `
    <div class="modal cabinet-modal editor-modal editor-modal-orange" role="dialog" aria-modal="true">
      <div class="modal-heading editor-modal-heading">
        <div class="editor-modal-heading-main">
          <span class="editor-modal-heading-icon">${uiIcon("rooms")}</span>
          <div>
            <span class="modal-eyebrow">Gabinety</span>
            <h2>${mode === "edit" ? "Edytuj gabinet" : "Dodaj gabinet"}</h2>
            <p>Uzupełnij dane gabinetu i jego wyposażenie.</p>
          </div>
        </div>
        <button class="modal-close" type="button" data-close-cabinet-modal>×</button>
      </div>
      <form class="cabinet-form" data-cabinet-form>
        <div class="form-grid">
          <label>Nazwa<input name="name" value="${escapeHtml(cabinet?.name || "")}" required></label>
          <label>Numer<input name="number" value="${escapeHtml(cabinet ? cabinetNumber(cabinet) : "")}" required></label>
          <label>Piętro<input name="floor" value="${escapeHtml(cabinet?.floor || "")}"></label>
          <label>Typ gabinetu<select name="type">${getCabinetTypeOptions(cabinet?.type || "")}</select></label>
          <label>Status<select name="status">
            <option value="active" ${cabinetActive ? "selected" : ""}>Aktywny</option>
            <option value="inactive" ${!cabinetActive ? "selected" : ""}>Nieaktywny</option>
          </select></label>
          <label>Dostępność<select name="availability">
            ${["Dostępny", "Zarezerwowany", "W remoncie", "Wyłączony"].map((value) => `<option value="${escapeHtml(value)}" ${availability === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
          </select></label>
          <label class="full-width">Wyposażenie<input name="equipment" value="${escapeHtml(cabinet?.equipment || "")}" placeholder="np. EKG, Ciśnieniomierz, Stetoskop"></label>
          <label class="full-width">Opis<textarea name="description">${escapeHtml(cabinet?.description || "")}</textarea></label>
        </div>
        <div class="modal-actions">
          <button class="secondary-button" type="button" data-close-cabinet-modal>Anuluj</button>
          <button class="primary-button" type="submit">${mode === "edit" ? "Zapisz zmiany" : "Dodaj gabinet"}</button>
        </div>
        <p class="form-status" data-cabinet-form-status></p>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelectorAll("[data-close-cabinet-modal]").forEach((button) => button.addEventListener("click", close));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector("[data-cabinet-form]")?.addEventListener("submit", (event) => saveCabinet(event, mode, cabinet, backdrop));
}

function buildCabinetPayload(form, existingCabinet = null) {
  const name = String(form.elements.name?.value || "").trim();
  const number = String(form.elements.number?.value || "").trim();
  const status = form.elements.status?.value || "active";
  const type = normalizeCabinetType(form.elements.type?.value || "");
  return {
    id: existingCabinet?.id || `cabinet-${Date.now()}`,
    cabinet_id: existingCabinet?.cabinet_id ?? existingCabinet?.id ?? null,
    name,
    cabinet_name: name,
    number,
    room_number: number,
    floor: String(form.elements.floor?.value || "").trim(),
    type,
    cabinet_type: type,
    description: String(form.elements.description?.value || "").trim(),
    availability: String(form.elements.availability?.value || "").trim(),
    equipment: String(form.elements.equipment?.value || "").trim(),
    status,
    is_active: status !== "inactive",
  };
}

async function saveCabinet(event, mode = "create", existingCabinet = null, backdrop = null) {
  event?.preventDefault?.();
  const form = event?.currentTarget;
  if (!form) return;
  clearFieldErrors(form);
  const status = form.querySelector("[data-cabinet-form-status]");
  const name = String(form.elements.name?.value || "").trim();
  const number = String(form.elements.number?.value || "").trim();

  if (!name || !number) {
    if (!name) setFieldError(form.elements.name, "Podaj nazwę gabinetu.");
    if (!number) setFieldError(form.elements.number, "Podaj numer gabinetu.");
    setStatus(status, "Popraw błędy w formularzu.");
    return;
  }

  const payload = buildCabinetPayload(form, existingCabinet);
  let normalized = normalizeCabinet(payload);
  let backendSaved = false;

  try {
    const endpoint = mode === "edit" ? `backend/api/cabinets.php?id=${encodeURIComponent(existingCabinet?.cabinet_id ?? existingCabinet?.id)}` : "backend/api/cabinets.php";
    const response = await apiRequest(endpoint, {
      method: mode === "edit" ? "PUT" : "POST",
      body: payload,
    });
    const returned = response.cabinet || response.data?.cabinet || response.data || response;
    normalized = normalizeCabinet({ ...payload, ...returned }) || normalized;
    backendSaved = true;
  } catch {
    backendSaved = false;
  }

  if (!normalized) {
    setStatus(status, "Nie udało się zapisać gabinetu.");
    return;
  }

  const targetId = existingCabinet?.id ?? existingCabinet?.cabinet_id ?? normalized.id;
  const index = cabinets.findIndex((cabinet) => String(cabinet.id ?? cabinet.cabinet_id) === String(targetId));
  if (index >= 0) cabinets[index] = { ...cabinets[index], ...normalized };
  else cabinets.push(normalized);

  selectedCabinetId = getCabinetEntityId(normalized);
  saveCollection(storageKeys.cabinets, cabinets);
  populateCabinetFields(cabinets);
  setStatus(status, backendSaved ? "Gabinet zapisany w bazie danych." : "Backend niedostępny. Gabinet zapisany lokalnie.");
  backdrop?.remove();
  renderRooms();
}

function toggleCabinetStatus(cabinetId) {
  const cabinet = findCabinetById(cabinetId);
  if (!cabinet) return;
  const active = isAvailableCabinet(cabinet);
  cabinet.status = active ? "inactive" : "active";
  cabinet.isActive = !active;
  saveCollection(storageKeys.cabinets, cabinets);
  populateCabinetFields(cabinets);
  renderRooms();
}

// ==============================
// Users
// ==============================
function getUserEntityId(user) {
  return String(user?.id ?? user?.user_id ?? user?.login ?? user?.email ?? "");
}

function findUserById(userId) {
  if (!userId) return null;
  return users.find((user) => String(getUserEntityId(user)) === String(userId)) || null;
}

function userFullName(user) {
  return String(user?.name || `${user?.firstName || user?.first_name || ""} ${user?.lastName || user?.last_name || ""}`.trim() || user?.login || user?.email || "Użytkownik").trim();
}

function userRoleLabel(userOrRole) {
  const role = typeof userOrRole === "string" ? authRoleKey(userOrRole) : authRoleKey(userOrRole?.role);
  return role === "lekarz" ? "Lekarz" : "Recepcja";
}

function normalizeUserStatus(value, isActive = true) {
  const status = String(value || "").trim().toLowerCase();
  if (status.includes("block") || status.includes("zablok")) return "blocked";
  if (status.includes("inactive") || status.includes("nieakty") || isActive === false) return "inactive";
  return "active";
}

function userStatusLabel(user) {
  const status = normalizeUserStatus(user?.status, user?.isActive);
  if (status === "blocked") return "Zablokowany";
  if (status === "inactive") return "Nieaktywny";
  return "Aktywny";
}

function userStatusBadge(user) {
  const status = normalizeUserStatus(user?.status, user?.isActive);
  const className = status === "active" ? "status-zrealizowana" : status === "blocked" ? "status-anulowana" : "status-nieobecny-pacjent";
  return `<span class="user-status-badge status-badge ${className}">${escapeHtml(userStatusLabel(user))}</span>`;
}

function userRoleBadge(user) {
  return `<span class="user-role-badge">${escapeHtml(userRoleLabel(user))}</span>`;
}

function userInitials(user) {
  return userFullName(user)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
}

function getLinkedDoctorForUser(user) {
  if (authRoleKey(user?.role) !== "lekarz") return null;
  return findDoctorById(user?.doctor_id ?? user?.doctorId);
}

function renderUserAvatar(user, size = 44) {
  const doctor = getLinkedDoctorForUser(user);
  if (doctor) return renderDoctorAvatar(doctor, { size });
  return `<span class="user-avatar" style="width:${size}px;height:${size}px;font-size:${Math.max(12, Math.round(size / 3))}px">${escapeHtml(userInitials(user))}</span>`;
}

function filterUsersForView() {
  const query = userSearchQuery.trim().toLowerCase();
  return users.filter((user) => {
    const status = normalizeUserStatus(user.status, user.isActive);
    if (userStatusFilter !== "all" && status !== userStatusFilter) return false;
    if (!query) return true;
    return [
      user.firstName,
      user.lastName,
      user.name,
      user.login,
      user.email,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
}

function ensureSelectedUser(visibleUsers) {
  const current = selectedUserId ? visibleUsers.find((user) => String(getUserEntityId(user)) === String(selectedUserId)) : null;
  if (current) return getUserEntityId(current);
  selectedUserId = visibleUsers[0] ? getUserEntityId(visibleUsers[0]) : null;
  return selectedUserId;
}

function renderUserFilterTabs() {
  const counts = users.reduce((acc, user) => {
    const status = normalizeUserStatus(user.status, user.isActive);
    acc.all += 1;
    acc[status] += 1;
    return acc;
  }, { all: 0, active: 0, inactive: 0, blocked: 0 });

  return `
    <div class="user-filter-tabs">
      ${[
        ["all", "Wszyscy", counts.all],
        ["active", "Aktywni", counts.active],
        ["inactive", "Nieaktywni", counts.inactive],
        ["blocked", "Zablokowani", counts.blocked],
      ].map(([key, label, count]) => `
        <button type="button" class="${userStatusFilter === key ? "active" : ""}" data-user-filter="${key}">
          ${label} <span>${count}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderUserDetail(user) {
  if (!user) {
    return `<aside class="card user-detail user-detail-empty"><div class="empty-state">Wybierz użytkownika, aby zobaczyć szczegóły.</div></aside>`;
  }

  const role = authRoleKey(user.role);
  const linkedDoctor = getLinkedDoctorForUser(user);
  const linkedDoctorSection = role === "lekarz" ? `
    <section class="room-panel-section user-linked-doctor-section">
      <h3>Powiązany lekarz</h3>
      ${linkedDoctor ? `
        <div class="doctor-mini-row user-linked-doctor-card">
          ${renderDoctorAvatar(linkedDoctor, { size: 40 })}
          <div><strong>${escapeHtml(doctorFullName(linkedDoctor))}</strong><span>${escapeHtml(linkedDoctor.specialization || "Brak specjalizacji")}</span></div>
        </div>
      ` : `<div class="user-warning">Wymagane powiązanie z lekarzem</div>`}
    </section>
  ` : "";

  return `
    <aside class="card user-detail">
      <div class="user-detail-head">
        ${renderUserAvatar(user, 64)}
        <div class="user-detail-title">
          <h2>${escapeHtml(userFullName(user))}</h2>
          <p>${escapeHtml(user.email || "Brak e-maila")}</p>
          <div>${userRoleBadge(user)} ${userStatusBadge(user)}</div>
        </div>
      </div>
      <section class="room-panel-section user-basic-section">
        <h3>Informacje podstawowe</h3>
        <dl class="details-list user-info-list">
          <div><dt>Login</dt><dd><strong>${escapeHtml(user.login || "Brak danych")}</strong></dd></div>
          <div><dt>E-mail</dt><dd><strong>${escapeHtml(user.email || "Brak danych")}</strong></dd></div>
          <div><dt>Rola</dt><dd><strong>${escapeHtml(userRoleLabel(user))}</strong></dd></div>
          <div><dt>Status</dt><dd><strong>${escapeHtml(userStatusLabel(user))}</strong></dd></div>
          <div><dt>Utworzony</dt><dd><strong>${escapeHtml(user.createdAt || "Brak danych")}</strong></dd></div>
          <div><dt>Ostatnie logowanie</dt><dd><strong>${escapeHtml(user.lastLogin || "Brak danych")}</strong></dd></div>
        </dl>
      </section>
      ${linkedDoctorSection}
      <section class="room-panel-section">
        <h3>Szybkie akcje</h3>
        <div class="user-action-grid">
          <button class="secondary-button" type="button" data-user-edit="${escapeHtml(getUserEntityId(user))}">Edytuj</button>
          <button class="secondary-button" type="button" data-user-reset="${escapeHtml(getUserEntityId(user))}">Resetuj hasło</button>
          <button class="secondary-button" type="button" data-user-block="${escapeHtml(getUserEntityId(user))}">${normalizeUserStatus(user.status, user.isActive) === "blocked" ? "Odblokuj" : "Zablokuj"}</button>
          <button class="secondary-button" type="button" data-user-deactivate="${escapeHtml(getUserEntityId(user))}">Dezaktywuj</button>
        </div>
      </section>
    </aside>
  `;
}

function getUsersPageItems(filteredUsers) {
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersRowsPerPage));
  usersPage = Math.min(Math.max(1, usersPage), totalPages);
  const start = (usersPage - 1) * usersRowsPerPage;
  return {
    totalPages,
    start,
    items: filteredUsers.slice(start, start + usersRowsPerPage),
  };
}

function renderUsersPagination(total, totalPages) {
  return `
    <div class="pagination users-pagination">
      <label>Pokaż na stronie
        <select data-users-per-page>
          ${[5, 10, 20].map((count) => `<option value="${count}" ${usersRowsPerPage === count ? "selected" : ""}>${count}</option>`).join("")}
        </select>
      </label>
      <span>${total ? `${(usersPage - 1) * usersRowsPerPage + 1} – ${Math.min(usersPage * usersRowsPerPage, total)} z ${total}` : "0"} użytkowników</span>
      <div class="pager-buttons">
        <button class="secondary-button" type="button" data-users-prev ${usersPage <= 1 ? "disabled" : ""}>‹</button>
        ${Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => `<button class="secondary-button ${page === usersPage ? "active" : ""}" type="button" data-users-page="${page}">${page}</button>`).join("")}
        <button class="secondary-button" type="button" data-users-next ${usersPage >= totalPages ? "disabled" : ""}>›</button>
      </div>
    </div>
  `;
}

function renderUsers() {
  const view = document.querySelector("#usersView");
  if (!view) return;

  const filteredUsers = filterUsersForView();
  const { totalPages, items } = getUsersPageItems(filteredUsers);
  const currentUserId = ensureSelectedUser(items.length ? items : filteredUsers);
  const selectedUser = findUserById(currentUserId);

  view.innerHTML = `
    <section class="page-head">
      <div>
        <h1>Użytkownicy</h1>
        <p>Zarządzaj użytkownikami systemu i dostępem.</p>
      </div>
      <div class="page-actions">
        <button class="primary-button" type="button" data-add-user>+ Dodaj użytkownika</button>
      </div>
    </section>
    <section class="users-layout">
      <div class="users-main">
        <section class="user-controls card">
          <div class="service-control-row">
            <input class="service-search-input" type="search" data-user-search value="${escapeHtml(userSearchQuery)}" placeholder="Szukaj użytkownika po imieniu, nazwisku, e-mailu lub loginie...">
            <button class="secondary-button" type="button" data-user-clear>Wyczyść</button>
          </div>
          ${renderUserFilterTabs()}
        </section>
        <section class="table-card users-table-card">
          <table>
            <thead>
              <tr>
                <th>Imię i nazwisko</th>
                <th>Login / Email</th>
                <th>Rola</th>
                <th>Status</th>
                <th>Ostatnie logowanie</th>
              </tr>
            </thead>
            <tbody>
              ${items.length ? items.map((user) => {
                const id = escapeHtml(getUserEntityId(user));
                return `
                  <tr data-user-row="${id}" class="${String(currentUserId) === String(getUserEntityId(user)) ? "selected" : ""}">
                    <td><div class="person-cell">${renderUserAvatar(user, 42)}<div><strong>${escapeHtml(userFullName(user))}</strong><span>${escapeHtml(userRoleLabel(user))}</span></div></div></td>
                    <td><strong>${escapeHtml(user.login || "Brak loginu")}</strong><span>${escapeHtml(user.email || "Brak e-maila")}</span></td>
                    <td>${userRoleBadge(user)}</td>
                    <td>${userStatusBadge(user)}</td>
                    <td>${escapeHtml(user.lastLogin || "Brak danych")}</td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="5"><div class="empty-state">Brak użytkowników do wyświetlenia.</div></td></tr>`}
            </tbody>
          </table>
          ${renderUsersPagination(filteredUsers.length, totalPages)}
        </section>
      </div>
      ${renderUserDetail(selectedUser)}
    </section>
  `;

  bindUsersEvents(view);
}

function bindUsersEvents(view) {
  view.querySelector("[data-add-user]")?.addEventListener("click", () => openUserModal("create"));
  view.querySelector("[data-user-search]")?.addEventListener("input", (event) => {
    userSearchQuery = event.target.value;
    const cursorPosition = event.target.selectionStart;
    usersPage = 1;
    clearTimeout(userSearchRenderTimer);
    userSearchRenderTimer = setTimeout(() => {
      rerenderPreservingSearchFocus(renderUsers, "[data-user-search]", cursorPosition);
    }, 120);
  });
  view.querySelector("[data-user-clear]")?.addEventListener("click", () => {
    userSearchQuery = "";
    userStatusFilter = "all";
    usersPage = 1;
    renderUsers();
  });
  view.querySelectorAll("[data-user-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      userStatusFilter = button.dataset.userFilter || "all";
      usersPage = 1;
      renderUsers();
    });
  });
  view.querySelectorAll("[data-user-row]").forEach((row) => {
    row.addEventListener("click", () => selectUser(row.dataset.userRow));
  });
  view.querySelectorAll("[data-user-edit]").forEach((button) => button.addEventListener("click", () => openUserModal("edit", button.dataset.userEdit)));
  view.querySelectorAll("[data-user-reset]").forEach((button) => button.addEventListener("click", () => resetUserPassword(button.dataset.userReset)));
  view.querySelectorAll("[data-user-block]").forEach((button) => button.addEventListener("click", () => toggleUserBlocked(button.dataset.userBlock)));
  view.querySelectorAll("[data-user-deactivate]").forEach((button) => button.addEventListener("click", () => deactivateUser(button.dataset.userDeactivate)));
  view.querySelector("[data-users-per-page]")?.addEventListener("change", (event) => {
    usersRowsPerPage = Number(event.target.value) || 10;
    usersPage = 1;
    renderUsers();
  });
  view.querySelector("[data-users-prev]")?.addEventListener("click", () => {
    usersPage -= 1;
    renderUsers();
  });
  view.querySelector("[data-users-next]")?.addEventListener("click", () => {
    usersPage += 1;
    renderUsers();
  });
  view.querySelectorAll("[data-users-page]").forEach((button) => button.addEventListener("click", () => {
    usersPage = Number(button.dataset.usersPage) || 1;
    renderUsers();
  }));
}

function selectUser(userId) {
  selectedUserId = userId;
  renderUsers();
}

function renderUserDoctorOptions(selectedDoctorId = "") {
  return doctors.map((doctor) => {
    const id = doctor.id ?? doctor.doctor_id;
    return `<option value="${escapeHtml(id)}" ${String(selectedDoctorId || "") === String(id) ? "selected" : ""}>${escapeHtml(doctorFullName(doctor))}</option>`;
  }).join("");
}

function openUserModal(mode, userId = null) {
  const user = mode === "edit" ? findUserById(userId) : null;
  const role = userRoleLabel(user || "recepcja");
  const status = normalizeUserStatus(user?.status, user?.isActive);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.dataset.userModal = "true";
  backdrop.innerHTML = `
    <div class="modal service-modal" role="dialog" aria-modal="true">
      <div class="modal-heading">
        <h2>${mode === "edit" ? "Edytuj użytkownika" : "Dodaj użytkownika"}</h2>
        <button class="modal-close" type="button" data-close-user-modal>×</button>
      </div>
      <form class="service-form" data-user-form>
        <div class="form-grid service-form-grid">
          <label>Imię<input name="firstName" value="${escapeHtml(user?.firstName || "")}"></label>
          <label>Nazwisko<input name="lastName" value="${escapeHtml(user?.lastName || "")}"></label>
          <label>Login<input name="login" value="${escapeHtml(user?.login || "")}" required></label>
          <label>E-mail<span class="doctor-email-field"><input name="email" type="text" value="${escapeHtml(formatUserEmail(user?.email || ""))}" data-user-email required><span>${USER_EMAIL_DOMAIN}</span></span></label>
          <label>Rola<select name="role" data-user-role>
            <option value="Recepcja" ${role === "Recepcja" ? "selected" : ""}>Recepcja</option>
            <option value="Lekarz" ${role === "Lekarz" ? "selected" : ""}>Lekarz</option>
          </select></label>
          <label>Status<select name="status">
            <option value="active" ${status === "active" ? "selected" : ""}>Aktywny</option>
            <option value="blocked" ${status === "blocked" ? "selected" : ""}>Zablokowany</option>
            <option value="inactive" ${status === "inactive" ? "selected" : ""}>Nieaktywny</option>
          </select></label>
          <label data-user-doctor-field>Powiązany lekarz<select name="doctor_id">
            <option value="">Wybierz lekarza</option>
            ${renderUserDoctorOptions(user?.doctor_id)}
          </select></label>
        </div>
        <div class="modal-actions">
          <button class="secondary-button" type="button" data-close-user-modal>Anuluj</button>
          <button class="primary-button" type="submit">${mode === "edit" ? "Zapisz zmiany" : "Dodaj użytkownika"}</button>
        </div>
        <p class="form-status" data-user-form-status></p>
      </form>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  const syncDoctorField = () => {
    const form = backdrop.querySelector("[data-user-form]");
    const doctorField = form?.querySelector("[data-user-doctor-field]");
    const doctorSelect = form?.elements.doctor_id;
    const isDoctor = form?.elements.role?.value === "Lekarz";
    if (doctorField) doctorField.style.display = isDoctor ? "" : "none";
    if (!isDoctor && doctorSelect) doctorSelect.value = "";
  };

  backdrop.querySelectorAll("[data-close-user-modal]").forEach((button) => button.addEventListener("click", close));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector("[data-user-role]")?.addEventListener("change", syncDoctorField);
  backdrop.querySelector("[data-user-form]")?.addEventListener("submit", (event) => saveUser(event, mode, user, backdrop));
  bindUserEmailInputs(backdrop);
  syncDoctorField();
}

function buildUserPayload(form, existingUser = null) {
  const roleKey = authRoleKey(form.elements.role?.value);
  const firstName = String(form.elements.firstName?.value || "").trim();
  const lastName = String(form.elements.lastName?.value || "").trim();
  const status = form.elements.status?.value || "active";
  const isCreate = !existingUser;
  return {
    id: existingUser?.id || `user-${Date.now()}`,
    firstName,
    first_name: firstName,
    lastName,
    last_name: lastName,
    name: `${firstName} ${lastName}`.trim() || String(form.elements.login?.value || "").trim(),
    login: String(form.elements.login?.value || "").trim(),
    username: String(form.elements.login?.value || "").trim(),
    email: getUserEmailSubmitValue(form.elements.email),
    role: roleKey,
    status,
    is_active: status === "active",
    doctor_id: roleKey === "lekarz" ? (form.elements.doctor_id?.value || null) : null,
    password: isCreate ? generateTemporaryPassword() : undefined,
    must_change_password: isCreate ? true : Boolean(existingUser?.must_change_password),
    lastLogin: existingUser?.lastLogin || "",
    createdAt: existingUser?.createdAt || new Date().toLocaleString("pl-PL"),
  };
}

async function saveUser(event, mode = "create", existingUser = null, backdrop = null) {
  event?.preventDefault?.();
  const form = event?.currentTarget;
  if (!form) return;
  clearFieldErrors(form);
  const statusElement = form.querySelector("[data-user-form-status]");
  const login = String(form.elements.login?.value || "").trim();
  const email = getUserEmailSubmitValue(form.elements.email);
  const roleKey = authRoleKey(form.elements.role?.value);
  const doctorId = form.elements.doctor_id?.value || "";

  if (!login || !email || (roleKey === "lekarz" && !doctorId)) {
    if (!login) setFieldError(form.elements.login, "Podaj login.");
    if (!email) setFieldError(form.elements.email, "Podaj e-mail.");
    if (roleKey === "lekarz" && !doctorId) setFieldError(form.elements.doctor_id, "Wybierz powiązanego lekarza.");
    setStatus(statusElement, "Popraw błędy w formularzu.");
    return;
  }

  const payload = buildUserPayload(form, existingUser);
  let normalized = normalizeUser(payload);
  let backendSaved = false;

  try {
    const endpoint = mode === "edit" ? `backend/api/users.php?id=${encodeURIComponent(existingUser?.id)}` : "backend/api/users.php";
    const response = await apiRequest(endpoint, {
      method: mode === "edit" ? "PUT" : "POST",
      body: payload,
    });
    const returned = response.user || response.data?.user || response.data || response;
    normalized = normalizeUser({ ...payload, ...returned }) || normalized;
    backendSaved = true;
  } catch (error) {
    console.warn("[users] backend save failed", error);
    setStatus(statusElement, "Nie udało się zapisać użytkownika w bazie danych.");
    return;
  }

  if (!normalized) {
    setStatus(statusElement, "Nie udało się zapisać użytkownika.");
    return;
  }

  const targetId = existingUser?.id ?? normalized.id;
  const index = users.findIndex((user) => String(getUserEntityId(user)) === String(targetId));
  if (index >= 0) users[index] = { ...users[index], ...normalized };
  else users.push(normalized);

  selectedUserId = getUserEntityId(normalized);
  saveCollection(storageKeys.users, users);
  setStatus(statusElement, backendSaved ? "Użytkownik zapisany w bazie danych." : "Nie udało się zapisać użytkownika w bazie danych.");
  backdrop?.remove();
  renderUsers();
}

function generateTemporaryPassword() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let index = 0; index < 6; index += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MP-${suffix}`;
}

async function resetUserPassword(userId) {
  const user = findUserById(userId);
  if (!user) return;
  let temporaryPassword = "";

  try {
    const response = await apiRequest("backend/api/users.php?action=reset_password", {
      method: "PATCH",
      body: { id: user.id },
    });
    temporaryPassword = response.temporary_password || response.temporaryPassword || response.data?.temporary_password || response.data?.temporaryPassword || "";
    if (!temporaryPassword) {
      throw new Error("Backend did not return a temporary password.");
    }

    const returnedUser = response.user || response.data?.user || null;
    const normalizedReturnedUser = normalizeUser(returnedUser);
    if (normalizedReturnedUser) {
      Object.assign(user, normalizedReturnedUser);
    } else {
      user.must_change_password = true;
    }
    saveCollection(storageKeys.users, users);
  } catch (error) {
    console.warn("[users] password reset failed", error);
    renderUsers();
    const activeDetail = document.querySelector("#usersView .user-detail");
    if (activeDetail) {
      activeDetail.insertAdjacentHTML("afterbegin", `<div class="user-warning">Nie udało się zresetować hasła w bazie danych. Spróbuj ponownie.</div>`);
    }
    return;
  }

  renderUsers();
  const message = `Hasło tymczasowe dla ${userFullName(user)}: ${temporaryPassword}`;
  const activeDetail = document.querySelector("#usersView .user-detail");
  if (activeDetail) {
    activeDetail.insertAdjacentHTML("afterbegin", `<div class="user-warning">${escapeHtml(message)}</div>`);
  }
}

function toggleUserBlocked(userId) {
  const user = findUserById(userId);
  if (!user) return;
  const currentStatus = normalizeUserStatus(user.status, user.isActive);
  user.status = currentStatus === "blocked" ? "active" : "blocked";
  user.isActive = user.status === "active";
  saveCollection(storageKeys.users, users);
  renderUsers();
}

function deactivateUser(userId) {
  const user = findUserById(userId);
  if (!user) return;
  user.status = "inactive";
  user.isActive = false;
  saveCollection(storageKeys.users, users);
  renderUsers();
}

// ==============================
// Settings
// ==============================
const settingsStorageKeys = {
  clinic: "clinicSettings",
  workingHours: "clinicWorkingHours",
  appointment: "appointmentSettings",
  security: "securitySettings",
};

function readJsonSetting(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? { ...fallback, ...JSON.parse(stored) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function saveJsonSetting(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultClinicSettings() {
  return {
    name: "MediPlus Klinika Zdrowia",
    clinicName: "MediPlus Klinika Zdrowia",
    nip: "",
    regon: "",
    phone: "+48 ",
    email: "",
    website: "",
    address: "",
    city: "",
    postalCode: "",
  };
}

function normalizeClinicSettings(raw) {
  const fallback = defaultClinicSettings();
  const source = raw && typeof raw === "object" ? raw : {};
  const clinicName = String(source.clinicName ?? source.name ?? fallback.clinicName).trim() || fallback.clinicName;
  return {
    ...fallback,
    ...source,
    name: clinicName,
    clinicName,
    nip: String(source.nip ?? fallback.nip).trim(),
    regon: String(source.regon ?? fallback.regon).trim(),
    phone: String(source.phone ?? fallback.phone).trim() || "+48 ",
    email: String(source.email ?? fallback.email).trim(),
    website: String(source.website ?? fallback.website).trim(),
    address: String(source.address ?? fallback.address).trim(),
    city: String(source.city ?? fallback.city).trim(),
    postalCode: String(source.postalCode ?? fallback.postalCode).trim(),
  };
}

function defaultClinicWorkingHours() {
  return {
    monday: { active: true, start: "08:00", end: "18:00" },
    tuesday: { active: true, start: "08:00", end: "18:00" },
    wednesday: { active: true, start: "08:00", end: "18:00" },
    thursday: { active: true, start: "08:00", end: "18:00" },
    friday: { active: true, start: "08:00", end: "18:00" },
    saturday: { active: true, start: "09:00", end: "14:00" },
    sunday: { active: false, start: "", end: "" },
  };
}

function normalizeClinicWorkingHours(raw) {
  const fallback = defaultClinicWorkingHours();
  const source = raw?.hours && typeof raw.hours === "object" ? raw.hours : raw;
  return doctorScheduleDays.reduce((acc, day, index) => {
    const weekdayKey = String(index + 1);
    const entry = source?.[day.key] || source?.[weekdayKey] || fallback[day.key];
    acc[day.key] = normalizeWorkingWindow(entry, fallback[day.key]) || fallback[day.key];
    return acc;
  }, {});
}

function clinicWorkingHoursToApiPayload(hours) {
  const normalized = normalizeClinicWorkingHours(hours);
  return {
    hours: doctorScheduleDays.reduce((acc, day, index) => {
      const entry = normalized[day.key] || defaultClinicWorkingHours()[day.key];
      acc[String(index + 1)] = {
        isClosed: !entry.active,
        open: entry.active ? entry.start : "",
        close: entry.active ? entry.end : "",
      };
      return acc;
    }, {}),
  };
}

async function loadClinicWorkingHours() {
  const raw = await apiGet("backend/api/settings.php?action=clinic_working_hours", "clinic_working_hours");
  if (raw !== null) {
    clinicWorkingHours = normalizeClinicWorkingHours(raw);
    saveJsonSetting(settingsStorageKeys.workingHours, clinicWorkingHours);
    return clinicWorkingHours;
  }

  clinicWorkingHours = normalizeClinicWorkingHours(readJsonSetting(settingsStorageKeys.workingHours, defaultClinicWorkingHours()));
  return clinicWorkingHours;
}

function defaultAppointmentSettings() {
  return {
    allowOverlaps: false,
    autoCompletePast: true,
    hideInactiveServices: true,
    minIntervalMinutes: 0,
    visitInterval: 0,
  };
}

function normalizeAppointmentSettings(raw) {
  const fallback = defaultAppointmentSettings();
  const source = raw && typeof raw === "object" ? raw : {};
  const minInterval = Number(source.minIntervalMinutes ?? source.min_interval_minutes ?? source.visitInterval ?? fallback.minIntervalMinutes);
  const normalizedInterval = [0, 5, 10, 15, 20, 30, 45, 60].includes(minInterval) ? minInterval : fallback.minIntervalMinutes;
  return {
    allowOverlaps: normalizeBoolean(source.allowOverlaps ?? source.allow_overlaps, fallback.allowOverlaps),
    autoCompletePast: normalizeBoolean(source.autoCompletePast ?? source.auto_complete_past, fallback.autoCompletePast),
    hideInactiveServices: normalizeBoolean(source.hideInactiveServices ?? source.hide_inactive_services, fallback.hideInactiveServices),
    minIntervalMinutes: normalizedInterval,
    visitInterval: normalizedInterval,
  };
}

function appointmentSettingsToApiPayload(settingsValue) {
  const normalized = normalizeAppointmentSettings(settingsValue);
  return {
    allowOverlaps: normalized.allowOverlaps,
    autoCompletePast: normalized.autoCompletePast,
    hideInactiveServices: normalized.hideInactiveServices,
    minIntervalMinutes: normalized.minIntervalMinutes,
  };
}

async function loadAppointmentSettings() {
  const raw = await apiGet("backend/api/settings.php?action=appointment_settings", "appointment_settings");
  if (raw !== null) {
    appointmentSettings = normalizeAppointmentSettings(raw);
    saveJsonSetting(settingsStorageKeys.appointment, appointmentSettings);
    return appointmentSettings;
  }

  appointmentSettings = normalizeAppointmentSettings(readJsonSetting(settingsStorageKeys.appointment, defaultAppointmentSettings()));
  return appointmentSettings;
}

function defaultSecuritySettings() {
  return {
    minPasswordLength: 8,
    forcePasswordChangeAfterReset: true,
    autoLogoutEnabled: false,
    inactivityTimeoutMinutes: 30,
  };
}

function normalizeSecuritySettings(raw) {
  const fallback = defaultSecuritySettings();
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    minPasswordLength: Math.max(6, Number(source.minPasswordLength ?? fallback.minPasswordLength)),
    forcePasswordChangeAfterReset: normalizeBoolean(source.forcePasswordChangeAfterReset, fallback.forcePasswordChangeAfterReset),
    autoLogoutEnabled: normalizeBoolean(source.autoLogoutEnabled, fallback.autoLogoutEnabled),
    inactivityTimeoutMinutes: Math.max(1, Number(source.inactivityTimeoutMinutes ?? fallback.inactivityTimeoutMinutes)),
  };
}

function defaultEmailSettings() {
  return {
    smtpHost: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    encryption: "tls",
    senderName: "MediPlus",
    senderEmail: "",
    passwordConfigured: false,
  };
}

function normalizeEmailSettings(raw) {
  const fallback = defaultEmailSettings();
  const source = raw && typeof raw === "object" ? raw : {};
  const encryption = String(source.encryption ?? fallback.encryption).toLowerCase();
  return {
    smtpHost: String(source.smtpHost ?? source.smtp_host ?? fallback.smtpHost).trim(),
    smtpPort: Math.max(1, Math.min(65535, Number(source.smtpPort ?? source.smtp_port ?? fallback.smtpPort) || fallback.smtpPort)),
    smtpUsername: String(source.smtpUsername ?? source.smtp_username ?? fallback.smtpUsername).trim(),
    smtpPassword: "",
    encryption: ["none", "ssl", "tls"].includes(encryption) ? encryption : fallback.encryption,
    senderName: String(source.senderName ?? source.sender_name ?? fallback.senderName).trim() || fallback.senderName,
    senderEmail: String(source.senderEmail ?? source.sender_email ?? fallback.senderEmail).trim(),
    passwordConfigured: normalizeBoolean(source.passwordConfigured ?? source.password_configured, fallback.passwordConfigured),
  };
}

async function loadEmailSettings() {
  if (authRoleKey(currentUser?.role) !== "recepcja") {
    emailSettings = defaultEmailSettings();
    return emailSettings;
  }
  const raw = await apiGet("backend/api/email_settings.php", "email_settings");
  emailSettings = normalizeEmailSettings(raw);
  return emailSettings;
}

function getEmailSettings() {
  if (!emailSettings) {
    emailSettings = defaultEmailSettings();
  }
  return normalizeEmailSettings(emailSettings);
}

function loadLocalSystemSettings() {
  clinicSettings = normalizeClinicSettings(readJsonSetting(settingsStorageKeys.clinic, defaultClinicSettings()));
  appointmentSettings = normalizeAppointmentSettings(readJsonSetting(settingsStorageKeys.appointment, defaultAppointmentSettings()));
  securitySettings = normalizeSecuritySettings(readJsonSetting(settingsStorageKeys.security, defaultSecuritySettings()));
  systemSettings = {
    clinic: clinicSettings,
    appointment: appointmentSettings,
    security: securitySettings,
  };
  return systemSettings;
}

async function loadSystemSettings() {
  const raw = await apiGet("backend/api/settings.php?action=system_settings", "system_settings");
  if (!raw || typeof raw !== "object") {
    return loadLocalSystemSettings();
  }

  clinicSettings = normalizeClinicSettings(raw.clinic);
  appointmentSettings = normalizeAppointmentSettings(raw.appointment);
  securitySettings = normalizeSecuritySettings(raw.security);
  systemSettings = {
    clinic: clinicSettings,
    appointment: appointmentSettings,
    security: securitySettings,
  };
  saveJsonSetting(settingsStorageKeys.clinic, clinicSettings);
  saveJsonSetting(settingsStorageKeys.appointment, appointmentSettings);
  saveJsonSetting(settingsStorageKeys.security, securitySettings);
  return systemSettings;
}

async function saveSystemSetting(key, value) {
  const response = await apiPut("backend/api/settings.php?action=system_settings", { key, value });
  if (response === null) return null;
  if (key === "clinic") return normalizeClinicSettings(response);
  if (key === "appointment") return normalizeAppointmentSettings(response);
  if (key === "security") return normalizeSecuritySettings(response);
  return response;
}

function getClinicSettings() {
  if (!clinicSettings) {
    clinicSettings = normalizeClinicSettings(readJsonSetting(settingsStorageKeys.clinic, defaultClinicSettings()));
  }
  return normalizeClinicSettings(clinicSettings);
}

function getClinicWorkingHoursSettings() {
  if (!clinicWorkingHours) {
    clinicWorkingHours = normalizeClinicWorkingHours(readJsonSetting(settingsStorageKeys.workingHours, defaultClinicWorkingHours()));
  }
  return normalizeClinicWorkingHours(clinicWorkingHours);
}

function getAppointmentSettings() {
  if (!appointmentSettings) {
    appointmentSettings = normalizeAppointmentSettings(readJsonSetting(settingsStorageKeys.appointment, defaultAppointmentSettings()));
  }
  return normalizeAppointmentSettings(appointmentSettings);
}

function getSecuritySettings() {
  if (!securitySettings) {
    securitySettings = normalizeSecuritySettings(readJsonSetting(settingsStorageKeys.security, defaultSecuritySettings()));
  }
  return normalizeSecuritySettings(securitySettings);
}

function settingsMessage(target, message, success = true) {
  const element = document.querySelector(`[data-settings-message="${target}"]`);
  if (!element) return;
  element.className = success ? "settings-success" : "form-error settings-note";
  element.textContent = message;
}

const csvImportTokens = {
  patients: "",
  services: "",
  cabinets: "",
};

const csvImportConfig = {
  patients: {
    title: "Import pacjentów (CSV)",
    help: "Kolumny: first_name; last_name; pesel; birth_date; gender; phone; email; blood_group; allergies; notes",
    reload: loadPatients,
  },
  services: {
    title: "Import usług (CSV)",
    help: "Kolumny: name; specialization; duration; price; status; description",
    reload: loadServices,
  },
  cabinets: {
    title: "Import gabinetów (CSV)",
    help: "Kolumny: room_number; name; cabinet_type; floor; status; equipment; description",
    reload: loadCabinets,
  },
};

function exportFilenameFromHeaders(headers, fallback) {
  const disposition = headers?.get?.("Content-Disposition") || headers?.get?.("content-disposition") || "";
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].replace(/"/g, ""));
    } catch {
      return utfMatch[1].replace(/"/g, "");
    }
  }
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || fallback;
}

function showExportToast(message, success = true) {
  const existing = document.querySelector(".export-toast");
  existing?.remove();
  const toast = document.createElement("div");
  toast.className = `export-toast ${success ? "is-success" : "is-error"}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add("is-visible"), 10);
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 180);
  }, 2800);
}

function importPreviewArea(type) {
  return document.querySelector(`[data-import-preview-area="${type}"]`);
}

function importConfirmButton(type) {
  return document.querySelector(`[data-import-confirm="${type}"]`);
}

function normalizeImportApiData(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  return payload;
}

function updateImportConfirmState(type, summary = {}, mode = "preview") {
  const token = summary.token || csvImportTokens[type] || "";
  const validRows = Number(summary.validRows ?? summary.valid_rows ?? 0);
  const canImport = mode === "preview" && Boolean(token) && validRows > 0;
  const button = importConfirmButton(type);
  if (!button) return;
  button.disabled = !canImport;
  button.toggleAttribute("disabled", !canImport);
}

function renderImportSummary(type, data, mode = "preview") {
  const area = importPreviewArea(type);
  if (!area) return;
  const summary = normalizeImportApiData(data);
  const previewRows = Array.isArray(summary.preview) ? summary.preview : [];
  updateImportConfirmState(type, summary, mode);
  const tableRows = previewRows.map((item) => item?.row || item).filter(Boolean);

  const rowsHtml = tableRows.length
    ? `<div class="import-preview-table-wrap"><table class="import-preview-table">
        <thead><tr>${Object.keys(tableRows[0]).filter((key) => !key.startsWith("_")).slice(0, 6).map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead>
        <tbody>
          ${tableRows.map((row) => {
            const keys = Object.keys(row).filter((key) => !key.startsWith("_")).slice(0, 6);
            return `<tr>${keys.map((key) => `<td>${escapeHtml(row[key] ?? "")}</td>`).join("")}</tr>`;
          }).join("")}
        </tbody>
      </table></div>`
    : "";
  const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];
  const errors = Array.isArray(summary.errors) ? summary.errors : [];
  const resultText = mode === "done" ? "Import zakończony" : "Wynik sprawdzenia";

  area.innerHTML = `
    <div class="import-result ${mode === "done" ? "is-done" : ""}">
      <strong>${resultText}</strong>
      <div class="import-summary-grid">
        <span>Razem: <b>${escapeHtml(summary.totalRows ?? "-")}</b></span>
        <span>Poprawne: <b>${escapeHtml(summary.validRows ?? summary.inserted ?? 0)}</b></span>
        <span>Błędy: <b>${escapeHtml(summary.invalidRows ?? summary.invalidSkipped ?? 0)}</b></span>
        <span>Duplikaty: <b>${escapeHtml(summary.duplicates ?? summary.duplicatesSkipped ?? 0)}</b></span>
      </div>
      ${mode === "done" ? `<p class="import-success-text">Dodano rekordów: ${escapeHtml(summary.inserted ?? 0)}. Pominięto: ${escapeHtml(summary.skipped ?? 0)}.</p>` : ""}
      ${errors.length ? `<div class="import-message-list is-error">${errors.map((item) => `<p>${escapeHtml(item.line ? `Linia ${item.line}: ${item.errors?.join(" ")}` : item)}</p>`).join("")}</div>` : ""}
      ${warnings.length ? `<div class="import-message-list is-warning">${warnings.map((item) => `<p>${escapeHtml(item.line ? `Linia ${item.line}: ${item.warnings?.join(" ")}` : item)}</p>`).join("")}</div>` : ""}
      ${rowsHtml}
    </div>
  `;
}

function resetCsvImportPreview(type) {
  csvImportTokens[type] = "";
  importConfirmButton(type)?.setAttribute("disabled", "disabled");
  const area = importPreviewArea(type);
  if (area) area.innerHTML = "";
}

async function previewCsvImport(type) {
  const fileInput = document.querySelector(`[data-import-file="${type}"]`);
  const file = fileInput?.files?.[0];
  if (!file) {
    showExportToast("Wybierz plik CSV.", false);
    return;
  }

  const form = new FormData();
  form.append("file", file);
  const button = document.querySelector(`[data-import-preview="${type}"]`);
  button?.setAttribute("disabled", "disabled");
  importConfirmButton(type)?.setAttribute("disabled", "disabled");

  try {
    const response = await fetch(`backend/api/import.php?action=preview&type=${encodeURIComponent(type)}`, {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || `Błąd sprawdzania pliku (${response.status}).`);
    }
    const data = normalizeImportApiData(payload);
    csvImportTokens[type] = data.token || "";
    renderImportSummary(type, data, "preview");
    showExportToast("Plik został sprawdzony.", true);
  } catch (error) {
    csvImportTokens[type] = "";
    const area = importPreviewArea(type);
    if (area) {
      area.innerHTML = `<div class="import-result is-error">${escapeHtml(error?.message || "Nie udało się sprawdzić pliku.")}</div>`;
    }
    showExportToast(error?.message || "Nie udało się sprawdzić pliku.", false);
  } finally {
    button?.removeAttribute("disabled");
  }
}

async function refreshAfterCsvImport(type) {
  const reload = csvImportConfig[type]?.reload;
  if (typeof reload === "function") {
    await reload();
  }
  if (
    (type === "patients" && activeView === "patients") ||
    (type === "services" && activeView === "services") ||
    (type === "cabinets" && activeView === "rooms") ||
    activeView === "registration"
  ) {
    renderActiveView(activeView);
  }
}

async function confirmCsvImport(type) {
  const token = csvImportTokens[type];
  if (!token) {
    showExportToast("Najpierw sprawdź plik CSV.", false);
    return;
  }

  const form = new FormData();
  form.append("token", token);
  const button = importConfirmButton(type);
  button?.setAttribute("disabled", "disabled");

  try {
    const response = await fetch(`backend/api/import.php?action=confirm&type=${encodeURIComponent(type)}`, {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || `Błąd importu (${response.status}).`);
    }
    const data = normalizeImportApiData(payload);
    csvImportTokens[type] = "";
    renderImportSummary(type, data, "done");
    await refreshAfterCsvImport(type);
    showExportToast("Import zakończony.", true);
  } catch (error) {
    button?.removeAttribute("disabled");
    showExportToast(error?.message || "Nie udało się wykonać importu.", false);
  }
}

async function triggerDataExport(action) {
  if (authRoleKey(currentUser?.role) === "lekarz") {
    showExportToast("Brak uprawnień do eksportu danych.", false);
    return;
  }

  const url = `backend/api/export.php?action=${encodeURIComponent(action)}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "text/csv, application/json" },
    });

    if (!response.ok) {
      let message = "Nie udało się przygotować eksportu.";
      try {
        const payload = await response.json();
        message = payload?.message || message;
      } catch {
        message = `Błąd eksportu (${response.status}).`;
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const filename = exportFilenameFromHeaders(response.headers, `mediplus_export_${Date.now()}`);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    showExportToast("Eksport został przygotowany.", true);
  } catch (error) {
    console.warn("[MediPlus] Export failed:", error?.message || error);
    showExportToast(error?.message || "Nie udało się przygotować eksportu.", false);
  }
}

function renderSettings() {
  if (authRoleKey(currentUser.role) === "lekarz") {
    renderDoctorSettings();
    return;
  }
  renderReceptionSettings();
}

function renderSettingsHelp(text) {
  const safeText = escapeHtml(text || "");
  return `
    <span class="settings-help" tabindex="0" aria-label="${safeText}">
      <span class="settings-help-icon">?</span>
      <span class="settings-help-popup">${safeText}</span>
    </span>
  `;
}

function renderReceptionSettings() {
  const view = document.querySelector("#settingsView");
  if (!view) return;
  const clinic = getClinicSettings();
  const hours = getClinicWorkingHoursSettings();
  const appointment = getAppointmentSettings();
  const security = getSecuritySettings();
  const email = getEmailSettings();

  view.innerHTML = `
    <section class="page-head">
      <div>
        <h1>Ustawienia</h1>
        <p>Konfiguracja danych kliniki, rejestracji wizyt i bezpieczeństwa.</p>
      </div>
    </section>
    <section class="settings-layout settings-reception-layout">
      <form class="card settings-card settings-card-clinic" data-clinic-settings-form>
        <div class="settings-card-head"><div><h2>Dane kliniki</h2><p>Podstawowe dane placówki.</p></div><div class="settings-actions"><button class="primary-button" type="submit">Zapisz</button></div></div>
        <div class="settings-form-grid">
          <label class="settings-field"><span>Nazwa kliniki</span><input name="clinicName" value="${escapeHtml(clinic.clinicName)}"></label>
          <label class="settings-field"><span>NIP</span><input name="nip" value="${escapeHtml(clinic.nip)}"></label>
          <label class="settings-field"><span>REGON</span><input name="regon" value="${escapeHtml(clinic.regon)}"></label>
          <label class="settings-field"><span>Telefon</span><input name="phone" value="${escapeHtml(clinic.phone)}"></label>
          <label class="settings-field"><span>E-mail</span><input name="email" type="email" value="${escapeHtml(clinic.email)}"></label>
          <label class="settings-field"><span>Strona WWW</span><input name="website" value="${escapeHtml(clinic.website)}"></label>
          <label class="settings-field"><span>Adres</span><input name="address" value="${escapeHtml(clinic.address)}"></label>
          <label class="settings-field"><span>Miasto</span><input name="city" value="${escapeHtml(clinic.city)}"></label>
          <label class="settings-field"><span>Kod pocztowy</span><input name="postalCode" value="${escapeHtml(clinic.postalCode)}"></label>
        </div>
        <p data-settings-message="clinic"></p>
      </form>

      <form class="card settings-card settings-card-appointment settings-card-priority" data-appointment-settings-form>
        <div class="settings-card-head"><div><h2>Ustawienia rejestracji</h2><p>Reguły zapisu na wizyty.</p></div><div class="settings-actions"><button class="primary-button" type="submit">Zapisz</button></div></div>
        <div class="settings-check-list">
          <label class="settings-check"><input type="checkbox" name="allowOverlaps" ${appointment.allowOverlaps ? "checked" : ""}> <span class="settings-check-text">Pozwalaj na nakładanie wizyt ${renderSettingsHelp("Włączone: system może dopuścić pracę z wizytami nachodzącymi na siebie. Wyłączone: ten sam lekarz i ten sam gabinet nie powinny mieć dwóch wizyt w tym samym czasie.")}</span></label>
          <label class="settings-check"><input type="checkbox" name="autoCompletePast" ${appointment.autoCompletePast ? "checked" : ""}> <span class="settings-check-text">Automatycznie oznacz zakończone wizyty ${renderSettingsHelp("Włączone: wizyty z przeszłości bez statusu anulowania lub nieobecności pacjenta powinny być traktowane jako zrealizowane. Wyłączone: status powinien pozostać ręczny/backendowy.")}</span></label>
          <label class="settings-check"><input type="checkbox" name="hideInactiveServices" ${appointment.hideInactiveServices ? "checked" : ""}> <span class="settings-check-text">Ukrywaj nieaktywne usługi ${renderSettingsHelp("Włączone: nieaktywne usługi nie pojawiają się przy zapisie wizyty. Nadal pozostają widoczne w katalogu usług. Wyłączone: można je pokazać w rejestracji jako pozycje administracyjne.")}</span></label>
          <label class="settings-field inline"><span>Domyślny odstęp między wizytami (minuty) ${renderSettingsHelp("Określa krok proponowanych godzin w rejestracji, np. 15 minut daje godziny 08:00, 08:15, 08:30. Wartość 0 używa domyślnego kroku systemowego.")}</span><input type="number" min="0" name="visitInterval" value="${escapeHtml(appointment.minIntervalMinutes ?? appointment.visitInterval)}"></label>
        </div>
        <p data-settings-message="appointment"></p>
      </form>

      <form class="card settings-card settings-card-hours settings-card-priority" data-clinic-hours-form>
        <div class="settings-card-head"><div><h2>Godziny pracy kliniki</h2><p>Te godziny ograniczają dostępne terminy wizyt.</p></div><div class="settings-actions"><button class="primary-button" type="submit">Zapisz</button></div></div>
        <div class="settings-day-list">
          ${doctorScheduleDays.map((day) => {
            const entry = hours[day.key] || defaultClinicWorkingHours()[day.key];
            const closed = !entry.active;
            return `
              <div class="settings-day-row ${closed ? "is-closed" : ""}">
                <strong>${day.label}</strong>
                <label><span>Od</span><input type="time" name="${day.key}_start" value="${escapeHtml(entry.start || "")}"></label>
                <label><span>Do</span><input type="time" name="${day.key}_end" value="${escapeHtml(entry.end || "")}"></label>
                <label class="settings-check compact"><input type="checkbox" name="${day.key}_closed" ${closed ? "checked" : ""}> Zamknięte</label>
              </div>
            `;
          }).join("")}
        </div>
        <p data-settings-message="hours"></p>
      </form>

      <form class="card settings-card settings-card-security" data-security-settings-form>
        <div class="settings-card-head"><div><h2>Bezpieczeństwo</h2><p>Ustawienia haseł i sesji.</p></div><div class="settings-actions"><button class="primary-button" type="submit">Zapisz</button></div></div>
        <div class="settings-check-list">
          <label class="settings-field inline"><span>Minimalna długość hasła ${renderSettingsHelp("Minimalna liczba znaków wymagana przy zmianie hasła użytkownika. Wartość poniżej 6 jest automatycznie podnoszona do 6.")}</span><input type="number" min="6" name="minPasswordLength" value="${escapeHtml(security.minPasswordLength)}"></label>
          <label class="settings-check"><input type="checkbox" name="forcePasswordChangeAfterReset" ${security.forcePasswordChangeAfterReset ? "checked" : ""}> <span class="settings-check-text">Wymagaj zmiany hasła po resecie ${renderSettingsHelp("Po resecie hasła użytkownik powinien zalogować się hasłem tymczasowym i zmienić je na własne. Działa razem z obsługą must_change_password po stronie logowania.")}</span></label>
          <label class="settings-check"><input type="checkbox" name="autoLogoutEnabled" ${security.autoLogoutEnabled ? "checked" : ""}> <span class="settings-check-text">Automatyczne wylogowanie po bezczynności ${renderSettingsHelp("Po włączeniu system powinien wylogować użytkownika po czasie bez aktywności określonym poniżej. Przydatne na stanowiskach recepcji.")}</span></label>
          <label class="settings-field inline"><span>Czas bezczynności (min) ${renderSettingsHelp("Liczba minut bezczynności używana przez automatyczne wylogowanie. Ma sens tylko wtedy, gdy opcja automatycznego wylogowania jest włączona.")}</span><input type="number" min="1" name="inactivityTimeoutMinutes" value="${escapeHtml(security.inactivityTimeoutMinutes)}"></label>
        </div>
        <p data-settings-message="security"></p>
      </form>

      <form class="card settings-card settings-card-email settings-card-priority" data-email-settings-form>
        <div class="settings-card-head">
          <div>
            <h2>Powiadomienia e-mail</h2>
            <p>Konfiguracja SMTP do potwierdzeń i anulowania wizyt dla pacjentów.</p>
          </div>
          <div class="settings-actions">
            <button class="secondary-button" type="button" data-email-test>Wyślij wiadomość testową</button>
            <button class="primary-button" type="submit">Zapisz</button>
          </div>
        </div>
        <div class="settings-form-grid">
          <label class="settings-field"><span>SMTP Host</span><input name="smtpHost" value="${escapeHtml(email.smtpHost)}" placeholder="smtp.example.com"></label>
          <label class="settings-field"><span>SMTP Port</span><input type="number" min="1" max="65535" name="smtpPort" value="${escapeHtml(email.smtpPort)}"></label>
          <label class="settings-field"><span>SMTP Username</span><input name="smtpUsername" value="${escapeHtml(email.smtpUsername)}" autocomplete="username"></label>
          <label class="settings-field"><span>SMTP Password</span><input type="password" name="smtpPassword" value="" autocomplete="new-password" placeholder="${email.passwordConfigured ? "••••••••" : "Hasło SMTP"}"></label>
          <label class="settings-field"><span>Szyfrowanie</span>
            <select name="encryption">
              ${[
                ["none", "None"],
                ["ssl", "SSL"],
                ["tls", "TLS"],
              ].map(([value, label]) => `<option value="${value}" ${email.encryption === value ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
          <label class="settings-field"><span>Nazwa nadawcy</span><input name="senderName" value="${escapeHtml(email.senderName)}"></label>
          <label class="settings-field"><span>E-mail nadawcy</span><input type="email" name="senderEmail" value="${escapeHtml(email.senderEmail)}" placeholder="rejestracja@mediplus.pl"></label>
        </div>
        <p class="settings-export-note">Wiadomości są wysyłane tylko dla wizyt i tylko gdy pacjent ma uzupełniony e-mail. Hasło SMTP nie jest zwracane do przeglądarki.</p>
        <p data-settings-message="email"></p>
      </form>

      <section class="card settings-card settings-card-system">
        <div class="settings-card-head"><div><h2>System</h2><p>Informacje techniczne i liczba rekordów.</p></div></div>
        <div class="settings-system-grid">
          ${[
            ["Wersja systemu", "1.0.0"],
            ["Liczba lekarzy", doctors.length],
            ["Liczba pacjentów", patients.length],
            ["Liczba użytkowników", users.length],
            ["Liczba gabinetów", cabinets.length],
            ["Liczba usług", services.length],
          ].map(([label, value]) => `<div class="settings-system-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
        </div>
      </section>

      <section class="card settings-card settings-card-transfer export-settings-card">
        <div class="settings-card-head">
          <div>
            <h2>Import / Eksport danych</h2>
            <p>Eksport danych kliniki oraz bezpieczny import CSV pacjentów, usług i gabinetów.</p>
          </div>
        </div>
        <div class="settings-transfer-stack">
          <div class="settings-import-section">
            <div class="settings-subhead">
              <h3>Import danych</h3>
              <p>Najpierw sprawdź plik. Import zapisze tylko poprawne, nowe rekordy i nie nadpisze istniejących danych.</p>
            </div>
            <div class="import-blocks-grid">
              ${Object.entries(csvImportConfig).map(([type, config]) => `
                <article class="import-block" data-import-block="${escapeHtml(type)}">
                  <div>
                    <h4>${escapeHtml(config.title)} ${renderSettingsHelp(`Wymagany format CSV: ${config.help}`)}</h4>
                  </div>
                  <input type="file" accept=".csv,text/csv" data-import-file="${escapeHtml(type)}">
                  <div class="import-block-actions">
                    <button class="secondary-button" type="button" data-import-preview="${escapeHtml(type)}">Sprawdź plik</button>
                    <button class="primary-button" type="button" data-import-confirm="${escapeHtml(type)}" disabled>Importuj</button>
                  </div>
                  <div class="import-preview-area" data-import-preview-area="${escapeHtml(type)}"></div>
                </article>
              `).join("")}
            </div>
          </div>
          <div class="settings-export-section">
            <div class="settings-subhead">
              <h3>Eksport danych</h3>
              <p>Pliki CSV są kodowane jako UTF-8 z BOM dla zgodności z Excelem.</p>
            </div>
            <div class="export-actions-grid">
              <button class="secondary-button export-button" type="button" data-export-action="patients_csv">Eksport pacjentów (CSV)</button>
              <button class="secondary-button export-button" type="button" data-export-action="doctors_csv">Eksport lekarzy (CSV)</button>
              <button class="secondary-button export-button" type="button" data-export-action="appointments_csv">Eksport wizyt (CSV)</button>
              <button class="secondary-button export-button" type="button" data-export-action="cabinets_csv">Eksport gabinetów (CSV)</button>
              <button class="secondary-button export-button" type="button" data-export-action="services_csv">Eksport usług (CSV)</button>
              <button class="primary-button export-button" type="button" data-export-action="full_backup_json">Eksport pełnej kopii (JSON)</button>
            </div>
            <p class="settings-export-note">Eksport nie zawiera haseł, sesji ani stanów odczytu powiadomień.</p>
          </div>
        </div>
      </section>
    </section>
  `;

  view.querySelector("[data-clinic-settings-form]")?.addEventListener("submit", saveClinicSettings);
  view.querySelector("[data-clinic-hours-form]")?.addEventListener("submit", saveClinicWorkingHours);
  view.querySelector("[data-appointment-settings-form]")?.addEventListener("submit", saveAppointmentSettings);
  view.querySelector("[data-security-settings-form]")?.addEventListener("submit", saveSecuritySettings);
  view.querySelector("[data-email-settings-form]")?.addEventListener("submit", saveEmailSettings);
  view.querySelector("[data-email-test]")?.addEventListener("click", sendTestEmail);
  view.querySelectorAll("[data-export-action]").forEach((button) => {
    button.addEventListener("click", () => triggerDataExport(button.dataset.exportAction));
  });
  view.querySelectorAll("[data-import-preview]").forEach((button) => {
    button.addEventListener("click", () => previewCsvImport(button.dataset.importPreview));
  });
  view.querySelectorAll("[data-import-confirm]").forEach((button) => {
    button.addEventListener("click", () => confirmCsvImport(button.dataset.importConfirm));
  });
  view.querySelectorAll("[data-import-file]").forEach((input) => {
    input.addEventListener("change", () => resetCsvImportPreview(input.dataset.importFile));
  });
  bindPolishPhoneInputs(view);
}

function renderReadonlyClinicHours() {
  const hours = getClinicWorkingHoursSettings();
  return `
    <div class="doctor-settings-schedule clinic-hours-readonly">
      ${doctorScheduleDays.map((day) => {
        const entry = hours[day.key] || defaultClinicWorkingHours()[day.key];
        const closed = !entry.active;
        return `
          <div class="settings-day-row read-only ${closed ? "is-closed" : ""}">
            <strong><span class="doctor-day-badge">${day.short}</span> ${day.label}</strong>
            <span>${closed ? "Zamknięte" : `${escapeHtml(entry.start)}–${escapeHtml(entry.end)}`}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderDoctorSettings() {
  const view = document.querySelector("#settingsView");
  if (!view) return;
  const doctor = currentUserDoctorProfile();
  const security = getSecuritySettings();

  view.innerHTML = `
    <section class="page-head">
      <div>
        <h1>Ustawienia</h1>
        <p>Profil lekarza, harmonogram pracy i zmiana hasła.</p>
      </div>
    </section>
    <section class="settings-layout doctor-settings-layout">
      <section class="card settings-card doctor-settings-profile-card">
        <div class="settings-card-head"><div><h2>Mój profil</h2><p>Dane powiązane z kontem lekarza.</p></div></div>
        ${doctor ? `
          <div class="doctor-settings-profile-body">
            ${renderDoctorAvatar(doctor, { size: 72 })}
            <div class="doctor-settings-profile-copy">
              <h3>${escapeHtml(doctorFullName(doctor))}</h3>
              <p>${escapeHtml(doctor.specialization || "Brak specjalizacji")}</p>
              <div class="settings-pill-row">${doctorStatusBadge(doctor)} <span class="user-role-badge">Lekarz</span></div>
            </div>
          </div>
          <dl class="details-list settings-info-list doctor-settings-info-list">
            <div><dt>Telefon</dt><dd><strong>${escapeHtml(doctor.phone || "Brak danych")}</strong></dd></div>
            <div><dt>E-mail</dt><dd><strong>${escapeHtml(doctor.email || currentUser.email || "Brak danych")}</strong></dd></div>
            <div><dt>Gabinet</dt><dd><strong>${escapeHtml(getDoctorCabinetName(doctor))}</strong></dd></div>
            <div><dt>Status</dt><dd><strong>${escapeHtml(doctorStatusLabel(doctor))}</strong></dd></div>
          </dl>
        ` : `<div class="user-warning">Brak powiązanego profilu lekarza.</div>`}
      </section>

      <form class="card settings-card" data-password-change-form>
        <div class="settings-card-head"><div><h2>Zmiana hasła</h2><p>Hasło musi mieć minimum ${escapeHtml(security.minPasswordLength)} znaków.</p></div></div>
        <div class="settings-form-grid single-column">
          <label class="settings-field"><span>Obecne hasło</span><input type="password" name="currentPassword" autocomplete="current-password"></label>
          <label class="settings-field"><span>Nowe hasło</span><input type="password" name="newPassword" autocomplete="new-password"></label>
          <label class="settings-field"><span>Powtórz nowe hasło</span><input type="password" name="repeatPassword" autocomplete="new-password"></label>
        </div>
        <p class="doctor-password-message" data-settings-message="password"></p>
        <div class="settings-password-actions"><button class="primary-button" type="submit">Zmień hasło</button></div>
      </form>

      <section class="card settings-card doctor-settings-schedule-card">
        <div class="settings-card-head"><div><h2>Moje godziny pracy</h2><p>Harmonogram jest zarządzany przez recepcję.</p></div></div>
        <div class="doctor-settings-schedule">${doctor ? renderDoctorScheduleRows(doctor) : `<p class="empty-note">Brak harmonogramu.</p>`}</div>
      </section>

      <section class="card settings-card doctor-settings-schedule-card">
        <div class="settings-card-head"><div><h2>Godziny pracy kliniki</h2><p>Widok informacyjny.</p></div></div>
        ${renderReadonlyClinicHours()}
      </section>
    </section>
  `;

  view.querySelector("[data-password-change-form]")?.addEventListener("submit", changeCurrentUserPassword);
}

async function saveClinicSettings(event) {
  event?.preventDefault?.();
  const form = event.currentTarget;
  formatPolishPhoneFields(form);
  const data = new FormData(form);
  const value = normalizeClinicSettings({
    name: String(data.get("clinicName") || "").trim() || "MediPlus Klinika Zdrowia",
    clinicName: String(data.get("clinicName") || "").trim() || "MediPlus Klinika Zdrowia",
    nip: String(data.get("nip") || "").trim(),
    regon: String(data.get("regon") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    website: String(data.get("website") || "").trim(),
    address: String(data.get("address") || "").trim(),
    city: String(data.get("city") || "").trim(),
    postalCode: String(data.get("postalCode") || "").trim(),
  });
  const response = await saveSystemSetting("clinic", value);
  if (response !== null) {
    clinicSettings = response;
    saveJsonSetting(settingsStorageKeys.clinic, clinicSettings);
    settingsMessage("clinic", "Dane kliniki zapisane w bazie danych.");
  } else {
    clinicSettings = value;
    saveJsonSetting(settingsStorageKeys.clinic, clinicSettings);
    settingsMessage("clinic", "Backend niedostępny. Dane kliniki zapisane lokalnie.", false);
  }
  if (activeView === "settings") renderSettings();
}

async function saveClinicWorkingHours(event) {
  event?.preventDefault?.();
  const form = event.currentTarget;
  const value = {};
  doctorScheduleDays.forEach((day) => {
    const closed = Boolean(form.elements[`${day.key}_closed`]?.checked);
    value[day.key] = {
      active: !closed,
      start: closed ? "" : formatTime(form.elements[`${day.key}_start`]?.value || "08:00"),
      end: closed ? "" : formatTime(form.elements[`${day.key}_end`]?.value || "18:00"),
    };
  });
  const normalized = normalizeClinicWorkingHours(value);
  const response = await apiPut("backend/api/settings.php?action=clinic_working_hours", clinicWorkingHoursToApiPayload(normalized));
  if (response !== null) {
    clinicWorkingHours = normalizeClinicWorkingHours(response);
    saveJsonSetting(settingsStorageKeys.workingHours, clinicWorkingHours);
    settingsMessage("hours", "Godziny pracy kliniki zapisane w bazie danych.");
  } else {
    clinicWorkingHours = normalized;
    saveJsonSetting(settingsStorageKeys.workingHours, clinicWorkingHours);
    settingsMessage("hours", "Backend niedostępny. Godziny zapisane lokalnie.", false);
  }
  if (activeView === "dashboard") renderDashboard();
  if (activeView === "calendar") renderCalendar();
  if (activeView === "registration") renderRegistration();
  if (elements.appointmentModal && !elements.appointmentModal.classList.contains("is-hidden")) {
    renderAvailableTimeButtons();
  }
}

async function saveAppointmentSettings(event) {
  event?.preventDefault?.();
  const form = event.currentTarget;
  const value = normalizeAppointmentSettings({
    allowOverlaps: Boolean(form.elements.allowOverlaps?.checked),
    autoCompletePast: Boolean(form.elements.autoCompletePast?.checked),
    hideInactiveServices: Boolean(form.elements.hideInactiveServices?.checked),
    minIntervalMinutes: Number(form.elements.visitInterval?.value || 15),
  });
  const response = await saveSystemSetting("appointment", appointmentSettingsToApiPayload(value));
  if (response !== null) {
    appointmentSettings = normalizeAppointmentSettings(response);
    saveJsonSetting(settingsStorageKeys.appointment, appointmentSettings);
    settingsMessage("appointment", "Ustawienia rejestracji zapisane w bazie danych.");
  } else {
    appointmentSettings = value;
    saveJsonSetting(settingsStorageKeys.appointment, appointmentSettings);
    settingsMessage("appointment", "Backend niedostępny. Ustawienia zapisane lokalnie.", false);
  }
  populateServiceFields(services);
  if (activeView === "registration") renderRegistration();
  if (elements.appointmentModal && !elements.appointmentModal.classList.contains("is-hidden")) {
    renderAvailableTimeButtons();
  }
  if (activeView === "dashboard") renderDashboard();
}

async function saveSecuritySettings(event) {
  event?.preventDefault?.();
  const form = event.currentTarget;
  const value = normalizeSecuritySettings({
    minPasswordLength: Math.max(6, Number(form.elements.minPasswordLength?.value || 8)),
    forcePasswordChangeAfterReset: Boolean(form.elements.forcePasswordChangeAfterReset?.checked),
    autoLogoutEnabled: Boolean(form.elements.autoLogoutEnabled?.checked),
    inactivityTimeoutMinutes: Math.max(1, Number(form.elements.inactivityTimeoutMinutes?.value || 30)),
  });
  const response = await saveSystemSetting("security", value);
  if (response !== null) {
    securitySettings = response;
    saveJsonSetting(settingsStorageKeys.security, securitySettings);
    settingsMessage("security", "Ustawienia bezpieczeństwa zapisane w bazie danych.");
  } else {
    securitySettings = value;
    saveJsonSetting(settingsStorageKeys.security, securitySettings);
    settingsMessage("security", "Backend niedostępny. Ustawienia zapisane lokalnie.", false);
  }
  if (activeView === "settings") renderSettings();
}

async function saveEmailSettings(event) {
  event?.preventDefault?.();
  const form = event.currentTarget;
  const value = {
    smtpHost: String(form.elements.smtpHost?.value || "").trim(),
    smtpPort: Number(form.elements.smtpPort?.value || 587),
    smtpUsername: String(form.elements.smtpUsername?.value || "").trim(),
    smtpPassword: String(form.elements.smtpPassword?.value || ""),
    encryption: String(form.elements.encryption?.value || "tls"),
    senderName: String(form.elements.senderName?.value || "").trim() || "MediPlus",
    senderEmail: String(form.elements.senderEmail?.value || "").trim(),
  };

  try {
    const response = await apiRequest("backend/api/email_settings.php", {
      method: "PUT",
      body: value,
    });
    emailSettings = normalizeEmailSettings(response.data || response);
    settingsMessage("email", "Ustawienia e-mail zapisane w bazie danych.");
    form.elements.smtpPassword.value = "";
    if (activeView === "settings") renderSettings();
  } catch (error) {
    settingsMessage("email", error.message || "Nie udało się zapisać ustawień e-mail.", false);
  }
}

async function sendTestEmail() {
  try {
    await apiRequest("backend/api/email.php?action=test", { method: "POST" });
    showExportToast("Wiadomość testowa została wysłana.", true);
    settingsMessage("email", "Wiadomość testowa została wysłana.");
  } catch (error) {
    showExportToast(error.message || "Nie udało się wysłać wiadomości testowej.", false);
    settingsMessage("email", error.message || "Nie udało się wysłać wiadomości testowej.", false);
  }
}

async function changeCurrentUserPassword(event) {
  event?.preventDefault?.();
  const form = event.currentTarget;
  const currentPassword = String(form.elements.currentPassword?.value || "");
  const newPassword = String(form.elements.newPassword?.value || "");
  const repeatPassword = String(form.elements.repeatPassword?.value || "");
  const minLength = getSecuritySettings().minPasswordLength || 8;

  if (!currentPassword || !newPassword || !repeatPassword) {
    settingsMessage("password", "Uzupełnij wszystkie pola.", false);
    return;
  }
  if (newPassword !== repeatPassword) {
    settingsMessage("password", "Nowe hasła nie są takie same.", false);
    return;
  }
  if (newPassword.length < minLength) {
    settingsMessage("password", `Nowe hasło musi mieć minimum ${minLength} znaków.`, false);
    return;
  }

  try {
    const response = await apiRequest("backend/api/auth.php?action=change_password", {
      method: "POST",
      body: {
        current_password: currentPassword,
        new_password: newPassword,
      },
    });
    currentUser.must_change_password = false;
    form.reset();
    settingsMessage("password", response.message || "Hasło zostało zmienione.");
  } catch (error) {
    settingsMessage("password", error.message || "Nie udało się zmienić hasła.", false);
  }
}

// ==============================
// Visit history
// ==============================
function renderHistory() {
  if (authRoleKey(currentUser.role) === "lekarz") {
    renderDoctorHistory();
    return;
  }
  renderReceptionHistory();
}

function getHistoryBaseAppointments({ doctorMode = false } = {}) {
  const doctorId = doctorMode ? getCurrentDoctorId() : null;
  return appointments
    .filter((appointment) => !doctorId || isAppointmentForDoctor(appointment, doctorId))
    .sort((a, b) => (appointmentStartDateTime(b)?.getTime() || 0) - (appointmentStartDateTime(a)?.getTime() || 0));
}

function normalizeHistoryStatusValue(value) {
  const text = String(value || "all").trim().toLowerCase();
  if (["zaplanowana", "planned"].includes(text)) return "Zaplanowana";
  if (["w trakcie", "in-progress", "in_progress"].includes(text)) return "W trakcie";
  if (["zrealizowana", "completed", "done"].includes(text)) return "Zrealizowana";
  if (["anulowana", "cancelled", "canceled"].includes(text)) return "Anulowana";
  if (["nieobecny pacjent", "no_show", "no-show"].includes(text)) return "Nieobecny pacjent";
  return "all";
}

function historyAppointmentDateIso(appointment) {
  const start = appointmentStartDateTime(appointment);
  if (start) return dateToIso(start);
  return getAppointmentDateIso(appointment, getMonday(parseLocalDate(selectedDate)));
}

function historyAppointmentMatchesSearch(appointment, doctorMode = false) {
  const query = historySearchQuery.trim().toLowerCase();
  if (!query) return true;

  const doctor = findDoctorByAppointment(appointment);
  const patient = findPatientForAppointment(appointment);
  const haystack = [
    appointment.patient,
    patientFullName(patient),
    appointment.serviceName,
    appointment.specialization,
    appointment.notes,
    doctorMode ? "" : appointment.doctor,
    doctorMode ? "" : doctorFullName(doctor),
  ].join(" ").toLowerCase();

  return haystack.includes(query);
}

function filterHistoryAppointments(sourceAppointments, { doctorMode = false } = {}) {
  const statusFilter = normalizeHistoryStatusValue(historyStatusFilter);
  return sourceAppointments.filter((appointment) => {
    const status = getResolvedAppointmentStatus(appointment);
    const dateIso = historyAppointmentDateIso(appointment);

    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (historyDateFrom && dateIso < historyDateFrom) return false;
    if (historyDateTo && dateIso > historyDateTo) return false;
    if (!historyAppointmentMatchesSearch(appointment, doctorMode)) return false;

    if (!doctorMode && historyDoctorFilter !== "all" && historyDoctorFilter) {
      const doctorKey = calendarAppointmentDoctorKey(appointment);
      const doctorName = String(appointment.doctor || "").trim();
      if (String(historyDoctorFilter) !== String(doctorKey) && String(historyDoctorFilter) !== doctorName) return false;
    }

    if (!doctorMode && historyCabinetFilter !== "all" && historyCabinetFilter) {
      const cabinetKey = calendarAppointmentCabinetKey(appointment);
      if (String(historyCabinetFilter) !== String(cabinetKey)) return false;
    }

    if (!doctorMode && historyServiceFilter !== "all" && historyServiceFilter) {
      const serviceKey = calendarAppointmentServiceKey(appointment);
      const serviceNameValue = String(appointment.serviceName || appointment.specialization || "").trim();
      if (String(historyServiceFilter) !== String(serviceKey) && String(historyServiceFilter) !== serviceNameValue) return false;
    }

    return true;
  });
}

function getHistoryStats(visibleAppointments) {
  const stats = {
    all: visibleAppointments.length,
    planned: 0,
    inProgress: 0,
    done: 0,
    cancelled: 0,
    noShow: 0,
  };

  visibleAppointments.forEach((appointment) => {
    const status = getResolvedAppointmentStatus(appointment);
    if (status === "Zaplanowana") stats.planned += 1;
    if (status === "W trakcie") stats.inProgress += 1;
    if (status === "Zrealizowana") stats.done += 1;
    if (status === "Anulowana") stats.cancelled += 1;
    if (status === "Nieobecny pacjent") stats.noShow += 1;
  });

  return stats;
}

function getTopHistoryServices(visibleAppointments) {
  const counts = new Map();
  visibleAppointments.forEach((appointment) => {
    const name = String(appointment.serviceName || appointment.specialization || "Brak danych").trim();
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}

function getHistoryInitials(name) {
  return String(name || "BD")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "BD";
}

function renderHistoryPerson(name, subtitle = "", avatarClass = "") {
  return `
    <div class="history-person">
      <span class="history-avatar ${avatarClass}">${escapeHtml(getHistoryInitials(name || "BD"))}</span>
      <div class="history-person-text">
        <strong>${escapeHtml(name || "Brak danych")}</strong>
        ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
      </div>
    </div>
  `;
}

function renderHistoryDateCell(appointment) {
  const start = appointmentStartDateTime(appointment);
  const end = appointmentEndDateTime(appointment);
  return `
    <div class="history-date-cell">
      <strong>${escapeHtml(start ? formatFullDate(start) : "Brak daty")}</strong>
      <span>${escapeHtml(start ? formatTime(start) : "—")}${end ? `–${escapeHtml(formatTime(end))}` : ""}</span>
    </div>
  `;
}

function renderHistoryServiceCell(appointment) {
  const duration = appointmentDurationMinutes(appointment);
  return `
    <div class="history-service-cell">
      <strong>${escapeHtml(appointment.serviceName || appointment.specialization || "Brak danych")}</strong>
      <span>${duration ? `${escapeHtml(duration)} min` : "Brak danych"}</span>
    </div>
  `;
}

function renderHistoryCabinetCell(appointment) {
  return `
    <div class="history-cabinet-cell">
      <strong>${escapeHtml(appointment.cabinet || appointment.cabinet_name || "Brak danych")}</strong>
      <span>${escapeHtml(appointment.cabinetLocation || appointment.location || "")}</span>
    </div>
  `;
}

function renderHistoryRows(visibleAppointments, { doctorMode = false } = {}) {
  if (!visibleAppointments.length) {
    const colspan = doctorMode ? 5 : 7;
    return `<tr><td colspan="${colspan}"><div class="empty-state">Brak wizyt do wyświetlenia.</div></td></tr>`;
  }

  const startIndex = (historyPage - 1) * historyRowsPerPage;
  const pageRows = visibleAppointments.slice(startIndex, startIndex + historyRowsPerPage);

  return pageRows.map((appointment) => {
    const patient = findPatientForAppointment(appointment);
    const doctor = findDoctorByAppointment(appointment);
    const appointmentId = escapeHtml(appointment.id || appointment.appointment_id || "");
    const patientCell = renderHistoryPerson(patientFullName(patient) || appointment.patient, patient?.phone || appointment.phone || "");
    const cancelButton = !doctorMode && canCancelAppointment(appointment)
      ? `<button class="secondary-button danger-soft" type="button" data-history-cancel="${appointmentId}">Anuluj wizytę</button>`
      : "";

    if (doctorMode) {
      return `
        <tr>
          <td>${renderHistoryDateCell(appointment)}</td>
          <td>${patientCell}</td>
          <td>${renderHistoryServiceCell(appointment)}</td>
          <td>${appointmentStatusBadge(appointment)}</td>
          <td><div class="history-actions"><button class="secondary-button" type="button" data-history-details="${appointmentId}">Szczegóły</button></div></td>
        </tr>
      `;
    }

    return `
      <tr>
        <td>${renderHistoryDateCell(appointment)}</td>
        <td>${patientCell}</td>
        <td>${renderHistoryPerson(doctorFullName(doctor) || appointment.doctor, doctor?.specialization || appointment.doctorSpecialization || "", "doctor-avatar-small")}</td>
        <td>${renderHistoryServiceCell(appointment)}</td>
        <td>${renderHistoryCabinetCell(appointment)}</td>
        <td>${appointmentStatusBadge(appointment)}</td>
        <td><div class="history-actions"><button class="secondary-button" type="button" data-history-details="${appointmentId}">Szczegóły</button>${cancelButton}</div></td>
      </tr>
    `;
  }).join("");
}

function renderHistorySummary(stats) {
  return `
    <section class="history-summary-card card">
      <h3>Podsumowanie</h3>
      <div class="history-summary-row"><span>Wszystkie wizyty</span><strong>${stats.all}</strong></div>
      <div class="history-summary-row planned"><span>Zaplanowane</span><strong>${stats.planned}</strong></div>
      <div class="history-summary-row in-progress"><span>W trakcie</span><strong>${stats.inProgress}</strong></div>
      <div class="history-summary-row done"><span>Zrealizowane</span><strong>${stats.done}</strong></div>
      <div class="history-summary-row cancelled"><span>Anulowane</span><strong>${stats.cancelled}</strong></div>
      <div class="history-summary-row no-show"><span>Nieobecny pacjent</span><strong>${stats.noShow}</strong></div>
    </section>
  `;
}

function renderHistoryTopServices(visibleAppointments) {
  const servicesList = getTopHistoryServices(visibleAppointments);
  return `
    <section class="history-services-card card">
      <h3>Najczęstsze usługi</h3>
      ${servicesList.length ? servicesList.map(([name, count]) => `
        <div class="history-service-row"><span>${escapeHtml(name)}</span><strong>${count}</strong></div>
      `).join("") : `<p class="empty-note">Brak danych o usługach.</p>`}
    </section>
  `;
}

function renderHistoryFilters({ doctorMode = false } = {}) {
  const statusOptions = ["all", "Zaplanowana", "W trakcie", "Zrealizowana", "Anulowana", "Nieobecny pacjent"];
  const doctorOptions = doctors.map((doctor) => {
    const id = doctor.id ?? doctor.doctor_id;
    return `<option value="${escapeHtml(id)}" ${String(historyDoctorFilter) === String(id) ? "selected" : ""}>${escapeHtml(doctorFullName(doctor))}</option>`;
  }).join("");
  const cabinetOptions = cabinets.map((cabinet) => {
    const id = cabinet.id ?? cabinet.cabinet_id ?? cabinet.name;
    return `<option value="${escapeHtml(id)}" ${String(historyCabinetFilter) === String(id) ? "selected" : ""}>${escapeHtml(cabinet.name || `Gabinet ${id}`)}</option>`;
  }).join("");
  const serviceOptions = services.map((service) => {
    const id = service.id ?? service.service_id ?? service.name;
    return `<option value="${escapeHtml(id)}" ${String(historyServiceFilter) === String(id) ? "selected" : ""}>${escapeHtml(serviceName(service))}</option>`;
  }).join("");

  return `
    <section class="history-filter-card card">
      <div class="history-side-title"><h3>Filtry</h3></div>
      <div class="history-date-grid">
        <label>Data od<input type="date" data-history-date-from value="${escapeHtml(historyDateFrom)}"></label>
        <label>Data do<input type="date" data-history-date-to value="${escapeHtml(historyDateTo)}"></label>
      </div>
      ${!doctorMode ? `
        <label>Lekarz<select data-history-doctor><option value="all">Wszyscy lekarze</option>${doctorOptions}</select></label>
        <label>Gabinet<select data-history-cabinet><option value="all">Wszystkie gabinety</option>${cabinetOptions}</select></label>
        <label>Usługa<select data-history-service><option value="all">Wszystkie usługi</option>${serviceOptions}</select></label>
      ` : ""}
      <label>Status<select data-history-status>
        ${statusOptions.map((status) => `<option value="${escapeHtml(status)}" ${normalizeHistoryStatusValue(historyStatusFilter) === normalizeHistoryStatusValue(status) ? "selected" : ""}>${status === "all" ? "Wszystkie statusy" : escapeHtml(status)}</option>`).join("")}
      </select></label>
      <div class="history-filter-actions">
        <button class="secondary-button" type="button" data-history-clear-filters>Wyczyść filtry</button>
        <button class="primary-button" type="button" data-history-apply-filters>Zastosuj filtry</button>
      </div>
    </section>
  `;
}

function renderHistoryPagination(total) {
  const totalPages = Math.max(1, Math.ceil(total / historyRowsPerPage));
  historyPage = Math.min(historyPage, totalPages);
  const start = total ? (historyPage - 1) * historyRowsPerPage + 1 : 0;
  const end = Math.min(total, historyPage * historyRowsPerPage);

  return `
    <div class="history-pagination">
      <label>Pokaż na stronie
        <select data-history-page-size>
          ${[10, 20, 50].map((size) => `<option value="${size}" ${historyRowsPerPage === size ? "selected" : ""}>${size}</option>`).join("")}
        </select>
      </label>
      <span>${start} – ${end} z ${total} wizyt</span>
      <div class="history-page-buttons">
        <button class="secondary-button" type="button" data-history-prev ${historyPage <= 1 ? "disabled" : ""}>‹</button>
        <strong>${historyPage}</strong>
        <button class="secondary-button" type="button" data-history-next ${historyPage >= totalPages ? "disabled" : ""}>›</button>
      </div>
    </div>
  `;
}

function renderHistoryShell({ doctorMode = false } = {}) {
  const view = document.querySelector("#historyView");
  if (!view) return;

  const baseAppointments = getHistoryBaseAppointments({ doctorMode });
  const visibleAppointments = filterHistoryAppointments(baseAppointments, { doctorMode });
  const stats = getHistoryStats(visibleAppointments);
  const tableClass = doctorMode ? "history-table-card doctor-history-table" : "history-table-card";
  historyPage = Math.min(historyPage, Math.max(1, Math.ceil(visibleAppointments.length / historyRowsPerPage)));

  view.innerHTML = `
    <section class="page-head">
      <div>
        <h1>Historia wizyt</h1>
        <p>Przeglądaj i zarządzaj historią wszystkich wizyt w klinice.</p>
      </div>
    </section>
    <section class="history-layout ${doctorMode ? "doctor-history-layout" : ""}">
      <div class="history-main">
        <section class="history-toolbar card">
          <div class="history-toolbar-row">
            <input class="history-search" type="search" data-history-search value="${escapeHtml(historySearchQuery)}" placeholder="${doctorMode ? "Szukaj po pacjencie lub usłudze..." : "Szukaj wizyty po pacjencie, lekarzu, usłudze lub notatce..."}">
            <button class="secondary-button" type="button" data-history-more-filters>Więcej filtrów</button>
            <button class="secondary-button" type="button" data-history-clear-search>Wyczyść</button>
            <button class="primary-button" type="button" data-history-export>Eksportuj</button>
          </div>
        </section>
        <section class="table-card ${tableClass}">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Pacjent</th>
                ${doctorMode ? "" : "<th>Lekarz</th>"}
                <th>Usługa</th>
                ${doctorMode ? "" : "<th>Gabinet</th>"}
                <th>Status</th>
                <th>${doctorMode ? "Szczegóły" : "Akcje"}</th>
              </tr>
            </thead>
            <tbody>${renderHistoryRows(visibleAppointments, { doctorMode })}</tbody>
          </table>
          ${renderHistoryPagination(visibleAppointments.length)}
        </section>
      </div>
      <aside class="history-sidebar">
        ${renderHistoryFilters({ doctorMode })}
        ${renderHistorySummary(stats)}
        ${doctorMode ? "" : renderHistoryTopServices(visibleAppointments)}
      </aside>
    </section>
  `;

  bindHistoryEvents(view, { doctorMode });
}

function renderReceptionHistory() {
  renderHistoryShell({ doctorMode: false });
}

function renderDoctorHistory() {
  renderHistoryShell({ doctorMode: true });
}

function resetHistoryFilters({ keepSearch = false } = {}) {
  if (!keepSearch) historySearchQuery = "";
  historyStatusFilter = "all";
  historyDoctorFilter = "all";
  historyCabinetFilter = "all";
  historyServiceFilter = "all";
  historyDateFrom = "";
  historyDateTo = "";
  historyPage = 1;
}

function bindHistoryEvents(view, { doctorMode = false } = {}) {
  view.querySelector("[data-history-search]")?.addEventListener("input", (event) => {
    historySearchQuery = event.target.value;
    const cursorPosition = event.target.selectionStart;
    historyPage = 1;
    clearTimeout(historySearchRenderTimer);
    historySearchRenderTimer = setTimeout(() => {
      rerenderPreservingSearchFocus(renderHistory, "[data-history-search]", cursorPosition);
    }, 120);
  });

  view.querySelector("[data-history-clear-search]")?.addEventListener("click", () => {
    resetHistoryFilters();
    renderHistory();
  });

  view.querySelector("[data-history-apply-filters]")?.addEventListener("click", () => {
    historyStatusFilter = view.querySelector("[data-history-status]")?.value || "all";
    historyDateFrom = view.querySelector("[data-history-date-from]")?.value || "";
    historyDateTo = view.querySelector("[data-history-date-to]")?.value || "";
    if (!doctorMode) {
      historyDoctorFilter = view.querySelector("[data-history-doctor]")?.value || "all";
      historyCabinetFilter = view.querySelector("[data-history-cabinet]")?.value || "all";
      historyServiceFilter = view.querySelector("[data-history-service]")?.value || "all";
    }
    historyPage = 1;
    renderHistory();
  });

  view.querySelector("[data-history-clear-filters]")?.addEventListener("click", () => {
    resetHistoryFilters({ keepSearch: true });
    renderHistory();
  });

  view.querySelector("[data-history-page-size]")?.addEventListener("change", (event) => {
    historyRowsPerPage = Number(event.target.value) || 10;
    historyPage = 1;
    renderHistory();
  });

  view.querySelector("[data-history-prev]")?.addEventListener("click", () => {
    historyPage = Math.max(1, historyPage - 1);
    renderHistory();
  });

  view.querySelector("[data-history-next]")?.addEventListener("click", () => {
    historyPage += 1;
    renderHistory();
  });

  view.querySelectorAll("[data-history-details]").forEach((button) => {
    button.addEventListener("click", () => openDetailsModal(button.dataset.historyDetails));
  });

  view.querySelectorAll("[data-history-cancel]").forEach((button) => {
    button.addEventListener("click", () => cancelAppointment(button.dataset.historyCancel));
  });
}

// ==============================
// Global topbar search
// ==============================
function getGlobalSearchElements() {
  const wrapper = document.querySelector(".global-search");
  const input = wrapper?.querySelector('input[type="search"]');
  return { wrapper, input };
}

function normalizeGlobalSearchText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function globalSearchMatches(query, values) {
  const needle = normalizeGlobalSearchText(query);
  if (needle.length < 2) return false;
  return values.some((value) => normalizeGlobalSearchText(value).includes(needle));
}

function buildGlobalSearchItem(type, title, meta, entity) {
  return { type, title: title || "Brak danych", meta: meta || "", entity };
}

function collectGlobalSearchResults(query) {
  const groups = [
    {
      label: "Pacjenci",
      items: patients
        .filter((patient) => globalSearchMatches(query, [
          patientFullName(patient),
          patient.firstName,
          patient.lastName,
          patient.first_name,
          patient.last_name,
          patient.phone,
          patient.pesel,
          patient.email,
        ]))
        .slice(0, 5)
        .map((patient) => buildGlobalSearchItem(
          "patient",
          patientFullName(patient),
          [patient.phone, patient.pesel ? `PESEL ${patient.pesel}` : ""].filter(Boolean).join(" · "),
          patient
        )),
    },
    {
      label: "Lekarze",
      items: doctors
        .filter((doctor) => globalSearchMatches(query, [
          doctorFullName(doctor),
          doctor.firstName,
          doctor.lastName,
          doctor.first_name,
          doctor.last_name,
          doctor.specialization,
          doctor.phone,
          doctor.email,
        ]))
        .slice(0, 5)
        .map((doctor) => buildGlobalSearchItem("doctor", doctorFullName(doctor), doctor.specialization || "Lekarz", doctor)),
    },
    {
      label: "Wizyty",
      items: appointments
        .filter((appointment) => {
          const patient = patients.find((item) => String(item.id ?? item.patient_id) === String(appointment.patient_id ?? appointment.patientId));
          const doctor = findDoctorByAppointment(appointment);
          const service = findServiceByIdOrValue(appointment.service_id ?? appointment.serviceId ?? appointment.service ?? appointment.specialization);
          return globalSearchMatches(query, [
            appointment.patient,
            appointment.patient_name,
            patientFullName(patient),
            appointment.doctor,
            appointment.doctor_name,
            doctorFullName(doctor),
            appointment.service,
            appointment.service_name,
            appointment.specialization,
            serviceName(service),
            appointment.notes,
          ]);
        })
        .slice(0, 5)
        .map((appointment) => {
          const date = getAppointmentDateIso(appointment, getMonday(parseLocalDate(selectedDate)));
          const time = formatTime(appointment.start_time || appointment.startTime || appointment.time);
          const doctor = findDoctorByAppointment(appointment);
          const service = findServiceByIdOrValue(appointment.service_id ?? appointment.serviceId ?? appointment.service ?? appointment.specialization);
          return buildGlobalSearchItem(
            "appointment",
            `${date} ${time}`,
            [appointment.patient || appointment.patient_name || "Pacjent", doctorFullName(doctor) || appointment.doctor, serviceName(service) || appointment.service || appointment.specialization].filter(Boolean).join(" · "),
            appointment
          );
        }),
    },
    {
      label: "Usługi",
      items: services
        .filter((service) => globalSearchMatches(query, [
          serviceName(service),
          service.specialization,
          service.description,
          service.code,
        ]))
        .slice(0, 5)
        .map((service) => buildGlobalSearchItem(
          "service",
          serviceName(service),
          [service.specialization, `${service.durationMinutes || service.duration || service.duration_minutes || 30} min`].filter(Boolean).join(" · "),
          service
        )),
    },
    {
      label: "Gabinety",
      items: cabinets
        .filter((cabinet) => globalSearchMatches(query, [
          cabinet.name,
          cabinet.number,
          cabinet.room_number,
          cabinet.floor,
          cabinet.status,
          cabinet.type,
          cabinet.specialization,
        ]))
        .slice(0, 5)
        .map((cabinet) => buildGlobalSearchItem(
          "cabinet",
          cabinet.name || `Gabinet ${cabinetNumber(cabinet)}`,
          [cabinetNumber(cabinet), cabinet.floor, cabinetStatusLabel(cabinet)].filter(Boolean).join(" · "),
          cabinet
        )),
    },
  ];

  let total = 0;
  return groups.map((group) => {
    const available = Math.max(0, 20 - total);
    const items = group.items.slice(0, available);
    total += items.length;
    return { ...group, items };
  }).filter((group) => group.items.length);
}

function ensureGlobalSearchDropdown() {
  const { wrapper } = getGlobalSearchElements();
  if (!wrapper) return null;
  let dropdown = wrapper.querySelector("[data-global-search-dropdown]");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.className = "global-search-dropdown";
    dropdown.dataset.globalSearchDropdown = "1";
    dropdown.hidden = true;
    wrapper.appendChild(dropdown);
  }
  return dropdown;
}

function hideGlobalSearchDropdown() {
  const dropdown = document.querySelector("[data-global-search-dropdown]");
  if (dropdown) {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
  }
  globalSearchResults = [];
}

function renderGlobalSearchDropdown(query) {
  const dropdown = ensureGlobalSearchDropdown();
  if (!dropdown) return;

  if (query.trim().length < 2) {
    hideGlobalSearchDropdown();
    return;
  }

  const groups = collectGlobalSearchResults(query);
  globalSearchResults = groups.flatMap((group) => group.items);
  dropdown.hidden = false;

  if (!globalSearchResults.length) {
    dropdown.innerHTML = `<div class="global-search-empty">Brak wyników.</div>`;
    return;
  }

  dropdown.innerHTML = groups.map((group) => `
    <section class="global-search-group">
      <h4>${escapeHtml(group.label)}</h4>
      ${group.items.map((item) => {
        const index = globalSearchResults.indexOf(item);
        return `
          <button type="button" class="global-search-result" data-global-search-index="${index}">
            <strong>${escapeHtml(item.title)}</strong>
            ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
          </button>
        `;
      }).join("")}
    </section>
  `).join("");

  dropdown.querySelectorAll("[data-global-search-index]").forEach((button) => {
    button.addEventListener("click", () => openGlobalSearchResult(globalSearchResults[Number(button.dataset.globalSearchIndex)]));
  });
}

function clearGlobalSearchInput() {
  const { input } = getGlobalSearchElements();
  if (input) input.value = "";
  hideGlobalSearchDropdown();
}

function openGlobalSearchResult(result) {
  if (!result) return;

  if (result.type === "patient") {
    if (!confirmPatientCardNavigation()) return;
    selectedPatientId = result.entity.id ?? result.entity.patient_id;
    patientCardMode = "view";
    showView("patientCard");
  } else if (result.type === "doctor") {
    const doctorId = getDoctorEntityId(result.entity);
    if (typeof openDoctorCard === "function") openDoctorCard(doctorId, "view");
    else {
      selectedDoctorId = doctorId;
      showView("doctorCard");
    }
  } else if (result.type === "appointment") {
    if (result.entity.id && typeof openDetailsModal === "function") {
      openDetailsModal(result.entity.id);
    } else {
      selectedDate = getAppointmentDateIso(result.entity, getMonday(parseLocalDate(selectedDate)));
      calendarViewMode = "day";
      showView("calendar");
    }
  } else if (result.type === "service") {
    selectedServiceId = getServiceEntityId(result.entity);
    showView("services");
    if (typeof selectService === "function") selectService(selectedServiceId);
  } else if (result.type === "cabinet") {
    selectedCabinetId = getCabinetEntityId(result.entity);
    showView("rooms");
    if (typeof selectCabinet === "function") selectCabinet(selectedCabinetId);
  }

  clearGlobalSearchInput();
}

function bindGlobalTopbarSearch() {
  const { wrapper, input } = getGlobalSearchElements();
  if (!wrapper || !input || input.dataset.globalSearchBound === "1") return;
  input.dataset.globalSearchBound = "1";

  input.addEventListener("input", () => renderGlobalSearchDropdown(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideGlobalSearchDropdown();
      input.blur();
    } else if (event.key === "Enter") {
      event.preventDefault();
      openGlobalSearchResult(globalSearchResults[0]);
    }
  });

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) hideGlobalSearchDropdown();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });
}

// ==============================
// Calendar rendering
// ==============================
function updateWeekRange() {
  const selected = parseLocalDate(selectedDate);
  const monday = getMonday(selected);
  const sunday = addDays(monday, 6);

  if (elements.weekRange) {
    if (calendarViewMode === "day") {
      elements.weekRange.textContent = safeFmt(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } else if (calendarViewMode === "month") {
      elements.weekRange.textContent = safeFmt(selected, { month: "long", year: "numeric" });
    } else {
      elements.weekRange.textContent = `${formatDate(monday)} - ${formatDate(sunday)}`;
    }
  }

  return monday;
}

function parseLocalDate(value) {
  const source = String(value || localToday()).slice(0, 10);
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(`${localToday()}T00:00:00`);
  return Number.isNaN(date.getTime()) ? parseLocalDate(localToday()) : date;
}

function setCalendarTimelineRange(dates = [selectedDate]) {
  const windows = dates
    .map((date) => getClinicWorkingHoursForDate(date))
    .filter((window) => window?.active && timeToMinutes(window.end) > timeToMinutes(window.start));

  if (!windows.length) {
    calendarStartMinutes = CALENDAR_START_HOUR * 60;
    calendarEndMinutes = CALENDAR_END_HOUR * 60;
    return;
  }

  const starts = windows.map((window) => timeToMinutes(window.start));
  const ends = windows.map((window) => timeToMinutes(window.end));
  calendarStartMinutes = Math.min(...starts);
  calendarEndMinutes = Math.max(...ends);
}

function getCalendarTimes() {
  const times = [];
  for (let minutes = calendarStartMinutes; minutes <= calendarEndMinutes; minutes += CALENDAR_SLOT_MINUTES) {
    times.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return times;
}

function getAppointmentDate(appointment, monday = getMonday(parseLocalDate(selectedDate))) {
  const rawDate = appointment?.date || appointment?.appointment_date;
  if (rawDate) return parseLocalDate(rawDate);
  if (Number.isInteger(appointment?.day)) return addDays(monday, appointment.day);
  return parseLocalDate(selectedDate);
}

function getAppointmentDateIso(appointment, monday) {
  return dateToIso(getAppointmentDate(appointment, monday));
}

function getAppointmentDayIndex(appointment, monday) {
  const appointmentDate = getAppointmentDate(appointment, monday);
  const diff = appointmentDate.getTime() - monday.getTime();
  return Math.round(diff / 86400000);
}

function appointmentStartMinutes(appointment) {
  return timeToMinutes(formatTime(appointment?.time || appointment?.start_time || appointment?.startTime || "08:00"));
}

function appointmentDurationMinutes(appointment) {
  const start = appointmentStartDateTime(appointment);
  const end = appointmentEndDateTime(appointment);
  if (start && end && end > start) {
    return Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
  }
  const service = services.find((item) => String(item.id) === String(appointment?.service_id) || String(item.service_id) === String(appointment?.service_id));
  return Number(appointment?.duration || appointment?.durationMinutes || service?.durationMinutes || 30);
}

function findDoctorByAppointment(appointment) {
  const doctorId = appointment?.doctor_id ?? appointment?.doctorId;
  if (doctorId) {
    const byId = doctors.find((doctor) => String(doctor.id ?? doctor.doctor_id) === String(doctorId));
    if (byId) return byId;
  }
  const name = String(appointment?.doctor || "").trim().toLowerCase();
  return doctors.find((doctor) => doctorFullName(doctor).toLowerCase() === name) || null;
}

function calendarAppointmentDoctorKey(appointment) {
  const doctor = findDoctorByAppointment(appointment);
  return String(appointment?.doctor_id ?? appointment?.doctorId ?? doctor?.id ?? doctor?.doctor_id ?? appointment?.doctor ?? "");
}

function calendarAppointmentCabinetKey(appointment) {
  return String(appointment?.cabinet_id ?? appointment?.cabinetId ?? appointment?.cabinet ?? appointment?.cabinet_name ?? "");
}

function calendarAppointmentServiceKey(appointment) {
  return String(appointment?.service_id ?? appointment?.serviceId ?? appointment?.specialization ?? appointment?.service_name ?? appointment?.service ?? "");
}

function normalizeCalendarFilterValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function calendarFilterMatches(filterValue, values, { fuzzy = false } = {}) {
  const filter = normalizeCalendarFilterValue(filterValue);
  if (!filter) return true;
  return values.some((value) => {
    const normalized = normalizeCalendarFilterValue(value);
    return normalized && (normalized === filter || (fuzzy && normalized.includes(filter)));
  });
}

function calendarAppointmentPatientValues(appointment) {
  const patientId = appointment?.patient_id ?? appointment?.patientId;
  const patient = patientId ? patients.find((item) => String(item.id ?? item.patient_id) === String(patientId)) : null;
  return [
    patientId,
    appointment?.patient,
    appointment?.patient_name,
    appointment?.patientName,
    patientFullName(patient),
    patient?.firstName,
    patient?.lastName,
    patient?.pesel,
    patient?.phone,
    patient?.email,
  ];
}

function calendarAppointmentDoctorValues(appointment) {
  const doctor = findDoctorByAppointment(appointment);
  return [
    appointment?.doctor_id,
    appointment?.doctorId,
    appointment?.doctor,
    appointment?.doctor_name,
    doctor?.id,
    doctor?.doctor_id,
    doctorFullName(doctor),
  ];
}

function calendarAppointmentCabinetValues(appointment) {
  const cabinet = findCabinetByBackendId(appointment?.cabinet_id ?? appointment?.cabinetId)
    || findCabinetByIdOrValue(appointment?.cabinet);
  return [
    appointment?.cabinet_id,
    appointment?.cabinetId,
    appointment?.cabinet,
    appointment?.cabinet_name,
    cabinet?.id,
    cabinet?.cabinet_id,
    cabinet?.name,
    cabinet?.number,
    cabinet?.room_number,
  ];
}

function calendarAppointmentServiceValues(appointment) {
  const service = findServiceByIdOrValue(appointment?.service_id ?? appointment?.serviceId ?? appointment?.service ?? appointment?.specialization);
  return [
    appointment?.service_id,
    appointment?.serviceId,
    appointment?.service,
    appointment?.service_name,
    appointment?.specialization,
    appointment?.specialization_name,
    service?.id,
    service?.service_id,
    serviceName(service),
    service?.specialization,
  ];
}

function calendarMatchesFilters(appointment, { doctorId = null } = {}) {
  if (isAppointmentCancelled(appointment)) return false;
  if (doctorId && !isAppointmentForDoctor(appointment, doctorId)) return false;

  if (!doctorId && calendarDoctorFilter) {
    if (!calendarFilterMatches(calendarDoctorFilter, calendarAppointmentDoctorValues(appointment))) return false;
  }

  if (calendarCabinetFilter) {
    if (!calendarFilterMatches(calendarCabinetFilter, calendarAppointmentCabinetValues(appointment))) return false;
  }

  if (calendarServiceFilter) {
    if (!calendarFilterMatches(calendarServiceFilter, calendarAppointmentServiceValues(appointment))) return false;
  }

  if (calendarPatientFilter) {
    if (!calendarFilterMatches(calendarPatientFilter, calendarAppointmentPatientValues(appointment), { fuzzy: true })) return false;
  }

  if (calendarStatusFilter && calendarStatusFilter !== "all") {
    if (getResolvedAppointmentStatus(appointment) !== calendarStatusFilter) return false;
  }

  return true;
}

function getCalendarAppointmentsForDate(dateIso, { doctorId = null } = {}) {
  const monday = getMonday(parseLocalDate(dateIso));
  return appointments.filter((appointment) => {
    return getAppointmentDateIso(appointment, monday) === dateIso && calendarMatchesFilters(appointment, { doctorId });
  });
}

function getCalendarAppointmentsForRange(startDate, endDate, { doctorId = null } = {}) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const monday = getMonday(start);
  return appointments.filter((appointment) => {
    const date = getAppointmentDate(appointment, monday);
    return date >= start && date <= end && calendarMatchesFilters(appointment, { doctorId });
  });
}

function getReceptionCalendarDoctorsForAbsences(doctorId = null) {
  if (doctorId) {
    const doctor = findDoctorByIdOrValue(doctorId);
    return doctor && isActiveDoctor(doctor) ? [doctor] : [];
  }
  return doctors.filter(isActiveDoctor).filter((doctor) => {
    if (!calendarDoctorFilter) return true;
    return calendarFilterMatches(calendarDoctorFilter, [doctor.id, doctor.doctor_id, doctorFullName(doctor), doctor.name, doctor.fullName]);
  });
}

function isDoctorWorkingOnCalendarDate(doctor, dateIso) {
  if (!isActiveDoctor(doctor)) return false;
  const doctorId = getDoctorEntityId(doctor);
  if (!doctorId) return false;
  const workingWindow = getDoctorScheduleForDate(doctorId, dateIso);
  if (!workingWindow?.active || !workingWindow.start || !workingWindow.end) return false;
  if (timeToMinutes(workingWindow.end) <= timeToMinutes(workingWindow.start)) return false;
  return !getDoctorAbsencesForDate(doctorId, dateIso).some((absence) => isWholeDayAbsence(absence));
}

function createAppointmentCard(appointment, monday) {
  const card = document.createElement("button");
  const doctorName = document.createElement("strong");
  const patientLine = document.createElement("span");
  const specialization = document.createElement("span");
  const compactLine = document.createElement("span");
  const shortTime = document.createElement("span");
  const weekShort = document.createElement("span");
  const fullDetails = document.createElement("span");
  const start = appointmentStartDateTime(appointment);
  const end = appointmentEndDateTime(appointment);
  const startLabel = start ? formatTime(start) : formatTime(appointment.time || appointment.start_time);
  const endLabel = end ? formatTime(end) : "";
  const patientName = appointment.patient || patientFullName(appointment) || "Pacjent";
  const serviceLabel = appointmentServiceDisplayName(appointment);
  const colorClass = getSpecializationColor(appointment.specialization || appointment.service || appointment.service_name || findDoctorByAppointment(appointment)?.specialization);

  card.type = "button";
  card.className = `appointment-card ${colorClass}`;
  card.dataset.appointmentId = appointment.id;
  doctorName.textContent = appointment.doctor || doctorFullName(findDoctorByAppointment(appointment)) || "Brak lekarza";
  doctorName.className = "appointment-card-doctor";
  compactLine.className = "appointment-card-compact-line";
  compactLine.textContent = `${endLabel ? `${startLabel}–${endLabel}` : startLabel} · ${patientName}`;
  patientLine.className = "appointment-card-patient";
  patientLine.textContent = `${startLabel} · ${patientName}`;
  specialization.className = "appointment-card-service";
  specialization.textContent = serviceLabel;
  shortTime.className = "appointment-card-short-time";
  shortTime.textContent = startLabel;
  weekShort.className = "appointment-card-week-short";
  weekShort.textContent = `${startLabel} · ${patientName}`;
  fullDetails.className = "appointment-card-full";
  fullDetails.innerHTML = `
    <span>${escapeHtml(doctorName.textContent)}</span>
    <span>${escapeHtml(endLabel ? `${startLabel}–${endLabel}` : startLabel)}</span>
    <span>${escapeHtml(patientName)}</span>
    <span>${escapeHtml(serviceLabel)}</span>
  `;

  card.append(compactLine, doctorName, shortTime, weekShort, patientLine, specialization, fullDetails);
  card.addEventListener("click", (event) => {
    event.stopPropagation();
    openDetailsModal(appointment.id, monday);
  });

  return card;
}

function renderCalendar() {
  selectedDate = toLocalDateKey(selectedDate || localToday());
  if (authRoleKey(currentUser.role) === "lekarz") {
    renderDoctorCalendar();
  } else {
    renderReceptionCalendar();
  }
  bindCalendarHorizontalDrag();
}

function renderReceptionCalendar() {
  if (!elements.calendarGrid) {
    return;
  }

  ensureReceptionCalendarFilterUi();
  syncCalendarFiltersFromDom();
  setCalendarRoleMode(false);
  updateCalendarViewButtons();
  updateWeekRange();
  renderCalendarMiniPicker();

  if (calendarViewMode === "month") {
    renderMonthView();
  } else if (calendarViewMode === "week") {
    renderWeekView();
  } else {
    renderDayView();
  }
}

function renderDoctorCalendar() {
  if (!elements.calendarGrid) {
    return;
  }

  const doctorId = getCurrentDoctorId();
  setCalendarRoleMode(true);
  updateCalendarViewButtons();
  updateWeekRange();
  renderCalendarMiniPicker();

  if (!doctorId) {
    elements.calendarGrid.className = "doctor-day-grid doctor-only-day";
    elements.calendarGrid.innerHTML = `<div class="empty-state">Nie można ustalić powiązanego lekarza dla zalogowanego użytkownika.</div>`;
    return;
  }

  if (calendarViewMode === "month") {
    renderMonthView({ doctorId, doctorMode: true });
  } else if (calendarViewMode === "week") {
    renderWeekView({ doctorId, doctorMode: true });
  } else {
    const doctor = currentUserDoctorProfile() || {
      id: doctorId,
      doctor_id: doctorId,
      fullName: currentUser.name || "Lekarz",
      name: currentUser.name || "Lekarz",
      specialization: "Lekarz",
    };
    renderDayView({ doctorId, doctorMode: true, doctorsSource: doctor ? [doctor] : [] });
  }
}

function setCalendarRoleMode(isDoctorMode) {
  const calendarView = document.querySelector("#calendarView");
  calendarView?.classList.toggle("calendar-doctor-mode", isDoctorMode);
  elements.doctorFilter?.closest(".filter-card")?.classList.toggle("calendar-doctor-hidden", isDoctorMode);
  elements.newAppointmentButton?.closest(".calendar-control-card")?.classList.toggle("calendar-doctor-hidden", isDoctorMode);
}

function bindCalendarHorizontalDrag() {
  const calendarCard = elements.calendarGrid?.closest(".calendar-card");
  if (!calendarCard) return;

  const isDayMode = calendarViewMode === "day";
  calendarCard.classList.toggle("calendar-drag-scroll", isDayMode);
  if (!isDayMode || calendarCard.dataset.horizontalDragBound === "1") return;

  calendarCard.dataset.horizontalDragBound = "1";
  let isDragging = false;
  let moved = false;
  let startX = 0;
  let scrollLeft = 0;

  const isInteractiveTarget = (target) => {
    if (target?.closest?.(".appointment-card")) return false;
    if (target?.closest?.(".calendar-absence-block")) return false;
    return Boolean(target?.closest?.("button, a, input, select, textarea, label"));
  };

  calendarCard.addEventListener("mousedown", (event) => {
    if (calendarViewMode !== "day" || event.button !== 0 || isInteractiveTarget(event.target)) return;
    if (calendarCard.scrollWidth <= calendarCard.clientWidth) return;
    isDragging = true;
    moved = false;
    startX = event.clientX;
    scrollLeft = calendarCard.scrollLeft;
    calendarCard.classList.add("is-dragging");
  });

  window.addEventListener("mousemove", (event) => {
    if (!isDragging) return;
    const delta = event.clientX - startX;
    if (Math.abs(delta) > 4) moved = true;
    if (moved) event.preventDefault();
    calendarCard.scrollLeft = scrollLeft - delta;
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    calendarCard.classList.remove("is-dragging");
    if (moved) {
      calendarCard.dataset.suppressNextClick = "1";
      window.setTimeout(() => {
        delete calendarCard.dataset.suppressNextClick;
      }, 0);
    }
  });

  calendarCard.addEventListener("click", (event) => {
    if (calendarCard.dataset.suppressNextClick === "1") {
      event.preventDefault();
      event.stopPropagation();
      delete calendarCard.dataset.suppressNextClick;
    }
  }, true);
}

function ensureReceptionCalendarFilterUi() {
  const filterCard = document.querySelector("#calendarView .filter-card");
  if (!filterCard) return;

  if (!filterCard.querySelector("#calendarPatientFilter")) {
    const input = document.createElement("input");
    input.id = "calendarPatientFilter";
    input.type = "search";
    input.placeholder = "Pacjent";
    input.value = calendarPatientFilter;
    filterCard.insertBefore(input, elements.doctorFilter || filterCard.children[1] || null);
  }

  if (!filterCard.querySelector("#calendarStatusFilter")) {
    const select = document.createElement("select");
    select.id = "calendarStatusFilter";
    [
      ["all", "Wszystkie"],
      ["Zaplanowana", "Zaplanowana"],
      ["W trakcie", "W trakcie"],
      ["Zrealizowana", "Zrealizowana"],
      ["Anulowana", "Anulowana"],
      ["Nieobecny pacjent", "Nieobecny pacjent"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    filterCard.appendChild(select);
  }

  if (!filterCard.querySelector("[data-calendar-clear-filters]")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button calendar-clear-filters";
    button.dataset.calendarClearFilters = "1";
    button.textContent = "Wyczyść filtry";
    filterCard.appendChild(button);
  }

  const patientInput = filterCard.querySelector("#calendarPatientFilter");
  const statusSelect = filterCard.querySelector("#calendarStatusFilter");
  if (patientInput) patientInput.value = calendarPatientFilter;
  if (statusSelect) statusSelect.value = calendarStatusFilter || "all";

  if (filterCard.dataset.calendarFiltersBound === "1") return;
  filterCard.dataset.calendarFiltersBound = "1";

  filterCard.addEventListener("input", (event) => {
    if (event.target?.id !== "calendarPatientFilter") return;
    syncCalendarFiltersFromDom();
    receptionCalendarDoctorPage = 0;
    renderCalendar();
  });

  filterCard.addEventListener("change", (event) => {
    if (!["doctorFilter", "cabinetFilter", "serviceFilter", "calendarStatusFilter"].includes(event.target?.id)) return;
    syncCalendarFiltersFromDom();
    if (event.target.id === "doctorFilter") receptionCalendarDoctorPage = 0;
    renderCalendar();
  });

  filterCard.querySelector("[data-calendar-clear-filters]")?.addEventListener("click", clearReceptionCalendarFilters);
}

function clearReceptionCalendarFilters() {
  calendarPatientFilter = "";
  calendarDoctorFilter = "";
  calendarCabinetFilter = "";
  calendarServiceFilter = "";
  calendarStatusFilter = "all";
  receptionCalendarDoctorPage = 0;
  const patientInput = document.querySelector("#calendarPatientFilter");
  const statusSelect = document.querySelector("#calendarStatusFilter");
  if (patientInput) patientInput.value = "";
  if (statusSelect) statusSelect.value = "all";
  if (elements.doctorFilter) elements.doctorFilter.value = "";
  if (elements.cabinetFilter) elements.cabinetFilter.value = "";
  if (elements.serviceFilter) elements.serviceFilter.value = "";
  renderCalendar();
}

function syncCalendarFiltersFromDom() {
  calendarDoctorFilter = elements.doctorFilter?.value || "";
  calendarCabinetFilter = elements.cabinetFilter?.value || "";
  calendarServiceFilter = elements.serviceFilter?.value || "";
  calendarPatientFilter = document.querySelector("#calendarPatientFilter")?.value.trim() || "";
  calendarStatusFilter = document.querySelector("#calendarStatusFilter")?.value || "all";
}

function updateCalendarViewButtons() {
  elements.viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.viewMode === calendarViewMode);
  });
}

function getCalendarPeriodLabel() {
  const selected = parseLocalDate(selectedDate);
  if (calendarViewMode === "day") return safeFmt(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (calendarViewMode === "month") return safeFmt(selected, { month: "long", year: "numeric" });
  const monday = getMonday(selected);
  return `${formatDate(monday)} - ${formatDate(addDays(monday, 6))}`;
}

function buildTimeAxis() {
  const axis = document.createElement("div");
  axis.className = "calendar-time-axis";
  axis.style.height = `${getTimelineHeight()}px`;
  getCalendarTimes().forEach((time, index) => {
    const label = document.createElement("span");
    label.textContent = time;
    label.style.top = `${index * CALENDAR_SLOT_HEIGHT}px`;
    axis.appendChild(label);
  });
  return axis;
}

function getTimelineHeight() {
  return ((calendarEndMinutes - calendarStartMinutes) / CALENDAR_SLOT_MINUTES) * CALENDAR_SLOT_HEIGHT;
}

function getPastCalendarCutoffMinutes(dateIso) {
  const dayKey = String(dateIso || selectedDate || today()).slice(0, 10);
  const todayKey = today();
  const totalMinutes = calendarEndMinutes - calendarStartMinutes;

  if (dayKey < todayKey) return totalMinutes;
  if (dayKey > todayKey) return 0;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const calendarStart = calendarStartMinutes;
  const calendarEnd = calendarEndMinutes;

  if (currentMinutes <= calendarStart) return 0;
  if (currentMinutes >= calendarEnd) return totalMinutes;
  return currentMinutes - calendarStart;
}

function applyPastTimelineState(timeline, dateIso) {
  if (!timeline) return;
  const pastMinutes = getPastCalendarCutoffMinutes(dateIso);
  const pastHeight = Math.max(0, Math.min(getTimelineHeight(), (pastMinutes / CALENDAR_SLOT_MINUTES) * CALENDAR_SLOT_HEIGHT));

  timeline.style.setProperty("--calendar-past-height", `${pastHeight}px`);
  timeline.classList.toggle("has-past-slots", pastHeight > 0);
  timeline.classList.toggle("all-past-slots", pastHeight >= getTimelineHeight() - 1);
}

function isPastCalendarSlot(dateIso, startMinutes) {
  const slotStart = combineLocalDateTime(String(dateIso || selectedDate || today()).slice(0, 10), minutesToTime(startMinutes));
  return Boolean(slotStart && slotStart <= new Date());
}

function updateReceptionDoctorRange(calendarCard, totalDoctors) {
  const range = elements.calendarGrid?.querySelector(".calendar-doctor-range");
  if (!calendarCard || !totalDoctors) return;
  const columnWidth = Number(elements.calendarGrid?.dataset.doctorColumnWidth || 340);
  const firstVisible = Math.min(totalDoctors - 1, Math.max(0, Math.floor(calendarCard.scrollLeft / columnWidth)));
  const lastVisible = Math.min(totalDoctors, firstVisible + RECEPTION_CALENDAR_DOCTORS_PER_PAGE);
  receptionCalendarDoctorPage = Math.floor(firstVisible / RECEPTION_CALENDAR_DOCTORS_PER_PAGE);
  if (range) range.textContent = `${firstVisible + 1}-${lastVisible} z ${totalDoctors}`;
  const maxScrollLeft = Math.max(0, calendarCard.scrollWidth - calendarCard.clientWidth);
  elements.calendarGrid?.querySelector(".calendar-doctor-page-prev")?.toggleAttribute("disabled", calendarCard.scrollLeft <= 2);
  elements.calendarGrid?.querySelector(".calendar-doctor-page-next")?.toggleAttribute("disabled", calendarCard.scrollLeft >= maxScrollLeft - 2);
  const offset = `${calendarCard.scrollLeft}px`;
  elements.calendarGrid?.querySelector(".calendar-corner")?.style.setProperty("--calendar-sticky-offset", offset);
  elements.calendarGrid?.querySelector(".calendar-time-axis")?.style.setProperty("--calendar-sticky-offset", offset);
  elements.calendarGrid?.querySelector(".calendar-doctor-pager-overlay")?.style.setProperty("--calendar-sticky-offset", offset);
}

function renderDayView({ doctorId = null, doctorMode = false, doctorsSource = doctors } = {}) {
  setCalendarTimelineRange([selectedDate]);
  const baseDoctors = doctorsSource.length ? doctorsSource : deriveDoctorsFromAppointments();
  const sourceDoctors = doctorMode
    ? baseDoctors
    : baseDoctors.filter((doctor) => isDoctorWorkingOnCalendarDate(doctor, selectedDate)).filter((doctor) => {
        if (!calendarDoctorFilter) return true;
        return calendarFilterMatches(calendarDoctorFilter, [doctor.id, doctor.doctor_id, doctorFullName(doctor), doctor.name, doctor.fullName]);
      });

  let visibleDoctors = sourceDoctors.length ? sourceDoctors : [];
  let doctorPager = null;
  if (!doctorMode && !calendarDoctorFilter && visibleDoctors.length > RECEPTION_CALENDAR_DOCTORS_PER_PAGE) {
    const totalDoctors = visibleDoctors.length;
    const totalPages = Math.max(1, Math.ceil(totalDoctors / RECEPTION_CALENDAR_DOCTORS_PER_PAGE));
    receptionCalendarDoctorPage = Math.min(Math.max(0, receptionCalendarDoctorPage), totalPages - 1);
    const startIndex = receptionCalendarDoctorPage * RECEPTION_CALENDAR_DOCTORS_PER_PAGE;
    const endIndex = Math.min(startIndex + RECEPTION_CALENDAR_DOCTORS_PER_PAGE, totalDoctors);
    doctorPager = { startIndex, endIndex, totalDoctors, totalPages };
  } else if (!doctorMode) {
    receptionCalendarDoctorPage = 0;
  }

  elements.calendarGrid.className = `doctor-day-grid day-mode${doctorMode ? " doctor-only-day" : ""}`;
  elements.calendarGrid.style.setProperty("--timeline-height", `${getTimelineHeight()}px`);
  const calendarCard = elements.calendarGrid.closest(".calendar-card");
  const visibleWidth = Math.max(0, (calendarCard?.clientWidth || 1424) - 64);
  const dayColumnMinWidth = doctorMode ? 0 : Math.max(240, Math.floor(visibleWidth / RECEPTION_CALENDAR_DOCTORS_PER_PAGE));
  const dayColumnWidth = doctorMode ? "minmax(0, 1fr)" : `minmax(${dayColumnMinWidth}px, 1fr)`;
  elements.calendarGrid.style.gridTemplateColumns = `64px repeat(${Math.max(visibleDoctors.length, 1)}, ${dayColumnWidth})`;
  elements.calendarGrid.style.minWidth = doctorMode ? "100%" : `${64 + Math.max(visibleDoctors.length, 1) * dayColumnMinWidth}px`;
  elements.calendarGrid.dataset.doctorColumnWidth = String(dayColumnMinWidth || 0);
  elements.calendarGrid.innerHTML = "";

  const corner = document.createElement("div");
  corner.className = "calendar-corner";
  if (doctorPager) {
    corner.innerHTML = `<span class="calendar-doctor-range">${doctorPager.startIndex + 1}-${doctorPager.endIndex} z ${doctorPager.totalDoctors}</span>`;
  }
  elements.calendarGrid.appendChild(corner);

  if (!visibleDoctors.length) {
    elements.calendarGrid.appendChild(buildEmptyCalendarPanel("Brak lekarzy pracujących w wybranym dniu."));
    return;
  }

  if (doctorPager) {
    const pager = document.createElement("div");
    pager.className = "calendar-doctor-pager calendar-doctor-pager-overlay";
    pager.style.gridColumn = `2 / ${visibleDoctors.length + 2}`;
    pager.style.gridRow = "1";
    pager.innerHTML = `
      <button type="button" class="calendar-doctor-page-prev" data-calendar-doctor-page="prev" ${receptionCalendarDoctorPage <= 0 ? "disabled" : ""}>&lt;</button>
      <button type="button" class="calendar-doctor-page-next" data-calendar-doctor-page="next" ${receptionCalendarDoctorPage >= doctorPager.totalPages - 1 ? "disabled" : ""}>&gt;</button>
    `;
    pager.querySelectorAll("[data-calendar-doctor-page]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const calendarCard = elements.calendarGrid?.closest(".calendar-card");
        const direction = button.dataset.calendarDoctorPage === "next" ? 1 : -1;
        const nextPage = Math.min(Math.max(0, receptionCalendarDoctorPage + direction), doctorPager.totalPages - 1);
        receptionCalendarDoctorPage = nextPage;
        calendarCard?.scrollTo({
          left: nextPage * RECEPTION_CALENDAR_DOCTORS_PER_PAGE * dayColumnMinWidth,
          behavior: "smooth",
        });
        updateReceptionDoctorRange(calendarCard, doctorPager.totalDoctors);
      });
    });
    elements.calendarGrid.appendChild(pager);
  }

  visibleDoctors.forEach((doctor, index) => {
    const header = document.createElement("div");
    header.className = "doctor-header";
    header.style.gridColumn = String(index + 2);
    header.innerHTML = `
      ${renderDoctorAvatar(doctor, { size: 42 })}
      <div>
        <strong>${escapeHtml(doctorFullName(doctor))}</strong>
        <span>${escapeHtml(doctor.specialization || "Lekarz")}</span>
        <span>${escapeHtml(doctor.cabinet || "")}</span>
      </div>
    `;
    elements.calendarGrid.appendChild(header);
  });

  elements.calendarGrid.appendChild(buildTimeAxis());

  visibleDoctors.forEach((doctor, index) => {
    const timeline = document.createElement("div");
    const currentDoctorId = doctor.id ?? doctor.doctor_id;
    timeline.className = "doctor-timeline";
    timeline.style.gridColumn = String(index + 2);
    timeline.style.height = `${getTimelineHeight()}px`;
    applyPastTimelineState(timeline, selectedDate);

    if (!doctorMode && canCreateAppointments()) {
      timeline.addEventListener("click", (event) => {
        if (event.target !== timeline) return;
        const rect = timeline.getBoundingClientRect();
        const relativeY = Math.max(0, event.clientY - rect.top);
        const minutesFromStart = Math.floor(relativeY / (CALENDAR_SLOT_HEIGHT / 2)) * 15;
        const startMinutes = calendarStartMinutes + minutesFromStart;
        if (isPastCalendarSlot(selectedDate, startMinutes)) return;
        const prefillService = findServiceByIdOrValue(pendingRegistrationAppointment?.serviceId);
        const prefillDuration = Number(prefillService?.durationMinutes || prefillService?.duration || 30) || 30;
        const clickStart = combineLocalDateTime(selectedDate, minutesToTime(startMinutes));
        const clickEnd = combineLocalDateTime(selectedDate, minutesToTime(startMinutes + prefillDuration));
        if (clickStart && clickEnd && doctorIsAbsentInRange(currentDoctorId, selectedDate, clickStart, clickEnd)) return;
        const cabinet = getDoctorDefaultCabinet(doctor);
        if (!cabinet) return;
        const registrationPrefill = pendingRegistrationAppointment && String(pendingRegistrationAppointment.doctorId || "") === String(currentDoctorId || "")
          ? pendingRegistrationAppointment
          : {};
        openAppointmentModal({
          ...registrationPrefill,
          doctorId: currentDoctorId,
          date: selectedDate,
          startTime: minutesToTime(startMinutes),
          cabinetId: cabinet?.id || cabinet?.cabinet_id,
        });
      });
    }

    getCalendarAppointmentsForDate(selectedDate, { doctorId: doctorMode ? doctorId : null })
      .filter((appointment) => isAppointmentForDoctor(appointment, currentDoctorId) || (!appointment.doctor_id && appointment.doctor === doctorFullName(doctor)))
      .forEach((appointment) => timeline.appendChild(createTimelineEvent(appointment)));

    if (!doctorMode) {
      getDoctorAbsencesForDate(currentDoctorId, selectedDate).forEach((absence) => {
        timeline.appendChild(createAbsenceTimelineBlock(absence, selectedDate));
      });
    }

    elements.calendarGrid.appendChild(timeline);
  });

  if (doctorPager && calendarCard) {
    calendarCard.style.setProperty("--calendar-scroll-viewport-width", `${calendarCard.clientWidth}px`);
    const initialLeft = doctorPager.startIndex * dayColumnMinWidth;
    if (Math.abs(calendarCard.scrollLeft - initialLeft) > 2) calendarCard.scrollLeft = initialLeft;
    calendarCard.onscroll = () => updateReceptionDoctorRange(calendarCard, doctorPager.totalDoctors);
    updateReceptionDoctorRange(calendarCard, doctorPager.totalDoctors);
  } else if (calendarCard) {
    calendarCard.onscroll = null;
  }
}

function deriveDoctorsFromAppointments() {
  const seen = new Set();
  return appointments
    .map((appointment) => {
      const name = String(appointment.doctor || appointment.doctor_name || "").trim();
      if (!name || seen.has(name.toLowerCase())) return null;
      seen.add(name.toLowerCase());
      return {
        id: appointment.doctor_id || name,
        doctor_id: appointment.doctor_id || null,
        fullName: name,
        name,
        specialization: appointment.specialization || appointment.specialization_name || "Lekarz",
        cabinet: appointment.cabinet || appointment.cabinet_name || "",
      };
    })
    .filter(Boolean);
}

function renderWeekView({ doctorId = null, doctorMode = false } = {}) {
  const calendarCard = elements.calendarGrid?.closest(".calendar-card");
  if (calendarCard) calendarCard.onscroll = null;
  const monday = getMonday(parseLocalDate(selectedDate));
  setCalendarTimelineRange(Array.from({ length: 7 }, (_, index) => dateToIso(addDays(monday, index))));
  elements.calendarGrid.className = `doctor-day-grid week-mode${doctorMode ? " doctor-only-week" : ""}`;
  elements.calendarGrid.style.setProperty("--timeline-height", `${getTimelineHeight()}px`);
  elements.calendarGrid.style.gridTemplateColumns = "64px repeat(7, minmax(0, 1fr))";
  elements.calendarGrid.style.minWidth = "";
  elements.calendarGrid.innerHTML = "";

  const corner = document.createElement("div");
  corner.className = "calendar-corner";
  elements.calendarGrid.appendChild(corner);

  for (let index = 0; index < 7; index += 1) {
    const date = addDays(monday, index);
    const dateIso = dateToIso(date);
    const header = document.createElement("button");
    header.type = "button";
    header.className = `week-day-header${dateIso === today() ? " today" : ""}${dateIso === selectedDate ? " selected" : ""}`;
    header.style.gridColumn = String(index + 2);
    const dayAbsences = doctorMode ? [] : getReceptionCalendarDoctorsForAbsences(doctorId).flatMap((doctor) => getDoctorAbsencesForDate(getDoctorEntityId(doctor), dateIso));
    header.innerHTML = `
      <span class="week-day-name">${escapeHtml(["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"][index])}</span>
      <strong>${escapeHtml(formatDate(date))}</strong>
      ${dayAbsences.length ? `<span class="calendar-absence-week-marker">${dayAbsences.length} ${dayAbsences.length === 1 ? "nieobecny" : "nieobecnych"}</span>` : ""}
    `;
    header.addEventListener("click", () => {
      selectedDate = dateToIso(date);
      calendarViewMode = "day";
      renderCalendar();
    });
    elements.calendarGrid.appendChild(header);
  }

  elements.calendarGrid.appendChild(buildTimeAxis());

  for (let index = 0; index < 7; index += 1) {
    const dateIso = dateToIso(addDays(monday, index));
    const timeline = document.createElement("div");
    timeline.className = "week-timeline";
    timeline.style.gridColumn = String(index + 2);
    timeline.style.height = `${getTimelineHeight()}px`;
    applyPastTimelineState(timeline, dateIso);

    getCalendarAppointmentsForDate(dateIso, { doctorId }).forEach((appointment) => {
      timeline.appendChild(createTimelineEvent(appointment, { compact: true }));
    });
    elements.calendarGrid.appendChild(timeline);
  }
}

function renderMonthView({ doctorId = null, doctorMode = false } = {}) {
  const calendarCard = elements.calendarGrid?.closest(".calendar-card");
  if (calendarCard) calendarCard.onscroll = null;
  const selected = parseLocalDate(selectedDate);
  const firstDay = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const start = addDays(firstDay, -((firstDay.getDay() + 6) % 7));
  const grid = document.createElement("div");
  grid.className = `month-grid${doctorMode ? " doctor-only-month" : ""}`;

  ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"].forEach((label) => {
    const head = document.createElement("div");
    head.className = "month-head";
    head.textContent = label;
    grid.appendChild(head);
  });

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(start, index);
    const dateIso = dateToIso(date);
    const dayAppointments = getCalendarAppointmentsForDate(dateIso, { doctorId }).sort((a, b) => appointmentStartMinutes(a) - appointmentStartMinutes(b));
    const dayAbsences = doctorMode ? [] : getReceptionCalendarDoctorsForAbsences(doctorId).flatMap((doctor) => getDoctorAbsencesForDate(getDoctorEntityId(doctor), dateIso));
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `month-cell${date.getMonth() !== selected.getMonth() ? " muted" : ""}${dateIso === selectedDate ? " selected" : ""}`;
    cell.innerHTML = `
      <div class="month-day"><strong>${date.getDate()}</strong>${dayAppointments.length ? `<span>${dayAppointments.length} wiz.</span>` : ""}</div>
      <div class="month-items">
        ${dayAbsences.length ? `<span class="month-absence">${dayAbsences.length} nieobec.</span>` : ""}
        ${dayAppointments.slice(0, 3).map((appointment) => `<span class="month-appointment"><b>${escapeHtml(formatTime(appointment.time || appointment.start_time))}</b>${escapeHtml(appointment.patient || patientFullName(appointment) || "Pacjent")}</span>`).join("")}
        ${dayAppointments.length > 3 ? `<span class="month-more">+ ${dayAppointments.length - 3} więcej</span>` : ""}
      </div>
    `;
    cell.addEventListener("click", () => {
      selectedDate = dateIso;
      calendarViewMode = "day";
      renderCalendar();
    });
    grid.appendChild(cell);
  }

  elements.calendarGrid.className = "calendar-month-host month-mode";
  elements.calendarGrid.removeAttribute("style");
  elements.calendarGrid.innerHTML = "";
  elements.calendarGrid.appendChild(grid);
}

function buildEmptyCalendarPanel(message) {
  const panel = document.createElement("div");
  panel.className = "empty-state";
  panel.style.gridColumn = "2 / -1";
  panel.textContent = message;
  return panel;
}

function createTimelineEvent(appointment, { compact = false } = {}) {
  const event = createAppointmentCard(appointment, getMonday(parseLocalDate(selectedDate)));
  const start = appointmentStartDateTime(appointment);
  const end = appointmentEndDateTime(appointment);
  const startMinutes = appointmentStartMinutes(appointment);
  const duration = appointmentDurationMinutes(appointment);
  const top = Math.max(0, ((startMinutes - calendarStartMinutes) / CALENDAR_SLOT_MINUTES) * CALENDAR_SLOT_HEIGHT);
  const height = Math.max(24, (duration / CALENDAR_SLOT_MINUTES) * CALENDAR_SLOT_HEIGHT - 6);
  event.classList.add("timeline-event");
  if (compact) event.classList.add("compact-event");
  event.tabIndex = 0;
  event.setAttribute(
    "aria-label",
    `Wizyta ${appointment.patient || patientFullName(findPatientForAppointment(appointment)) || "pacjenta"} ${start ? formatTime(start) : ""}${end ? `-${formatTime(end)}` : ""}`
  );
  event.style.top = `${top + 3}px`;
  event.style.height = `${height}px`;
  event.style.left = "6px";
  event.style.right = "6px";
  return event;
}

function createAbsenceTimelineBlock(absence, dateIso) {
  const block = document.createElement("div");
  block.className = `calendar-absence-block ${isWholeDayAbsence(absence) ? "whole-day" : "partial"}`;
  block.tabIndex = 0;
  block.role = "button";
  block.dataset.calendarAbsenceId = absence.id;
  block.title = "Kliknij, aby usunąć nieobecność";
  const range = absenceTimeRange(absence, dateIso);
  const startMinutes = isWholeDayAbsence(absence) ? calendarStartMinutes : timeToMinutes(absence.timeFrom);
  const endMinutes = isWholeDayAbsence(absence) ? calendarEndMinutes : timeToMinutes(absence.timeTo);
  const top = Math.max(0, ((startMinutes - calendarStartMinutes) / CALENDAR_SLOT_MINUTES) * CALENDAR_SLOT_HEIGHT);
  const height = Math.max(30, ((endMinutes - startMinutes) / CALENDAR_SLOT_MINUTES) * CALENDAR_SLOT_HEIGHT - 6);
  block.style.top = `${top + 3}px`;
  block.style.height = `${height}px`;
  block.innerHTML = `
    <strong>${escapeHtml(absence.type)}</strong>
    <span>${isWholeDayAbsence(absence) ? "Cały dzień" : `${escapeHtml(formatTime(range.start))}–${escapeHtml(formatTime(range.end))}`}</span>
  `;
  const openConfirm = (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDoctorAbsenceDeleteConfirm(absence.id);
  };
  block.addEventListener("click", openConfirm);
  block.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") openConfirm(event);
  });
  return block;
}

function openDoctorAbsenceDeleteConfirm(absenceId) {
  const absence = doctorAbsences.find((item) => String(item.id) === String(absenceId));
  if (!absence || absence.status !== "active") return;
  const doctor = doctors.find((item) => String(getDoctorEntityId(item)) === String(absence.doctorId));
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.dataset.absenceDeleteConfirm = "true";
  backdrop.innerHTML = `
    <div class="modal doctor-absence-confirm-modal" role="dialog" aria-modal="true" aria-label="Potwierdzenie usunięcia nieobecności">
      <div class="modal-heading doctor-absence-heading">
        <div class="doctor-absence-heading-main">
          <span class="doctor-absence-heading-icon warning">${uiIcon("calendar")}</span>
          <div>
            <h2>Usunąć nieobecność?</h2>
            <p>${escapeHtml(doctor ? doctorFullName(doctor) : "Lekarz")} · ${escapeHtml(renderAbsenceDateRange(absence))}</p>
          </div>
        </div>
        <button class="modal-close" type="button" data-close-absence-confirm aria-label="Zamknij">×</button>
      </div>
      <div class="absence-confirm-body">
        <p>Ta nieobecność zniknie z kalendarza i przestanie blokować terminy rejestracji.</p>
        <div class="absence-confirm-summary">
          <strong>${escapeHtml(absence.type)}</strong>
          <span>${escapeHtml(renderAbsenceDateRange(absence))}</span>
          ${absence.note ? `<small>${escapeHtml(absence.note)}</small>` : ""}
        </div>
      </div>
      <div class="modal-actions doctor-absence-actions">
        <button class="secondary-button" type="button" data-close-absence-confirm>Nie, zostaw</button>
        <button class="danger-button" type="button" data-confirm-absence-delete>Usuń nieobecność</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelectorAll("[data-close-absence-confirm]").forEach((button) => button.addEventListener("click", close));
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector("[data-confirm-absence-delete]")?.addEventListener("click", async () => {
    const button = backdrop.querySelector("[data-confirm-absence-delete]");
    if (button) button.disabled = true;
    await cancelDoctorAbsence(absence.id, doctor || { id: absence.doctorId });
    close();
  });
}

function renderCalendarMiniPicker() {
  if (!elements.miniCalendar) return;

  const selected = parseLocalDate(selectedDate);
  const firstDay = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const start = addDays(firstDay, -((firstDay.getDay() + 6) % 7));
  const grid = document.createElement("div");
  grid.className = "mini-grid";

  ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"].forEach((day) => {
    const label = document.createElement("strong");
    label.textContent = day;
    grid.appendChild(label);
  });

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(start, index);
    const dateIso = dateToIso(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mini-day${date.getMonth() !== selected.getMonth() ? " muted" : ""}${dateIso === today() ? " today" : ""}${dateIso === selectedDate ? " active" : ""}`;
    button.textContent = String(date.getDate());
    button.addEventListener("click", () => {
      selectedDate = dateIso;
      renderCalendar();
    });
    grid.appendChild(button);
  }

  elements.miniCalendar.replaceChildren();
  const head = document.createElement("div");
  head.className = "mini-head";
  head.innerHTML = `
    <button class="mini-nav" type="button" data-mini-prev>‹</button>
    <strong>${escapeHtml(safeFmt(firstDay, { month: "long", year: "numeric" }))}</strong>
    <button class="mini-nav" type="button" data-mini-next>›</button>
  `;
  elements.miniCalendar.append(head, grid);
  head.querySelector("[data-mini-prev]")?.addEventListener("click", () => {
    selectedDate = dateToIso(new Date(selected.getFullYear(), selected.getMonth() - 1, Math.min(selected.getDate(), 28)));
    renderCalendar();
  });
  head.querySelector("[data-mini-next]")?.addEventListener("click", () => {
    selectedDate = dateToIso(new Date(selected.getFullYear(), selected.getMonth() + 1, Math.min(selected.getDate(), 28)));
    renderCalendar();
  });
}

// ==============================
// Modal logic
// ==============================
function setStatus(element, message) {
  if (element) {
    element.textContent = message;
    if (element.id === "appointmentStatus") {
      const isSuccess = /^Dodano pacjenta\b/.test(String(message || ""));
      element.classList.toggle("is-error", Boolean(message) && !isSuccess);
      element.classList.toggle("is-success", Boolean(message) && isSuccess);
    }
  }
}

function openModal(modal) {
  if (modal) {
    modal.hidden = false;
    bindPolishPhoneInputs(modal);
  }
}

function closeModal(modal) {
  if (modal) {
    modal.hidden = true;
  }
}

function closeAllModals() {
  closeModal(elements.appointmentModal);
  closeModal(elements.detailsModal);
}

function canCreateAppointments() {
  return authRoleKey(currentUser.role) === "recepcja";
}

function closeAppointmentModal() {
  closeModal(elements.appointmentModal);
}

function findPatientById(patientId) {
  if (!patientId) return null;
  return patients.find((patient) => String(patient.id) === String(patientId) || String(patient.patient_id) === String(patientId)) || null;
}

function findDoctorByIdOrValue(value) {
  if (!value) return null;
  return doctors.find((doctor) => {
    const doctorId = doctor.id ?? doctor.doctor_id;
    return String(doctorId) === String(value) || String(doctor.doctor_id) === String(value) || doctorFullName(doctor) === value;
  }) || null;
}

function findServiceByIdOrValue(value) {
  if (!value) return null;
  return services.find((service) => {
    const serviceId = service.id ?? service.service_id;
    return String(serviceId) === String(value) || String(service.service_id) === String(value) || service.name === value || service.specialization === value;
  }) || null;
}

function findCabinetByIdOrValue(value) {
  if (!value) return null;
  return cabinets.find((cabinet) => {
    const cabinetId = cabinet.id ?? cabinet.cabinet_id;
    const target = String(value).trim();
    return String(cabinetId) === target
      || String(cabinet.cabinet_id ?? "") === target
      || String(cabinet.room_number ?? cabinet.number ?? "").trim() === target
      || String(cabinet.name || "").trim() === target;
  }) || null;
}

function findCabinetByBackendId(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const target = String(value).trim();
  return cabinets.find((cabinet) => {
    const cabinetId = cabinet.id ?? cabinet.cabinet_id;
    return String(cabinetId ?? "").trim() === target || String(cabinet.cabinet_id ?? "").trim() === target;
  }) || null;
}

function getSelectedDoctorCabinetFromForm(form) {
  const select = form?.elements?.cabinet;
  if (!select || !select.value) return null;

  const selectedOption = select.selectedOptions?.[0] || null;
  const backendId = selectedOption?.dataset.backendId || "";
  const selectedName = selectedOption?.dataset.cabinetName || selectedOption?.textContent?.split("·")[0]?.trim() || "";
  const selectedType = selectedOption?.dataset.cabinetType || "";

  const cabinet = findCabinetByBackendId(backendId)
    || findCabinetByIdOrValue(select.value)
    || findCabinetByIdOrValue(selectedName);

  if (cabinet) {
    return cabinet;
  }

  return {
    id: backendId || select.value,
    cabinet_id: backendId || select.value,
    name: selectedName,
    cabinet_type: selectedType,
    type: selectedType,
  };
}

function getDoctorCabinetId(doctor) {
  const directId = doctor?.cabinet_id ?? doctor?.cabinetId;
  if (directId !== undefined && directId !== null && String(directId).trim() !== "") {
    return directId;
  }
  const cabinet = findCabinetByIdOrValue(doctor?.cabinet || doctor?.cabinetName || doctor?.cabinet_name);
  return cabinet?.cabinet_id ?? cabinet?.id ?? null;
}

function getDoctorDefaultCabinet(doctor) {
  if (!doctor) return null;
  const directCabinet = findCabinetByBackendId(doctor.cabinet_id ?? doctor.cabinetId);
  if (directCabinet) return directCabinet;
  return findCabinetByIdOrValue(doctor.cabinet || doctor.cabinetName || doctor.cabinet_name);
}

function setSelectValueByIdOrValue(select, value) {
  if (!select || value === undefined || value === null || value === "") return;
  const target = String(value);
  const option = Array.from(select.options).find((item) => {
    return item.value === target || item.dataset.backendId === target || item.textContent.trim() === target;
  });
  if (option) select.value = option.value;
}

function getSelectedDoctor() {
  const select = elements.appointmentForm?.elements.doctor;
  return findDoctorByIdOrValue(getSelectedOptionBackendId(select) || select?.value);
}

function getSelectedService() {
  const service = getRawSelectedAppointmentService();
  const doctor = getSelectedDoctor();
  if (doctor && service && !doctorCanPerformService(doctor, service)) {
    return null;
  }
  return service;
}

function getSelectedCabinet() {
  const select = elements.appointmentForm?.elements.cabinet;
  const backendId = getSelectedOptionBackendId(select);
  const matched = backendId
    ? findCabinetByBackendId(backendId)
    : findCabinetByIdOrValue(select?.value);
  if (matched || !select?.value) return matched;

  const option = select.selectedOptions?.[0];
  const optionBackendId = option?.dataset.backendId || (isNumericId(select.value) ? select.value : null);
  const name = option?.dataset.cabinetName || option?.textContent?.trim() || select.value;
  const type = option?.dataset.cabinetType || name;
  return normalizeCabinet({
    id: optionBackendId || select.value,
    cabinet_id: optionBackendId,
    name,
    cabinet_type: type,
    is_active: true,
  });
}

function syncAppointmentCabinetFromDoctor() {
  const select = elements.appointmentForm?.elements.cabinet;
  if (!select) return null;
  const doctor = getSelectedDoctor();
  const service = getSelectedService();
  const compatibleCabinets = getAppointmentCompatibleCabinets(doctor, service);
  const previousValue = select.value;
  setAppointmentCabinetOptions(compatibleCabinets, { preserveSelected: true });

  if (!compatibleCabinets.length) {
    select.value = "";
    return null;
  }

  if (!getSelectedCabinet() && doctor) {
    const defaultCabinet = getDoctorDefaultCabinet(doctor);
    if (defaultCabinet && compatibleCabinets.some((cabinet) => String(cabinet.id ?? cabinet.cabinet_id) === String(defaultCabinet.id ?? defaultCabinet.cabinet_id))) {
      setSelectValueByIdOrValue(select, defaultCabinet.id ?? defaultCabinet.cabinet_id);
    } else if (previousValue) {
      select.value = "";
    }
  }

  return getSelectedCabinet();
}

function getSelectedServiceDuration() {
  const service = getSelectedService();
  return Number(service?.durationMinutes || service?.duration || 30) || 30;
}

function getAppointmentSlotStepMinutes() {
  return getAppointmentSettings().minIntervalMinutes || 15;
}

function debugAppointmentFlow(label = "snapshot", extra = {}) {
  const form = elements.appointmentForm;
  if (!form) return;

  const doctorSelect = form.elements.doctor;
  const serviceSelect = form.elements.specialization;
  const cabinetSelect = form.elements.cabinet;
  const rawService = findServiceByIdOrValue(getSelectedOptionBackendId(serviceSelect) || serviceSelect?.value);
  const doctor = getSelectedDoctor();
  const service = getSelectedService();
  const cabinet = getSelectedCabinet();
  const serviceSpec = getAppointmentServiceSpecialization(rawService || service, doctor);
  const compatibleCabinets = getAppointmentCompatibleCabinets(doctor, rawService || service);

  console.groupCollapsed(`[appointment-debug] ${label}`);
  console.info("frontendVersion", MEDIPLUS_FRONTEND_VERSION);
  console.info("form", {
    date: form.elements.date?.value,
    time: form.elements.time?.value,
    doctorValue: doctorSelect?.value,
    doctorBackendId: getSelectedOptionBackendId(doctorSelect),
    serviceValue: serviceSelect?.value,
    serviceBackendId: getSelectedOptionBackendId(serviceSelect),
    cabinetValue: cabinetSelect?.value,
    cabinetBackendId: getSelectedOptionBackendId(cabinetSelect),
    extra,
  });
  console.info("selectedDoctor", doctor ? {
    id: doctor.id,
    doctor_id: doctor.doctor_id,
    name: doctorFullName(doctor),
    specialization: doctor.specialization,
    normalizedSpecialization: normalizeSpecialization(doctor.specialization),
    cabinet: doctor.cabinet,
    cabinet_id: doctor.cabinet_id,
  } : null);
  console.info("rawSelectedService", rawService ? {
    id: rawService.id,
    service_id: rawService.service_id,
    name: serviceName(rawService),
    specialization: rawService.specialization,
    specialization_name: rawService.specialization_name,
    inferredSpecialization: serviceSpec,
    normalizedSpecialization: normalizeSpecialization(serviceSpec),
    doctorCanPerform: doctor ? doctorCanPerformService(doctor, rawService) : null,
  } : null);
  console.info("effectiveSelectedService", service ? {
    id: service.id,
    service_id: service.service_id,
    name: serviceName(service),
    specialization: service.specialization,
    inferredSpecialization: getAppointmentServiceSpecialization(service, doctor),
  } : null);
  console.info("selectedCabinet", cabinet ? {
    id: cabinet.id,
    cabinet_id: cabinet.cabinet_id,
    name: cabinet.name,
    number: cabinet.number,
    type: cabinet.type,
    cabinet_type: cabinet.cabinet_type,
    compatibleWithService: isCabinetCompatibleWithSpecialization(cabinet, serviceSpec || doctor?.specialization || ""),
  } : null);
  console.table(Array.from(serviceSelect?.options || []).map((option) => {
    const item = findServiceByIdOrValue(option.dataset.backendId || option.value);
    return {
      label: option.textContent,
      value: option.value,
      backendId: option.dataset.backendId || "",
      specialization: item?.specialization || "",
      inferred: getAppointmentServiceSpecialization(item, doctor),
      doctorCanPerform: doctor && item ? doctorCanPerformService(doctor, item) : "",
    };
  }));
  console.table(Array.from(cabinetSelect?.options || []).map((option) => {
    const item = option.dataset.backendId
      ? findCabinetByBackendId(option.dataset.backendId)
      : findCabinetByIdOrValue(option.value);
    return {
      label: option.textContent,
      value: option.value,
      backendId: option.dataset.backendId || "",
      type: item?.type || item?.cabinet_type || "",
      compatible: item ? isCabinetCompatibleWithSpecialization(item, serviceSpec || doctor?.specialization || "") : "",
    };
  }));
  console.table(compatibleCabinets.map((item) => ({
    id: item.id,
    cabinet_id: item.cabinet_id,
    name: item.name,
    number: item.number,
    type: item.type || item.cabinet_type,
  })));
  console.groupEnd();
}

window.mediPlusDebugAppointment = debugAppointmentFlow;

function minutesToTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function getDayIndex(date) {
  const jsDay = parseLocalDate(date).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

const scheduleDayKeys = [
  ["monday", "poniedzialek", "poniedziałek", "pn", "1"],
  ["tuesday", "wtorek", "wt", "2"],
  ["wednesday", "sroda", "środa", "sr", "śr", "3"],
  ["thursday", "czwartek", "cz", "4"],
  ["friday", "piatek", "piątek", "pt", "5"],
  ["saturday", "sobota", "sb", "6"],
  ["sunday", "niedziela", "nd", "0", "7"],
];

function normalizeWorkingWindow(raw, fallback = null) {
  if (!raw) return fallback;
  if (raw === true) return fallback;
  if (typeof raw === "string") {
    const match = raw.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
    if (match) return { active: true, start: formatTime(match[1]), end: formatTime(match[2]) };
    if (/nie|closed|zamk/i.test(raw)) return { active: false, start: "", end: "" };
    return fallback;
  }

  const closed = raw.closed === true || raw.isClosed === true || raw.is_active === false || raw.active === false || raw.is_active === 0;
  const start = formatTime(raw.start || raw.start_time || raw.from || raw.od || raw.open || raw.open_from);
  const end = formatTime(raw.end || raw.end_time || raw.to || raw.do || raw.close || raw.open_to);
  if (closed || !start || !end) return { active: false, start: "", end: "" };
  return { active: true, start, end };
}

function getScheduleEntryForDate(schedule, date, fallback = null) {
  if (!schedule) return fallback;
  const dayIndex = getDayIndex(date);

  if (Array.isArray(schedule)) {
    const entry = schedule.find((item) => {
      const value = Number(item.day_of_week ?? item.dayOfWeek ?? item.day ?? item.weekday);
      return value === dayIndex || value === dayIndex + 1 || (dayIndex === 6 && value === 0);
    });
    return normalizeWorkingWindow(entry, fallback);
  }

  const keys = scheduleDayKeys[dayIndex] || [];
  const matchKey = Object.keys(schedule).find((key) => keys.includes(String(key).trim().toLowerCase()));
  return normalizeWorkingWindow(matchKey ? schedule[matchKey] : null, fallback);
}

function getDefaultDoctorWindow(date) {
  const dayIndex = getDayIndex(date);
  return dayIndex < 5 ? { active: true, start: "08:00", end: "16:00" } : { active: false, start: "", end: "" };
}

function getDefaultClinicWindow(date) {
  const dayIndex = getDayIndex(date);
  if (dayIndex < 5) return { active: true, start: "08:00", end: "18:00" };
  if (dayIndex === 5) return { active: true, start: "09:00", end: "14:00" };
  return { active: false, start: "", end: "" };
}

function getDoctorScheduleForDate(doctorId, date) {
  const doctor = findDoctorByIdOrValue(doctorId);
  const fallback = getDefaultDoctorWindow(date);
  return getScheduleEntryForDate(doctor?.schedule, date, fallback) || fallback;
}

function getClinicWorkingHoursForDate(date) {
  const fallback = getDefaultClinicWindow(date);
  return getScheduleEntryForDate(getClinicWorkingHoursSettings(), date, fallback) || fallback;
}

function appointmentOverlaps(appointment, start, end) {
  const appointmentStart = appointmentStartDateTime(appointment);
  const appointmentEnd = appointmentEndDateTime(appointment);
  return Boolean(appointmentStart && appointmentEnd && appointmentStart < end && appointmentEnd > start);
}

function appointmentBlocksPatient(appointment) {
  return !["Anulowana", "Nieobecny pacjent"].includes(getResolvedAppointmentStatus(appointment));
}

function buildPatientConflictRange(date, startTime, durationMinutes = 30, endTime = "") {
  const startValue = formatTime(startTime);
  if (!date || !startValue) return null;
  const start = combineLocalDateTime(date, startValue);
  const resolvedEnd = endTime
    ? formatTime(endTime)
    : formatTime(addMinutesToTime(startValue, Number(durationMinutes) || 30));
  const end = combineLocalDateTime(date, resolvedEnd);
  return start && end && end > start ? { start, end } : null;
}

function findPatientAppointmentConflict(patient, range, { excludeAppointmentId = null } = {}) {
  if (!patient || !range?.start || !range?.end) return null;
  return appointments.find((appointment) => {
    const appointmentId = appointment.id ?? appointment.appointment_id;
    if (excludeAppointmentId && String(appointmentId) === String(excludeAppointmentId)) return false;
    return appointmentBlocksPatient(appointment)
      && isAppointmentForPatient(appointment, patient)
      && appointmentOverlaps(appointment, range.start, range.end);
  }) || null;
}

function isPatientAvailableForRange(patient, range, options = {}) {
  return !findPatientAppointmentConflict(patient, range, options);
}

function getQuickAppointmentPatientRange() {
  const form = elements.appointmentForm;
  if (!form) return null;
  const service = getSelectedService();
  const date = form.elements.date?.value || selectedDate || today();
  const startTime = formatTime(form.elements.time?.value || "");
  const duration = Number(service?.durationMinutes || service?.duration || 30) || 30;
  return buildPatientConflictRange(date, startTime, duration);
}

function isPatientAvailableForQuickAppointment(patient) {
  const range = getQuickAppointmentPatientRange();
  return !range || isPatientAvailableForRange(patient, range);
}

function getRegistrationPatientRange(date = registrationDraft.date, time = registrationDraft.time) {
  const service = findServiceByIdOrValue(registrationDraft.serviceId);
  const duration = Number(service?.durationMinutes || service?.duration || 30) || 30;
  return buildPatientConflictRange(date, time, duration);
}

function isRegistrationPatientAvailable(patient, date = registrationDraft.date, time = registrationDraft.time) {
  const range = getRegistrationPatientRange(date, time);
  return !range || isPatientAvailableForRange(patient, range);
}

function findPatientForAppointmentPayload(payload) {
  if (!payload) return null;
  return findPatientById(payload.patient_id)
    || findPatientById(selectedAppointmentPatientId)
    || findPatientById(findPatientBackendId(payload.first_name, payload.last_name, payload.phone));
}

function getAppointmentPayloadPatientConflict(payload) {
  const patient = findPatientForAppointmentPayload(payload);
  const service = findServiceByIdOrValue(payload?.service_id) || getSelectedService();
  const duration = Number(payload?.duration || service?.durationMinutes || service?.duration || 30) || 30;
  const range = buildPatientConflictRange(
    payload?.appointment_date || payload?.date,
    payload?.start_time || payload?.time,
    duration,
    payload?.end_time || payload?.endTime || ""
  );
  return findPatientAppointmentConflict(patient, range, {
    excludeAppointmentId: payload?.id || payload?.appointment_id,
  });
}

function appointmentBlocksCabinet(appointment, cabinet, start, end, visitDate) {
  if (!appointment || !cabinet) return false;
  if (getAppointmentDateIso(appointment, getMonday(parseLocalDate(visitDate))) !== visitDate) return false;
  if (["Anulowana", "Nieobecny pacjent"].includes(getResolvedAppointmentStatus(appointment))) return false;
  const cabinetId = cabinet.id ?? cabinet.cabinet_id;
  const appointmentCabinetKey = String(calendarAppointmentCabinetKey(appointment));
  const sameCabinet = appointmentCabinetKey === String(cabinetId)
    || appointmentCabinetKey === String(cabinet.cabinet_id ?? "")
    || appointmentCabinetKey === String(cabinet.name || "");
  return sameCabinet && appointmentOverlaps(appointment, start, end);
}

function findAvailableCabinetForSlot({ doctor, service, date, start, end, preferredCabinetId = null } = {}) {
  if (!doctor || !start || !end) return null;
  if (service && !doctorCanPerformService(doctor, service)) return null;
  const specialization = getAppointmentServiceSpecialization(service, doctor);
  const compatibleCabinets = getCompatibleCabinetsForSpecialization(specialization);
  const formCabinetSelect = elements.appointmentForm?.elements.cabinet;
  const preferredCabinet = findCabinetByBackendId(preferredCabinetId) || findCabinetByIdOrValue(preferredCabinetId)
    || (formCabinetSelect && String(preferredCabinetId || "") === String(getSelectedOptionBackendId(formCabinetSelect) || formCabinetSelect.value || "") ? getSelectedCabinet() : null);
  const orderedCabinets = preferredCabinet && isCabinetCompatibleWithSpecialization(preferredCabinet, specialization)
    ? [preferredCabinet, ...compatibleCabinets.filter((cabinet) => String(cabinet.id ?? cabinet.cabinet_id) !== String(preferredCabinet.id ?? preferredCabinet.cabinet_id))]
    : compatibleCabinets;

  return orderedCabinets.find((cabinet) => {
    return !appointments.some((appointment) => appointmentBlocksCabinet(appointment, cabinet, start, end, String(date || today()).slice(0, 10)));
  }) || null;
}

function availableStartTimes({ doctorId, serviceId, date, cabinetId } = {}) {
  const selectedDoctor = findDoctorByIdOrValue(doctorId);
  const selectedService = findServiceByIdOrValue(serviceId);
  const formCabinetSelect = elements.appointmentForm?.elements.cabinet;
  const selectedCabinet = findCabinetByBackendId(cabinetId) || findCabinetByIdOrValue(cabinetId)
    || (formCabinetSelect && String(cabinetId || "") === String(getSelectedOptionBackendId(formCabinetSelect) || formCabinetSelect.value || "") ? getSelectedCabinet() : null);
  const visitDate = String(date || today()).slice(0, 10);
  const duration = Number(selectedService?.durationMinutes || selectedService?.duration || 30) || 30;
  const slotStep = getAppointmentSlotStepMinutes();

  if (!selectedDoctor) {
    return { slots: [], reason: "Wybierz lekarza." };
  }

  if (!selectedService) {
    return { slots: [], reason: "Wybierz usługę." };
  }

  if (selectedService && !doctorCanPerformService(selectedDoctor, selectedService)) {
    return { slots: [], reason: "Lekarz nie wykonuje wybranej usługi." };
  }

  const resolvedDoctorId = selectedDoctor.id ?? selectedDoctor.doctor_id;
  const doctorWindow = getDoctorScheduleForDate(resolvedDoctorId, visitDate);
  const clinicWindow = getClinicWorkingHoursForDate(visitDate);
  const activeAbsences = getDoctorAbsencesForDate(resolvedDoctorId, visitDate);

  if (!clinicWindow.active) {
    return { slots: [], reason: "Klinika jest zamknięta w wybranym dniu." };
  }

  if (!doctorWindow.active) {
    return { slots: [], reason: "Lekarz nie pracuje w wybranym dniu." };
  }

  if (activeAbsences.some(isWholeDayAbsence)) {
    return { slots: [], reason: "Lekarz jest nieobecny w wybranym terminie." };
  }

  const startMinutes = Math.max(timeToMinutes(clinicWindow.start), timeToMinutes(doctorWindow.start));
  const endMinutes = Math.min(timeToMinutes(clinicWindow.end), timeToMinutes(doctorWindow.end));
  const appointmentSpecialization = getAppointmentServiceSpecialization(selectedService, selectedDoctor);
  const compatibleCabinets = selectedCabinet
    ? (isCabinetCompatibleWithSpecialization(selectedCabinet, appointmentSpecialization) ? [selectedCabinet] : [])
    : getCompatibleCabinetsForSpecialization(appointmentSpecialization);

  if (!compatibleCabinets.length) {
    return { slots: [], reason: "Brak gabinetu zgodnego ze specjalizacją." };
  }

  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || startMinutes + duration > endMinutes) {
    return { slots: [], reason: "Brak dostępnych terminów dla wybranego lekarza." };
  }

  const blockedAppointments = appointments.filter((appointment) => {
    if (getAppointmentDateIso(appointment, getMonday(parseLocalDate(visitDate))) !== visitDate) return false;
    if (["Anulowana", "Nieobecny pacjent"].includes(getResolvedAppointmentStatus(appointment))) return false;
    return isAppointmentForDoctor(appointment, resolvedDoctorId);
  });

  const slots = [];
  const now = new Date();
  const isToday = visitDate === today();
  for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += slotStep) {
    const start = combineLocalDateTime(visitDate, minutesToTime(minutes));
    const end = combineLocalDateTime(visitDate, minutesToTime(minutes + duration));
    if (!start || !end) continue;
    if (isToday && start <= now) continue;
    if (doctorIsAbsentInRange(resolvedDoctorId, visitDate, start, end)) continue;
    if (blockedAppointments.some((appointment) => appointmentOverlaps(appointment, start, end))) continue;
    if (compatibleCabinets.some((cabinet) => !appointments.some((appointment) => appointmentBlocksCabinet(appointment, cabinet, start, end, visitDate)))) {
      slots.push(minutesToTime(minutes));
    }
  }

  return {
    slots,
    reason: slots.length ? "" : "Brak dostępnych terminów dla wybranego lekarza.",
  };
}

function updateDurationInfo() {
  const form = elements.appointmentForm;
  if (!form) return;
  const duration = getSelectedServiceDuration();
  const startTime = formatTime(form.elements.time?.value || "");
  const endTime = startTime ? formatTime(addMinutesToTime(startTime, duration)) : "--:--";
  const box = document.querySelector("#durationBox");
  if (box) {
    box.innerHTML = `ⓘ Czas trwania wizyty: ${duration} min <span>Planowane zakończenie: ${escapeHtml(endTime)}</span>`;
  }
}

function setAppointmentTimeValue(time, options = {}) {
  const remember = options.remember !== false;
  const select = elements.appointmentForm?.elements.time;
  if (!select) return;
  const value = formatTime(time);
  select.replaceChildren();
  if (value) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
    select.value = value;
    if (remember) appointmentPreferredTime = value;
  }
  const form = elements.appointmentForm;
  const doctor = getSelectedDoctor();
  const service = getSelectedService();
  const date = form?.elements.date?.value || selectedDate || today();
  const start = combineLocalDateTime(date, value);
  const duration = Number(service?.durationMinutes || service?.duration || 30) || 30;
  const end = combineLocalDateTime(date, formatTime(addMinutesToTime(value, duration)));
  if (doctor && service && start && end) {
    const selectedCabinet = getSelectedCabinet();
    const availableCabinet = findAvailableCabinetForSlot({
      doctor,
      service,
      date,
      start,
      end,
      preferredCabinetId: selectedCabinet?.id ?? selectedCabinet?.cabinet_id,
    });
    if (availableCabinet && form?.elements.cabinet) {
      setSelectValueByIdOrValue(form.elements.cabinet, availableCabinet.id ?? availableCabinet.cabinet_id);
    }
  }
  updateDurationInfo();
  renderRecentPatients(form?.elements.patientSearch?.value || "");
}

function renderAvailableTimeButtons(preferredTime = "") {
  const form = elements.appointmentForm;
  const container = document.querySelector("#timeSlotButtons");
  if (!form || !container) return;

  const doctor = getSelectedDoctor();
  const service = getSelectedService();
  syncAppointmentCabinetFromDoctor();
  const cabinet = getSelectedCabinet();
  const date = form.elements.date?.value || selectedDate || today();
  const result = availableStartTimes({
    doctorId: doctor?.id ?? doctor?.doctor_id,
    serviceId: service?.id ?? service?.service_id ?? form.elements.specialization?.value,
    date,
    cabinetId: cabinet?.id ?? cabinet?.cabinet_id ?? form.elements.cabinet?.value,
  });
  debugAppointmentFlow("renderAvailableTimeButtons", {
    reason: result.reason || "",
    slotCount: (result.slots || []).length,
    slots: result.slots || [],
  });
  const slots = result.slots || [];
  const currentTime = formatTime(preferredTime || appointmentPreferredTime || form.elements.time?.value || slots[0] || "");

  container.replaceChildren();
  if (!slots.length) {
    const message = document.createElement("p");
    message.className = "empty-note time-slot-empty";
    message.textContent = result.reason || "Brak dostępnych terminów dla wybranego lekarza.";
    container.appendChild(message);
    setAppointmentTimeValue("", { remember: false });
    return;
  }

  slots.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `time-choice${slot === currentTime ? " active" : ""}`;
    button.textContent = slot;
    button.addEventListener("click", () => {
      setAppointmentTimeValue(slot);
      container.querySelectorAll(".time-choice").forEach((item) => item.classList.toggle("active", item === button));
    });
    container.appendChild(button);
  });

  setAppointmentTimeValue(slots.includes(currentTime) ? currentTime : slots[0]);
}

function resetAppointmentForm() {
  const form = elements.appointmentForm;
  if (!form) return;
  clearFieldErrors(form);
  setStatus(elements.appointmentStatus, "");
  selectedAppointmentPatientId = null;
  appointmentPreferredTime = "";
  form.reset();
  if (form.elements.cabinet) form.elements.cabinet.disabled = false;
  form.elements.date.value = selectedDate || today();
  document.querySelector("#selectedPatientSummary")?.setAttribute("hidden", "");
  renderAvailableTimeButtons();
}

function selectAppointmentPatient(patient) {
  const form = elements.appointmentForm;
  if (!form || !patient) return;
  if (!isActivePatient(patient)) {
    setStatus(elements.appointmentStatus, "Nie można zapisać wizyty dla pacjenta archiwalnego.");
    return;
  }
  selectedAppointmentPatientId = patient.id ?? patient.patient_id ?? null;
  form.elements.firstName.value = patient.firstName || patient.first_name || "";
  form.elements.lastName.value = patient.lastName || patient.last_name || "";
  form.elements.phone.value = formatPolishPhone(patient.phone || "");
  const summary = document.querySelector("#selectedPatientSummary");
  if (summary) {
    summary.hidden = false;
    summary.innerHTML = `<strong>${escapeHtml(patientFullName(patient) || patient.name || "Pacjent")}</strong><span>${escapeHtml(patient.phone || "Niepełny profil")}</span>`;
  }
}

function renderRecentPatients(query = "") {
  const container = document.querySelector("#recentPatients");
  if (!container) return;
  const normalized = String(query || "").trim().toLowerCase();
  const visiblePatients = patients
    .filter(isActivePatient)
    .filter(isPatientAvailableForQuickAppointment)
    .filter((patient) => {
      if (!normalized) return true;
      const haystack = [patientFullName(patient), patient.pesel, patient.phone, patient.email].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });

  container.innerHTML = visiblePatients.length
    ? visiblePatients.map((patient) => `
        <button class="recent-patient" type="button" data-patient-id="${escapeHtml(patient.id)}">
          ${renderPatientInitials(patientFullName(patient))}
          <span><strong>${escapeHtml(patientFullName(patient) || patient.name || "Pacjent")}</strong><small>${escapeHtml(patient.phone || patient.pesel || "Niepełny profil")}</small></span>
        </button>
      `).join("")
    : `<p class="empty-note">Brak pacjentów.</p>`;

  container.querySelectorAll("[data-patient-id]").forEach((button) => {
    button.addEventListener("click", () => selectAppointmentPatient(findPatientById(button.dataset.patientId)));
  });
}

function fillAppointmentForm(prefill = {}) {
  const form = elements.appointmentForm;
  if (!form) return;
  appointmentPreferredTime = formatTime(prefill.startTime || prefill.time || "") || appointmentPreferredTime;

  if (prefill.patientId) {
    selectAppointmentPatient(findPatientById(prefill.patientId));
  }
  if (!prefill.patientId) {
    if (prefill.firstName) form.elements.firstName.value = prefill.firstName;
    if (prefill.lastName) form.elements.lastName.value = prefill.lastName;
    if (prefill.phone) form.elements.phone.value = formatPolishPhone(prefill.phone);
  }

  setSelectValueByIdOrValue(form.elements.doctor, prefill.doctorId || prefill.doctor);
  refreshAppointmentServiceOptionsForDoctor({ preserveSelected: true });
  setSelectValueByIdOrValue(form.elements.specialization, prefill.serviceId || prefill.service);
  refreshAppointmentDoctorOptionsForService({ preserveSelected: true });
  setSelectValueByIdOrValue(form.elements.cabinet, prefill.cabinetId || prefill.cabinet);
  syncAppointmentCabinetFromDoctor();

  if (prefill.date) form.elements.date.value = String(prefill.date).slice(0, 10);
  if (prefill.notes) form.elements.note.value = prefill.notes;
  renderAvailableTimeButtons(prefill.startTime || prefill.time || "");
}

function openAppointmentModal(prefill = {}) {
  if (!canCreateAppointments()) return;
  populateDoctorFields(doctors);
  populateServiceFields(services);
  populateCabinetFields(cabinets);
  resetAppointmentForm();
  fillAppointmentForm(prefill);
  renderRecentPatients();
  openModal(elements.appointmentModal);
  bindPolishPhoneInputs(elements.appointmentForm);
  elements.appointmentForm?.elements.patientSearch?.focus();
}

function getSelectedOptionBackendId(select) {
  const option = select?.selectedOptions?.[0];
  return option?.dataset.backendId ? Number(option.dataset.backendId) : null;
}

function getAppointmentPatientName(data) {
  return `${String(data.get("firstName") || "").trim()} ${String(data.get("lastName") || "").trim()}`.trim();
}

function findPatientBackendId(firstName, lastName, phone) {
  const normalizedName = `${String(firstName || "").trim()} ${String(lastName || "").trim()}`.trim().toLowerCase();
  const normalizedPhone = String(phone || "").replace(/\D/g, "").replace(/^48(?=\d{9}$)/, "");
  const patient = patients.find((item) => {
    const fullName = `${item.firstName} ${item.lastName}`.trim().toLowerCase();
    const itemPhone = String(item.phone || "").replace(/\D/g, "").replace(/^48(?=\d{9}$)/, "");
    return fullName === normalizedName && itemPhone === normalizedPhone && isNumericId(item.id);
  });

  return patient ? Number(patient.id) : null;
}

function findDoctorBackendId(doctorName) {
  const doctor = backendDoctors.find((item) => item.fullName === doctorName && isNumericId(item.id));
  return doctor ? Number(doctor.id) : getSelectedOptionBackendId(elements.appointmentForm?.elements.doctor);
}

function findServiceForSpecialization(specialization) {
  const normalizedSpecialization = normalizeSpecialization(specialization);
  return backendServices.find((service) => {
    return (String(service.id) === String(specialization)
      || String(service.service_id) === String(specialization)
      || normalizeSpecialization(getAppointmentServiceSpecialization(service)) === normalizedSpecialization
      || service.name === specialization) && isNumericId(service.id);
  }) || findServiceByIdOrValue(specialization);
}

function addMinutesToTime(time, minutes) {
  const [hours, rawMinutes] = String(time || "00:00").split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, rawMinutes || 0, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);

  return date.toTimeString().slice(0, 8);
}

function toBackendTime(time) {
  return String(time || "").length === 5 ? `${time}:00` : String(time || "");
}

function getAppointmentBackendPayload() {
  const form = elements.appointmentForm;
  formatPolishPhoneFields(form);
  const data = new FormData(form);
  const firstName = String(data.get("firstName") || "").trim();
  const lastName = String(data.get("lastName") || "").trim();
  const phone = String(data.get("phone") || "").trim();
  const doctorName = String(data.get("doctor") || "").trim();
  const service = getSelectedService();
  const doctor = getSelectedDoctor();
  if (!doctor || !service || !doctorCanPerformService(doctor, service)) {
    return null;
  }
  const selectedCabinet = getSelectedCabinet();
  const start = formatTime(data.get("time"));
  const startTime = toBackendTime(start);
  const duration = service?.durationMinutes || service?.duration || 30;
  const appointmentDate = data.get("date");
  const startDateTime = combineLocalDateTime(appointmentDate, start);
  const endDateTime = combineLocalDateTime(appointmentDate, formatTime(addMinutesToTime(start, duration)));
  const preferredCabinet = selectedCabinet;
  const availableCabinet = findAvailableCabinetForSlot({
    doctor,
    service,
    date: appointmentDate,
    start: startDateTime,
    end: endDateTime,
    preferredCabinetId: preferredCabinet?.id ?? preferredCabinet?.cabinet_id,
  });
  const doctorIdValue = doctor?.doctor_id ?? doctor?.id ?? findDoctorBackendId(doctorName);
  const serviceIdValue = service?.service_id ?? service?.id ?? getSelectedOptionBackendId(form?.elements.specialization);
  const cabinetIdValue = availableCabinet?.cabinet_id ?? availableCabinet?.id ?? null;

  const payload = {
    patient_id: selectedAppointmentPatientId && isNumericId(selectedAppointmentPatientId) ? Number(selectedAppointmentPatientId) : findPatientBackendId(firstName, lastName, phone),
    first_name: firstName,
    last_name: lastName,
    phone,
    email: null,
    doctor_id: isNumericId(doctorIdValue) ? Number(doctorIdValue) : null,
    service_id: isNumericId(serviceIdValue) ? Number(serviceIdValue) : null,
    cabinet_id: isNumericId(cabinetIdValue) ? Number(cabinetIdValue) : null,
    appointment_date: appointmentDate,
    start_time: startTime,
    end_time: addMinutesToTime(startTime, duration),
    notes: String(data.get("note") || "").trim(),
  };

  const hasRequiredIds = [
    payload.doctor_id,
    payload.service_id,
    payload.cabinet_id,
  ].every(Boolean);

  const hasMinimalPatientData = payload.first_name && payload.last_name && payload.phone;

  return hasRequiredIds && hasMinimalPatientData ? payload : null;
}

function buildAppointmentFromForm(extra = {}) {
  const form = elements.appointmentForm;
  formatPolishPhoneFields(form);
  const data = new FormData(form);
  const date = data.get("date");
  const patientName = getAppointmentPatientName(data);
  const doctor = getSelectedDoctor();
  const service = getSelectedService();
  const start = formatTime(data.get("time"));
  const duration = Number(service?.durationMinutes || service?.duration || 30) || 30;
  const startDateTime = combineLocalDateTime(date, start);
  const endDateTime = combineLocalDateTime(date, formatTime(addMinutesToTime(start, duration)));
  const preferredCabinet = getSelectedCabinet();
  const cabinet = findAvailableCabinetForSlot({
    doctor,
    service,
    date,
    start: startDateTime,
    end: endDateTime,
    preferredCabinetId: extra.cabinet_id || preferredCabinet?.id || preferredCabinet?.cabinet_id,
  }) || preferredCabinet || findCabinetByBackendId(extra.cabinet_id) || findCabinetByIdOrValue(extra.cabinet_id);
  const appointment = normalizeAppointment({
    id: extra.id || extra.appointment_id || `appointment-${Date.now()}`,
    appointment_id: extra.appointment_id || extra.id || null,
    patient_id: extra.patient_id || selectedAppointmentPatientId || null,
    patient: patientName,
    phone: data.get("phone"),
    doctor_id: doctor?.doctor_id || doctor?.id || extra.doctor_id || null,
    service_id: service?.service_id || service?.id || extra.service_id || null,
    cabinet_id: cabinet?.cabinet_id || cabinet?.id || extra.cabinet_id || null,
    doctor: doctorFullName(doctor) || data.get("doctor"),
    specialization: getAppointmentServiceSpecialization(service, doctor) || service?.name || data.get("specialization"),
    service_name: service?.name || getAppointmentServiceSpecialization(service, doctor) || data.get("specialization"),
    date,
    time: start,
    start_time: toBackendTime(start),
    end_time: addMinutesToTime(start, duration),
    cabinet: cabinet?.name || data.get("cabinet"),
    notes: data.get("note"),
    status: extra.status || "planned",
  });

  return appointment;
}

function upsertAppointment(appointment) {
  const normalized = normalizeAppointment(appointment);
  if (!normalized) return null;
  const index = appointments.findIndex((item) => {
    return String(item.id) === String(normalized.id) || (item.appointment_id && normalized.appointment_id && String(item.appointment_id) === String(normalized.appointment_id));
  });

  if (index >= 0) {
    appointments[index] = { ...appointments[index], ...normalized };
  } else {
    appointments.push(normalized);
  }

  saveCollection(storageKeys.appointments, appointments);
  return normalized;
}

function refreshAfterAppointmentChange() {
  renderCalendar();
  if (activeView && activeView !== "calendar") {
    renderActiveView(activeView);
  }
}

async function cancelAppointment(appointmentId) {
  const appointment = appointments.find((item) => String(item.id) === String(appointmentId) || String(item.appointment_id) === String(appointmentId));
  if (!appointment || !canCancelAppointment(appointment)) return;
  if (!window.confirm("Czy na pewno anulować tę wizytę?")) return;

  const backendAppointment = await apiPatch("backend/api/appointments.php", {
    id: appointment.id || appointment.appointment_id || appointmentId,
    status: "cancelled",
  });

  let cancelled = normalizeAppointment(backendAppointment);
  if (!cancelled) {
    console.warn("[MediPlus] Backend cancellation failed; using local appointment fallback.");
    cancelled = normalizeAppointment({
      ...appointment,
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    });
  }
  if (!cancelled) return;

  upsertAppointment(cancelled);
  closeModal(elements.detailsModal);
  refreshAfterAppointmentChange();
}

function extractCreatedAppointment(response) {
  return response?.appointment || response?.data?.appointment || response?.data || response;
}

function storeAppointment() {
  const appointment = buildAppointmentFromForm();
  return upsertAppointment(appointment);
}

async function createMinimalPatientFromAppointmentForm() {
  const form = elements.appointmentForm;
  if (!form) return null;
  formatPolishPhoneFields(form);

  const firstName = String(form.elements.firstName?.value || "").trim();
  const lastName = String(form.elements.lastName?.value || "").trim();
  const phone = String(form.elements.phone?.value || "").trim();

  clearFieldErrors(form);
  if (!firstName || !lastName || !phone) {
    if (!firstName) setFieldError(form.elements.firstName, "Podaj imię.");
    if (!lastName) setFieldError(form.elements.lastName, "Podaj nazwisko.");
    if (!phone) setFieldError(form.elements.phone, "Podaj telefon.");
    setStatus(elements.appointmentStatus, "Uzupełnij dane pacjenta.");
    return null;
  }

  const payload = {
    first_name: firstName,
    last_name: lastName,
    phone,
    profile_status: "incomplete",
  };

  try {
    const response = await apiRequest("backend/api/patients.php", {
      method: "POST",
      body: payload,
    });
    const created = response.patient || response.data?.patient || response.data || response;
    const patient = normalizePatient({
      ...created,
      firstName,
      lastName,
      phone,
      profile_status: "incomplete",
    });
    if (patient) {
      const index = patients.findIndex((item) => String(item.id) === String(patient.id));
      if (index >= 0) patients[index] = { ...patients[index], ...patient };
      else patients.unshift(patient);
      saveCollection(storageKeys.patients, patients);
      selectAppointmentPatient(patient);
      renderRecentPatients();
      setStatus(elements.appointmentStatus, "Dodano pacjenta z niepełnym profilem.");
      return patient;
    }
  } catch {
    const patient = normalizePatient({
      id: `local-patient-${Date.now()}`,
      firstName,
      lastName,
      phone,
      profile_status: "incomplete",
      createdAt: new Date().toISOString(),
    });
    if (patient) {
      patients.unshift(patient);
      saveCollection(storageKeys.patients, patients);
      selectAppointmentPatient(patient);
      renderRecentPatients();
      setStatus(elements.appointmentStatus, "Backend jest niedostępny. Pacjent zapisany lokalnie jako niepełny profil.");
      return patient;
    }
  }

  setStatus(elements.appointmentStatus, "Nie udało się dodać pacjenta.");
  return null;
}

async function submitAppointmentRegistration(event, { showSuccess = true } = {}) {
  event?.preventDefault?.();
  lastAppointmentSubmitError = "";
  if (!canCreateAppointments()) return;
  debugAppointmentFlow("submit:start");
  if (!validateAppointmentModalFields()) return;
  if (selectedAppointmentPatientId && !isActivePatient(findPatientById(selectedAppointmentPatientId))) {
    lastAppointmentSubmitError = "Nie można zapisać wizyty dla pacjenta archiwalnego.";
    setStatus(elements.appointmentStatus, lastAppointmentSubmitError);
    return;
  }
  const selectedDoctor = getSelectedDoctor();
  const selectedService = getSelectedService();
  if (selectedDoctor && selectedService && !doctorCanPerformService(selectedDoctor, selectedService)) {
    lastAppointmentSubmitError = "Lekarz nie wykonuje wybranej usługi.";
    setStatus(elements.appointmentStatus, lastAppointmentSubmitError);
    return;
  }
  const appointmentCabinets = getAppointmentCompatibleCabinets(selectedDoctor, selectedService);
  if (selectedDoctor && selectedService && !appointmentCabinets.length) {
    lastAppointmentSubmitError = "Brak gabinetu zgodnego ze specjalizacją usługi.";
    setStatus(elements.appointmentStatus, lastAppointmentSubmitError);
    debugAppointmentFlow("submit:no-compatible-cabinets", { error: lastAppointmentSubmitError });
    return;
  }

  const backendPayload = getAppointmentBackendPayload();
  debugAppointmentFlow("submit:payload", { backendPayload });

  if (!backendPayload) {
    const form = elements.appointmentForm;
    const localAvailability = availableStartTimes({
      doctorId: getSelectedDoctor()?.id || getSelectedDoctor()?.doctor_id,
      serviceId: getSelectedService()?.id || getSelectedService()?.service_id || form?.elements.specialization?.value,
      date: form?.elements.date?.value,
      cabinetId: getSelectedCabinet()?.id || getSelectedCabinet()?.cabinet_id || form?.elements.cabinet?.value,
    });
    if (!localAvailability.slots.includes(formatTime(form?.elements.time?.value))) {
      lastAppointmentSubmitError = localAvailability.reason === "Lekarz jest nieobecny w wybranym terminie."
        ? "Lekarz jest nieobecny w wybranym terminie."
        : "Wybrany termin jest niedostępny. Wybierz inną godzinę.";
      setStatus(elements.appointmentStatus, lastAppointmentSubmitError);
      debugAppointmentFlow("submit:no-payload-unavailable", {
        error: lastAppointmentSubmitError,
        localAvailability,
      });
      renderAvailableTimeButtons();
      return;
    }
    lastAppointmentSubmitError = "Nie udało się zapisać wizyty na serwerze. Spróbuj ponownie.";
    setStatus(elements.appointmentStatus, lastAppointmentSubmitError);
    debugAppointmentFlow("submit:no-payload", { error: lastAppointmentSubmitError, localAvailability });
    return;
  }

  const patientConflict = getAppointmentPayloadPatientConflict(backendPayload);
  if (patientConflict) {
    lastAppointmentSubmitError = "Pacjent ma już wizytę w wybranym terminie.";
    setStatus(elements.appointmentStatus, lastAppointmentSubmitError);
    debugAppointmentFlow("submit:patient-conflict", {
      error: lastAppointmentSubmitError,
      backendPayload,
      conflict: {
        id: patientConflict.id || patientConflict.appointment_id,
        date: patientConflict.date || patientConflict.appointment_date,
        start: patientConflict.start_time || patientConflict.time,
        end: patientConflict.end_time || patientConflict.endTime,
      },
    });
    renderRecentPatients(elements.appointmentForm?.elements.patientSearch?.value || "");
    return;
  }

  const availability = availableStartTimes({
    doctorId: backendPayload.doctor_id || getSelectedDoctor()?.id || getSelectedDoctor()?.doctor_id,
    serviceId: backendPayload.service_id,
    date: backendPayload.appointment_date,
    cabinetId: backendPayload.cabinet_id,
  });
  if (!availability.slots.includes(formatTime(backendPayload.start_time))) {
    lastAppointmentSubmitError = availability.reason === "Lekarz jest nieobecny w wybranym terminie."
      ? "Lekarz jest nieobecny w wybranym terminie."
      : "Wybrany termin jest niedostępny. Wybierz inną godzinę.";
    console.warn("[appointment-debug] availability rejected", {
      error: lastAppointmentSubmitError,
      availability,
      backendPayload,
      doctor: selectedDoctor ? {
        id: selectedDoctor.id,
        doctor_id: selectedDoctor.doctor_id,
        name: doctorFullName(selectedDoctor),
        specialization: selectedDoctor.specialization,
      } : null,
      service: selectedService ? {
        id: selectedService.id,
        service_id: selectedService.service_id,
        name: serviceName(selectedService),
        specialization: selectedService.specialization,
        effectiveSpecialization: getAppointmentServiceSpecialization(selectedService, selectedDoctor),
      } : null,
      cabinet: getSelectedCabinet(),
      compatibleCabinets: getAppointmentCompatibleCabinets(selectedDoctor, selectedService).map((cabinet) => ({
        id: cabinet.id,
        cabinet_id: cabinet.cabinet_id,
        name: cabinet.name,
        type: cabinet.type || cabinet.cabinet_type,
      })),
    });
    setStatus(elements.appointmentStatus, lastAppointmentSubmitError);
    debugAppointmentFlow("submit:availability-rejected", {
      error: lastAppointmentSubmitError,
      availability,
      backendPayload,
    });
    renderAvailableTimeButtons();
    return;
  }

  try {
    const response = await apiRequest("backend/api/appointments.php", {
      method: "POST",
      body: backendPayload,
    });
    const backendPatient = normalizePatient({
      id: response.data?.patient_id || backendPayload.patient_id,
      firstName: backendPayload.first_name,
      lastName: backendPayload.last_name,
      phone: backendPayload.phone,
      createdAt: new Date().toISOString(),
    });

    if (backendPatient && !patients.some((patient) => patient.id === backendPatient.id)) {
      patients.push(backendPatient);
      saveCollection(storageKeys.patients, patients);
    }

    const created = extractCreatedAppointment(response);
    const appointment = upsertAppointment(normalizeAppointment(created) || buildAppointmentFromForm({
      ...backendPayload,
      id: created?.id || created?.appointment_id || response.data?.id,
      appointment_id: created?.appointment_id || created?.id || response.data?.id,
      patient_id: created?.patient_id || response.data?.patient_id || backendPayload.patient_id,
    }));

    if (!appointment) {
      setStatus(elements.appointmentStatus, "Backend zapisał wizytę, ale nie udało się odświeżyć kalendarza.");
      return;
    }

    saveCollection(storageKeys.appointments, appointments);
    setStatus(elements.formStatus, response.message || `Wizyta dla ${appointment.patient} zapisana w bazie danych.`);
    closeModal(elements.appointmentModal);
    refreshAfterAppointmentChange();
    if (showSuccess) showAppointmentSuccessModal(appointment);
  } catch (error) {
    const isConflict = error?.status === 409;
    const conflictMessage = "Ten termin jest już zajęty. Wybierz inny termin.";
    lastAppointmentSubmitError = isConflict ? (error?.payload?.error || error?.payload?.message || conflictMessage) : "Nie udało się zapisać wizyty na serwerze. Spróbuj ponownie.";
    debugAppointmentFlow("submit:backend-error", {
      status: error?.status,
      message: error?.message,
      payload: error?.payload,
      error: lastAppointmentSubmitError,
    });
    setStatus(
      elements.appointmentStatus,
      lastAppointmentSubmitError
    );
    if (isConflict) {
      renderAvailableTimeButtons();
      return;
    }
    console.warn("[MediPlus] Appointment create failed without local fallback:", error?.message || error);
  }
}

function openDetailsModal(appointmentId, monday) {
  const appointment = appointments.find((item) => String(item.id) === String(appointmentId) || String(item.appointment_id) === String(appointmentId));

  if (!appointment || !elements.appointmentDetails) {
    return;
  }

  const modal = elements.detailsModal?.querySelector(".modal");
  const heading = elements.detailsModal?.querySelector(".modal-heading");
  modal?.classList.remove("compact-modal");
  modal?.classList.add("visit-details-modal");
  heading?.classList.add("visit-details-heading");

  const start = appointmentStartDateTime(appointment) || combineLocalDateTime(getAppointmentDate(appointment, monday), appointment.time || appointment.start_time);
  const end = appointmentEndDateTime(appointment);
  const patient = findPatientForAppointment(appointment) || findPatientById(appointment.patient_id || appointment.patientId);
  const doctor = findDoctorByAppointment(appointment) || findDoctorByIdOrValue(appointment.doctor_id || appointment.doctorId || appointment.doctor);
  const service = findServiceByIdOrValue(appointment.service_id || appointment.serviceId || appointment.serviceName || appointment.service_name || appointment.service || appointment.specialization);
  const cabinet = findCabinetByBackendId(appointment.cabinet_id || appointment.cabinetId)
    || findCabinetByIdOrValue(appointment.cabinet || appointment.cabinet_name);
  const serviceLabel = serviceName(service) || appointment.serviceName || appointment.service_name || appointment.service || appointment.specialization || "Brak usługi";
  const duration = Number(appointment.duration || appointment.durationMinutes || service?.durationMinutes || service?.duration || 0);
  const cabinetLabel = cabinet?.name || appointment.cabinet || appointment.cabinet_name || "Brak gabinetu";
  const doctorSpecialization = doctor?.specialization || appointment.doctorSpecialization || appointment.specialization || service?.specialization || "Brak specjalizacji";
  const patientName = patientFullName(patient) || appointment.patient || appointment.patient_name || "Brak pacjenta";
  const doctorName = doctorFullName(doctor) || appointment.doctor || appointment.doctor_name || "Brak lekarza";
  const notes = appointment.notes || appointment.note || appointment.description || "";

  elements.appointmentDetails.className = "visit-details-body";
  elements.appointmentDetails.innerHTML = `
    <section class="visit-detail-card">
      <h3>Pacjent</h3>
      <div class="visit-detail-person">
        ${renderPatientInitials(patientName)}
        <div>
          <strong>${escapeHtml(patientName)}</strong>
          <span>${escapeHtml(patient?.phone || appointment.phone || "Brak telefonu")}</span>
        </div>
      </div>
      <div class="visit-detail-grid">
        <div class="visit-detail-row"><span>PESEL</span><strong>${escapeHtml(patient?.pesel || appointment.pesel || "Brak danych")}</strong></div>
        <div class="visit-detail-row"><span>E-mail</span><strong>${escapeHtml(patient?.email || appointment.email || "Brak danych")}</strong></div>
      </div>
    </section>
    <section class="visit-detail-card">
      <h3>Lekarz</h3>
      <div class="visit-detail-person">
        ${doctor ? renderDoctorAvatar(doctor, { size: 42 }) : renderPatientInitials(doctorName)}
        <div>
          <strong>${escapeHtml(doctorName)}</strong>
          <span>${escapeHtml(doctorSpecialization)}</span>
        </div>
      </div>
      <div class="visit-detail-grid">
        <div class="visit-detail-row"><span>Gabinet</span><strong>${escapeHtml(cabinetLabel)}</strong></div>
        <div class="visit-detail-row"><span>Status</span><strong>${appointmentStatusBadge(appointment)}</strong></div>
      </div>
    </section>
    <section class="visit-detail-card span-2">
      <h3>Termin i usługa</h3>
      <div class="visit-detail-grid">
        <div class="visit-detail-row"><span>Data</span><strong>${escapeHtml(start ? formatFullDate(start) : "Brak daty")}</strong></div>
        <div class="visit-detail-row"><span>Godziny</span><strong>${escapeHtml(start ? formatTime(start) : "—")}${end ? `–${escapeHtml(formatTime(end))}` : ""}</strong></div>
        <div class="visit-detail-row"><span>Usługa</span><strong>${escapeHtml(serviceLabel)}</strong></div>
        <div class="visit-detail-row"><span>Czas trwania</span><strong>${escapeHtml(duration ? `${duration} min` : end && start ? `${Math.round((end - start) / 60000)} min` : "Brak danych")}</strong></div>
      </div>
    </section>
    <section class="visit-detail-card span-2">
      <h3>Informacje dodatkowe</h3>
      <div class="visit-notes-grid">
        <div>
          <span>Notatka</span>
          <p>${escapeHtml(notes || "Brak notatki.")}</p>
        </div>
        <div>
          <span>Identyfikator wizyty</span>
          <p>${escapeHtml(appointment.id || appointment.appointment_id || "Brak danych")}</p>
        </div>
      </div>
    </section>
  `;
  const actions = elements.detailsModal?.querySelector(".modal-actions");
  if (actions) {
    actions.classList.add("visit-details-footer");
    const appointmentKey = escapeHtml(appointment.id || appointment.appointment_id || "");
    actions.innerHTML = `
      ${canCancelAppointment(appointment) && canCreateAppointments() ? `<button class="secondary-button danger-soft" type="button" data-details-cancel="${appointmentKey}">Anuluj wizytę</button>` : ""}
      <button class="primary-button" type="button" data-close-modal>Zamknij</button>
    `;
    actions.querySelector("[data-details-cancel]")?.addEventListener("click", () => cancelAppointment(appointmentKey));
    actions.querySelector("[data-close-modal]")?.addEventListener("click", () => closeModal(elements.detailsModal));
  }
  openModal(elements.detailsModal);
}

// ==============================
// Filters
// ==============================
function setActiveView(selectedButton) {
  elements.viewButtons.forEach((button) => {
    button.classList.toggle("active", button === selectedButton);
  });
}

function bindFilterEvents() {
  elements.availableOnly?.addEventListener("change", () => {
    syncCalendarFiltersFromDom();
    renderCalendar();
  });
}

// ==============================
// Events
// ==============================
function bindEvents() {
  bindPolishPhoneInputs(document);
  bindGlobalTopbarSearch();
  bindNotificationBell();
  const sidebarToggle = getSidebarToggle();
  console.info("[sidebar] toggle bound", Boolean(sidebarToggle));
  sidebarToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    toggleSidebarCollapsed();
  });

  elements.todayButton?.addEventListener("click", () => {
    selectedDate = localToday();
    weekOffset = 0;
    renderCalendar();
  });

  elements.prevWeekButton?.addEventListener("click", () => {
    const date = parseLocalDate(selectedDate);
    if (calendarViewMode === "month") {
      selectedDate = dateToIso(new Date(date.getFullYear(), date.getMonth() - 1, Math.min(date.getDate(), 28)));
    } else {
      selectedDate = dateToIso(addDays(date, calendarViewMode === "week" ? -7 : -1));
    }
    weekOffset = getWeekOffsetForDate(parseLocalDate(selectedDate));
    renderCalendar();
  });

  elements.nextWeekButton?.addEventListener("click", () => {
    const date = parseLocalDate(selectedDate);
    if (calendarViewMode === "month") {
      selectedDate = dateToIso(new Date(date.getFullYear(), date.getMonth() + 1, Math.min(date.getDate(), 28)));
    } else {
      selectedDate = dateToIso(addDays(date, calendarViewMode === "week" ? 7 : 1));
    }
    weekOffset = getWeekOffsetForDate(parseLocalDate(selectedDate));
    renderCalendar();
  });

  elements.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      calendarViewMode = button.dataset.viewMode || "day";
      setActiveView(button);
      renderCalendar();
    });
  });

  elements.newAppointmentButton?.addEventListener("click", openAppointmentModal);
  document.querySelector("#useNewPatientButton")?.addEventListener("click", createMinimalPatientFromAppointmentForm);

  elements.appointmentForm?.elements.doctor?.addEventListener("change", () => {
    refreshAppointmentServiceOptionsForDoctor({ preserveSelected: true });
    syncAppointmentCabinetFromDoctor();
    debugAppointmentFlow("doctor changed");
    renderAvailableTimeButtons();
  });

  elements.appointmentForm?.elements.specialization?.addEventListener("change", () => {
    refreshAppointmentDoctorOptionsForService({ preserveSelected: true });
    syncAppointmentCabinetFromDoctor();
    debugAppointmentFlow("service changed");
    renderAvailableTimeButtons();
  });

  ["date", "cabinet"].forEach((name) => {
    elements.appointmentForm?.elements[name]?.addEventListener("change", () => {
      debugAppointmentFlow(`${name} changed`);
      renderAvailableTimeButtons();
    });
  });

  elements.appointmentForm?.elements.patientSearch?.addEventListener("input", (event) => {
    renderRecentPatients(event.target.value);
  });

  document.addEventListener("click", (event) => {
    const slot = event.target.closest?.("[data-dashboard-slot]");
    if (!slot || !canCreateAppointments()) return;
    openAppointmentModal({
      doctorId: slot.dataset.dashboardDoctor,
      date: today(),
      startTime: slot.dataset.dashboardSlot,
    });
  });

  elements.closeModalButtons.forEach((button) => {
    button.addEventListener("click", closeAllModals);
  });

  [elements.appointmentModal, elements.detailsModal].forEach((modal) => {
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
    }
  });

  elements.patientForm?.addEventListener("input", (event) => {
    if (event.target.matches("input, select, textarea")) {
      clearFieldErrors(elements.patientForm);
    }
  });

  elements.patientForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!validatePatientForm()) {
      setStatus(elements.formStatus, "Popraw błędy w formularzu.");
      return;
    }

    await submitPatientRegistration();
  });

  elements.appointmentForm?.addEventListener("submit", async (event) => {
    await submitAppointmentRegistration(event);
  });

  bindFilterEvents();
}

restoreSidebarCollapsedState();
bindAuthEvents();
restoreAuthSession();









