import { useEffect, useMemo, useRef, useState } from "react";
import { BabyFeet, CalendarDays, Heart, Leaf, MoonStar, Plus, RefreshCw, Sparkles } from "./components/Icons.jsx";
import { addEvents, createBabyProfile, fetchBabyProfile, fetchEvents, fetchHealth } from "./services/babyLogApi.js";
import "./styles/app.css";

const ONBOARDING_STEPS = {
  CREATE_BABY: 1,
  ADD_EVENTS: 2
};

const EVENT_PRESETS = [
  { label: "Crying", text: "Crying episode" },
  { label: "Poop", text: "Poop diaper" },
  { label: "Pee", text: "Wet diaper" },
  { label: "Feeding", text: "Feeding" },
  { label: "Nap", text: "Nap started" },
  { label: "Medicine", text: "Medicine given" },
  { label: "Tummy Time", text: "Tummy time" },
  { label: "Bath", text: "Bath time" }
];

const EVENT_MOOD_OPTIONS = ["content", "calm", "sleepy", "playful"];
const BABY_THEMES = [
  { id: "blue", label: "Blue" },
  { id: "pink", label: "Pink" },
  { id: "green", label: "Green" },
  { id: "offwhite", label: "Off White" }
];
const MOTIVATIONAL_QUOTES = [
  "You are doing better than you think, one little moment at a time.",
  "Tiny steps count. Every log is care in action.",
  "Progress is not loud. It is diapers, feeds, and quiet consistency.",
  "Your presence is the routine your baby remembers most."
];

const moodMap = {
  content: "Soft and satisfied",
  calm: "Quiet and calm",
  sleepy: "Sleepy eyes",
  playful: "Playful mood"
};

const iconMap = {
  heart: Heart,
  leaf: Leaf,
  moon: MoonStar,
  sparkles: Sparkles
};

const STORAGE_KEY = "baby-log-profiles";
const AUTH_STORAGE_KEY = "baby-log-auth";

function loadProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProfiles(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function loadAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.isLoggedIn ? parsed : null;
  } catch {
    return null;
  }
}

function saveAuthSession(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function getCurrentTimeInputValue() {
  const now = new Date();
  const hours = `${now.getHours()}`.padStart(2, "0");
  const minutes = `${now.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function mapEventsToEntries(events, babyId, eventPhotosByNote = {}) {
  if (!Array.isArray(events)) return [];
  return events.map((event, index) => ({
    id: `${babyId}-${index}`,
    type: "Event",
    time: "--",
    notes: event,
    mood: "content",
    icon: "sparkles",
    photo: eventPhotosByNote[event]?.url || "",
    photoName: eventPhotosByNote[event]?.name || ""
  }));
}

function formatDuration(totalMs) {
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => `${value}`.padStart(2, "0")).join(":");
}

function classifyEventType(note) {
  const text = `${note || ""}`.toLowerCase();
  if (text.includes("feed")) return "Feeding";
  if (text.includes("diaper") || text.includes("poop") || text.includes("pee") || text.includes("wet")) return "Diaper";
  if (text.includes("nap") || text.includes("sleep")) return "Sleep";
  if (text.includes("cry")) return "Crying";
  if (text.includes("medicine") || text.includes("bath") || text.includes("tummy")) return "Care";
  return "Other";
}

export default function App() {
  const today = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }, []);
  const [entries, setEntries] = useState([]);
  const [statusNote, setStatusNote] = useState("Offline mode");
  const [profiles, setProfiles] = useState([]);
  const [selectedBabyId, setSelectedBabyId] = useState("");
  const [onboardingStep, setOnboardingStep] = useState(ONBOARDING_STEPS.CREATE_BABY);
  const [showFamilyAdmin, setShowFamilyAdmin] = useState(false);
  const [showFamilyTip, setShowFamilyTip] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("blue");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(true);
  const [loginStatus, setLoginStatus] = useState("");
  const [familyAdminKidId, setFamilyAdminKidId] = useState("");
  const [babyName, setBabyName] = useState("");
  const [babyBirthDate, setBabyBirthDate] = useState("");
  const [eventInput, setEventInput] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [eventMood, setEventMood] = useState("content");
  const [eventTime, setEventTime] = useState(() => getCurrentTimeInputValue());
  const [eventPhotoDataUrl, setEventPhotoDataUrl] = useState("");
  const [eventPhotoName, setEventPhotoName] = useState("");
  const [eventPhotosByNote, setEventPhotosByNote] = useState({});
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerElapsedMs, setTimerElapsedMs] = useState(0);
  const [apiStatus, setApiStatus] = useState("");
  const [healthStatus, setHealthStatus] = useState("");
  const [familyMetrics, setFamilyMetrics] = useState({
    totalEvents: 0,
    perChild: [],
    topEventType: "None",
    topEventCount: 0,
    inactiveChildren: []
  });
  const [familyMetricsLoading, setFamilyMetricsLoading] = useState(false);
  const [familyMetricsStatus, setFamilyMetricsStatus] = useState("");
  const timerStartRef = useRef(0);
  const timerBaseMsRef = useRef(0);
  const dailyQuote = useMemo(() => {
    const idx = new Date().getDate() % MOTIVATIONAL_QUOTES.length;
    return MOTIVATIONAL_QUOTES[idx];
  }, []);
  const timerText = useMemo(() => formatDuration(timerElapsedMs), [timerElapsedMs]);

  useEffect(() => {
    const stored = loadProfiles();
    const auth = loadAuthSession();
    if (auth?.isLoggedIn) {
      setIsLoggedIn(true);
      setShowFamilyAdmin(true);
    }
    if (stored.length) {
      setProfiles(stored);
      setSelectedBabyId(stored[0].id);
      setSelectedTheme(stored[0].theme || "blue");
      setOnboardingStep(auth?.isLoggedIn ? ONBOARDING_STEPS.CREATE_BABY : ONBOARDING_STEPS.ADD_EVENTS);
      setFamilyAdminKidId(stored[0].id);
    }
  }, []);

  useEffect(() => {
    if (!profiles.length) {
      setEntries([]);
      return;
    }
    saveProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    if (!isLoggedIn || !selectedBabyId) return;

    let isMounted = true;
    Promise.all([fetchBabyProfile(selectedBabyId), fetchEvents(selectedBabyId)])
      .then((results) => {
        if (!isMounted) return;
        const [profile, events] = results;
        setProfiles((prev) =>
          prev.map((item) =>
            item.id === selectedBabyId && profile?.name
              ? { ...item, name: profile.name }
              : item
          )
        );
        setEntries(mapEventsToEntries(events, selectedBabyId, eventPhotosByNote));
        setStatusNote("Synced from API");
        setApiStatus("");
      })
      .catch(() => {
        if (!isMounted) return;
        setEntries([]);
        setApiStatus("Could not sync. Check baby ID.");
        setStatusNote("Offline mode");
      });

    return () => {
      isMounted = false;
    };
  }, [eventPhotosByNote, isLoggedIn, selectedBabyId]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const intervalId = window.setInterval(() => {
      setTimerElapsedMs(timerBaseMsRef.current + (Date.now() - timerStartRef.current));
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [isTimerRunning]);

  async function handleCreateProfile(event) {
    event.preventDefault();
    if (!babyName.trim()) {
      setApiStatus("Add a baby name to create a profile.");
      return;
    }
    if (!babyBirthDate) {
      setApiStatus("Add a birth date to create a profile.");
      return;
    }
    try {
      const payload = {
        name: babyName.trim(),
        birthDate: babyBirthDate
      };
      const saved = await createBabyProfile(payload);
      const id = saved?.id || saved?._id;
      if (!id) {
        setApiStatus("Profile created. Copy the ID from the response.");
        return;
      }
      const nextProfile = { id, name: babyName.trim(), theme: selectedTheme };
      setProfiles((prev) => [nextProfile, ...prev.filter((item) => item.id !== id)]);
      setSelectedBabyId(id);
      setOnboardingStep(ONBOARDING_STEPS.ADD_EVENTS);
      setShowFamilyAdmin(false);
      setBabyName("");
      setBabyBirthDate("");
      setApiStatus("Profile created.");
    } catch (error) {
      setApiStatus("Could not create profile.");
    }
  }

  async function handleAddEvent(event) {
    event.preventDefault();
    if (!selectedBabyId) {
      setApiStatus("Enter a baby ID to add events.");
      return;
    }
    const customNote = eventInput.trim();
    const selectedLabel = selectedPreset;
    const timePart = eventTime ? `@ ${eventTime}` : "";
    const moodPart = eventMood ? `Mood: ${eventMood}` : "";
    const baseParts = [selectedLabel ? `[${selectedLabel}]` : "", customNote, timePart, moodPart].filter(Boolean);

    if (!baseParts.length) {
      setApiStatus("Pick an autofill option or write a short event note first.");
      return;
    }
    const photoPart = eventPhotoName ? `Photo: ${eventPhotoName}` : "";
    const finalEventText = [...baseParts, photoPart].filter(Boolean).join(" • ");
    const nextPhotosByNote =
      eventPhotoDataUrl && eventPhotoName
        ? {
            ...eventPhotosByNote,
            [finalEventText]: {
              url: eventPhotoDataUrl,
              name: eventPhotoName
            }
          }
        : eventPhotosByNote;
    try {
      await addEvents(selectedBabyId, [finalEventText]);
      setEventInput("");
      setSelectedPreset("");
      setEventMood("content");
      setEventTime(getCurrentTimeInputValue());
      setEventPhotoDataUrl("");
      setEventPhotoName("");
      setEventPhotosByNote(nextPhotosByNote);
      const updated = await fetchEvents(selectedBabyId);
      setEntries(mapEventsToEntries(updated, selectedBabyId, nextPhotosByNote));
      setApiStatus("Event added.");
      setStatusNote("Synced from API");
    } catch (error) {
      setApiStatus("Could not add event.");
    }
  }

  function handlePresetSelect(preset) {
    if (selectedPreset === preset.label) {
      setSelectedPreset("");
      setEventInput("");
      return;
    }
    setSelectedPreset(preset.label);
    setEventInput(preset.text);
  }

  function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setEventPhotoDataUrl("");
      setEventPhotoName("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEventPhotoDataUrl(typeof reader.result === "string" ? reader.result : "");
      setEventPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function handleTestHealth() {
    setHealthStatus("Checking...");
    try {
      await fetchHealth();
      setHealthStatus("API healthy");
    } catch (error) {
      setHealthStatus("Health check failed");
    }
  }

  async function handleRefreshTimeline() {
    if (!selectedBabyId) {
      setApiStatus("Select a profile first.");
      return;
    }
    try {
      const updated = await fetchEvents(selectedBabyId);
      setEntries(mapEventsToEntries(updated, selectedBabyId, eventPhotosByNote));
      setStatusNote("Synced from API");
      setApiStatus("Timeline refreshed.");
    } catch (error) {
      setApiStatus("Could not refresh timeline.");
      setStatusNote("Offline mode");
    }
  }

  async function loadFamilyMetrics() {
    if (!profiles.length) {
      setFamilyMetrics({
        totalEvents: 0,
        perChild: [],
        topEventType: "None",
        topEventCount: 0,
        inactiveChildren: []
      });
      setFamilyMetricsStatus("");
      return;
    }

    setFamilyMetricsLoading(true);
    setFamilyMetricsStatus("");
    try {
      const results = await Promise.allSettled(
        profiles.map(async (profile) => {
          const events = await fetchEvents(profile.id);
          return {
            id: profile.id,
            name: profile.name,
            events: Array.isArray(events) ? events : []
          };
        })
      );

      const perChild = [];
      const typeCounts = {};
      let totalEvents = 0;

      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        const { id, name, events } = result.value;
        perChild.push({ id, name, count: events.length });
        totalEvents += events.length;
        events.forEach((eventNote) => {
          const eventType = classifyEventType(eventNote);
          typeCounts[eventType] = (typeCounts[eventType] || 0) + 1;
        });
      });

      const topEntry = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
      const inactiveChildren = perChild.filter((child) => child.count === 0).map((child) => child.name);

      setFamilyMetrics({
        totalEvents,
        perChild,
        topEventType: topEntry?.[0] || "None",
        topEventCount: topEntry?.[1] || 0,
        inactiveChildren
      });
      setFamilyMetricsStatus("Metrics synced.");
    } catch (error) {
      setFamilyMetricsStatus("Could not load family metrics.");
    } finally {
      setFamilyMetricsLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn || !showFamilyAdmin) return;
    loadFamilyMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, showFamilyAdmin, profiles]);

  function handleStartAddBaby() {
    setOnboardingStep(ONBOARDING_STEPS.CREATE_BABY);
    setShowFamilyAdmin(false);
    setBabyName("");
    setBabyBirthDate("");
    setApiStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleStartTimer() {
    if (isTimerRunning) return;
    timerStartRef.current = Date.now();
    setIsTimerRunning(true);
  }

  function handlePauseTimer() {
    if (!isTimerRunning) return;
    const elapsed = timerBaseMsRef.current + (Date.now() - timerStartRef.current);
    timerBaseMsRef.current = elapsed;
    setTimerElapsedMs(elapsed);
    setIsTimerRunning(false);
  }

  function handleResetTimer() {
    timerStartRef.current = 0;
    timerBaseMsRef.current = 0;
    setTimerElapsedMs(0);
    setIsTimerRunning(false);
  }

  function handleUseTimerInEvent() {
    if (!timerElapsedMs) {
      setApiStatus("Start the stopwatch first to capture a duration.");
      return;
    }
    const timerNote = `Session duration ${formatDuration(timerElapsedMs)}`;
    setEventInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return timerNote;
      if (trimmed.includes(timerNote)) return prev;
      return `${trimmed}. ${timerNote}`;
    });
    setApiStatus("Duration added to event note.");
  }

  function handleSelectBaby(babyId) {
    setSelectedBabyId(babyId);
    if (!babyId) {
      setSelectedTheme("blue");
      return;
    }
    const profile = profiles.find((item) => item.id === babyId);
    setSelectedTheme(profile?.theme || "blue");
  }

  function handleOpenFamilyAdmin() {
    setOnboardingStep(ONBOARDING_STEPS.CREATE_BABY);
    setShowFamilyAdmin(true);
    setFamilyAdminKidId(selectedBabyId || profiles[0]?.id || "");
    setApiStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleChooseExistingKid(babyId) {
    handleSelectBaby(babyId);
    setOnboardingStep(ONBOARDING_STEPS.ADD_EVENTS);
    setShowFamilyAdmin(false);
    setApiStatus("");
  }

  function handleLogin(event) {
    event.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginStatus("Enter email and password.");
      return;
    }
    setIsLoggedIn(true);
    setOnboardingStep(ONBOARDING_STEPS.CREATE_BABY);
    setShowFamilyAdmin(true);
    setFamilyAdminKidId(selectedBabyId || profiles[0]?.id || "");
    setLoginStatus("");
    if (rememberLogin) {
      saveAuthSession({ isLoggedIn: true, email: loginEmail.trim() });
    } else {
      clearAuthSession();
    }
  }

  function handleLogout() {
    setIsLoggedIn(false);
    setShowFamilyAdmin(false);
    setLoginPassword("");
    setLoginStatus("");
    clearAuthSession();
  }

  const hasProfiles = profiles.length > 0;
  const isCreateBabyStep = onboardingStep === ONBOARDING_STEPS.CREATE_BABY;
  const selectedBabyName = profiles.find((item) => item.id === selectedBabyId)?.name || "No baby selected";
  const analytics = useMemo(() => {
    const buckets = [
      { key: "feeding", label: "Feeding", color: "var(--accent-primary)" },
      { key: "diaper", label: "Diaper", color: "var(--accent-primary-strong)" },
      { key: "sleep", label: "Sleep", color: "rgba(var(--theme-rgb), 0.58)" },
      { key: "comfort", label: "Comfort", color: "rgba(var(--theme-strong-rgb), 0.5)" },
      { key: "other", label: "Other", color: "rgba(148, 163, 184, 0.52)" }
    ];
    const counts = buckets.reduce((acc, bucket) => ({ ...acc, [bucket.key]: 0 }), {});

    entries.forEach((entry) => {
      const text = `${entry.notes || ""}`.toLowerCase();
      if (text.includes("feed")) {
        counts.feeding += 1;
        return;
      }
      if (text.includes("diaper") || text.includes("poop") || text.includes("pee") || text.includes("wet")) {
        counts.diaper += 1;
        return;
      }
      if (text.includes("nap") || text.includes("sleep")) {
        counts.sleep += 1;
        return;
      }
      if (text.includes("cry") || text.includes("medicine") || text.includes("bath") || text.includes("tummy")) {
        counts.comfort += 1;
        return;
      }
      counts.other += 1;
    });

    const segments = buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      color: bucket.color,
      value: counts[bucket.key]
    }));
    const total = segments.reduce((sum, item) => sum + item.value, 0);
    const maxValue = Math.max(...segments.map((item) => item.value), 1);
    let progress = 0;
    const gradientStops = segments
      .filter((item) => item.value > 0)
      .map((item) => {
        const start = (progress / total) * 100;
        progress += item.value;
        const end = (progress / total) * 100;
        return `${item.color} ${start}% ${end}%`;
      });

    return {
      total,
      maxValue,
      segments,
      donutBackground: gradientStops.length
        ? `conic-gradient(${gradientStops.join(", ")})`
        : "conic-gradient(rgba(148, 163, 184, 0.24) 0% 100%)"
    };
  }, [entries]);

  if (!isLoggedIn) {
    return (
      <div className={`app theme-${selectedTheme}`}>
        <div className="paper modern login-shell">
          <section className="login-card">
            <div className="brand">
              <div className="brand-icon" aria-hidden="true">
                <BabyFeet />
              </div>
              <p className="eyebrow">Baby Log</p>
              <h2>Welcome back</h2>
              <p className="login-subtitle">Sign in to manage your family and daily logistics.</p>
            </div>
            <form className="note-form" onSubmit={handleLogin}>
              <label>
                Email
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="parent@example.com"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </label>
              <label className="login-check">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(event) => setRememberLogin(event.target.checked)}
                />
                Keep me signed in on this device
              </label>
              <button className="primary" type="submit">
                Log in
              </button>
              {loginStatus ? <p className="status-note">{loginStatus}</p> : null}
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={`app theme-${selectedTheme}`}>
      <div className="paper modern">
        <header className="topbar modern">
          <div className="brand">
            <button
              className="brand-icon brand-home-btn"
              type="button"
              aria-label="Open Family Admin"
              onClick={handleOpenFamilyAdmin}
            >
              <BabyFeet />
            </button>
          </div>
          <div className="topbar-tools">
            {hasProfiles && !showFamilyAdmin ? (
              <label className="global-baby-switch">
                <span>Profile</span>
                <select
                  value={selectedBabyId}
                  onChange={(event) => handleSelectBaby(event.target.value)}
                >
                  <option value="">Select baby</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button className="ghost" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <div className={`layout ${isCreateBabyStep ? "single-panel" : ""}`}>
          {!isCreateBabyStep ? (
            <aside className="sidepanel">
              <div className="side-card highlight">
                <p className="summary-title">Selected Baby</p>
                <p className="summary-value summary-value-baby">{selectedBabyName}</p>
                <p className="summary-note">{statusNote}</p>
              </div>
              <section className="stopwatch-card side-stopwatch" aria-live="polite">
                <div className="stopwatch-head">
                  <p className="summary-title">Session Stopwatch</p>
                  <span className={`stopwatch-status ${isTimerRunning ? "running" : ""}`}>
                    {isTimerRunning ? "Running" : "Paused"}
                  </span>
                </div>
                <p className="stopwatch-time">{timerText}</p>
                <div className="stopwatch-actions">
                  <button className="timer-btn timer-btn-primary" type="button" onClick={handleStartTimer}>
                    {isTimerRunning ? "Running" : timerElapsedMs ? "Resume" : "Start"}
                  </button>
                  <button className="timer-btn" type="button" onClick={handlePauseTimer}>
                    Pause
                  </button>
                  <button className="timer-btn" type="button" onClick={handleResetTimer}>
                    Reset
                  </button>
                  <button className="timer-btn timer-btn-outline" type="button" onClick={handleUseTimerInEvent}>
                    Use in event
                  </button>
                </div>
              </section>
              <div className="side-card">
                <p className="summary-title">API Health</p>
                <button className="ghost" type="button" onClick={handleTestHealth}>
                  Test API
                </button>
                {healthStatus ? <p className="status-note">{healthStatus}</p> : null}
              </div>
              <div className="side-card">
                <p className="summary-title">Next Feeding</p>
                <p className="summary-value">3:10 PM</p>
                <p className="summary-note">Based on last 2h 50m rhythm</p>
              </div>
              <div className="side-card">
                <p className="summary-title">Sleep Total</p>
                <p className="summary-value">1h 40m</p>
                <p className="summary-note">Two short naps</p>
              </div>
              <div className="side-card quiet">
                <h3>Sweet Reminders</h3>
                <p>Hydrate, breathe, and celebrate every tiny win.</p>
                <button className="ghost">View weekly summary</button>
              </div>
              <div className="side-card">
                <p className="summary-title">Daily encouragement</p>
                <p className="motivation-quote">{dailyQuote}</p>
              </div>
            </aside>
          ) : null}

          <main className="mainpanel">
            {isCreateBabyStep ? (
              <section className="quick-log modern onboarding onboarding-screen">
                {showFamilyAdmin ? (
                  <>
                    <div className="section-head">
                      <div
                        className={`title-with-tip ${showFamilyTip ? "open" : ""}`}
                        onMouseEnter={() => setShowFamilyTip(true)}
                        onMouseLeave={() => setShowFamilyTip(false)}
                      >
                        <h2>Family Admin</h2>
                        <button
                          type="button"
                          className="tip-button"
                          aria-label="How Family Admin works"
                          aria-expanded={showFamilyTip}
                          aria-controls="family-admin-tip"
                          onClick={() => setShowFamilyTip((prev) => !prev)}
                          onFocus={() => setShowFamilyTip(true)}
                          onBlur={() => setShowFamilyTip(false)}
                        >
                          ?
                        </button>
                        <span id="family-admin-tip" role="tooltip" className="tip-popover">
                          Select a kid, then open their logistics page.
                        </span>
                      </div>
                    </div>
                    {profiles.length ? (
                      <div className="kid-admin-panel">
                        <label>
                          Kid profile
                          <select
                            value={familyAdminKidId}
                            onChange={(event) => setFamilyAdminKidId(event.target.value)}
                          >
                            <option value="">Choose kid</option>
                            {profiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name} ({profile.id.slice(0, 6)})
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="primary"
                          type="button"
                          disabled={!familyAdminKidId}
                          onClick={() => handleChooseExistingKid(familyAdminKidId)}
                        >
                          Open kid logistics
                        </button>
                      </div>
                    ) : (
                      <p className="status-note">No existing kids yet. Create your first baby profile.</p>
                    )}
                    <section className="family-metrics-card">
                      <div className="section-head">
                        <h3>Overall Family Metrics</h3>
                        <button className="ghost" type="button" onClick={loadFamilyMetrics} disabled={familyMetricsLoading}>
                          {familyMetricsLoading ? "Refreshing..." : "Refresh"}
                        </button>
                      </div>
                      <div className="family-metrics-grid">
                        <article className="family-metric">
                          <p className="summary-title">Total Events</p>
                          <p className="summary-value">{familyMetrics.totalEvents}</p>
                        </article>
                        <article className="family-metric">
                          <p className="summary-title">Top Event Type</p>
                          <p className="summary-value">{familyMetrics.topEventType}</p>
                          <p className="summary-note">{familyMetrics.topEventCount} logged</p>
                        </article>
                      </div>
                      <div className="family-bars">
                        <p className="summary-title">Events by Child</p>
                        {familyMetrics.perChild.length ? (
                          familyMetrics.perChild.map((child) => {
                            const maxCount = Math.max(...familyMetrics.perChild.map((item) => item.count), 1);
                            return (
                              <div key={child.id} className="family-bar-row">
                                <span>{child.name}</span>
                                <div className="family-bar-track">
                                  <div
                                    className="family-bar-fill"
                                    style={{ width: `${(child.count / maxCount) * 100}%` }}
                                  />
                                </div>
                                <strong>{child.count}</strong>
                              </div>
                            );
                          })
                        ) : (
                          <p className="status-note">No child metrics yet.</p>
                        )}
                      </div>
                      <div className="family-alert">
                        <p className="summary-title">Inactive Child Alert</p>
                        <p className="summary-note">
                          {familyMetrics.inactiveChildren.length
                            ? familyMetrics.inactiveChildren.join(", ")
                            : "All children have recent logged events."}
                        </p>
                      </div>
                      {familyMetricsStatus ? <p className="status-note">{familyMetricsStatus}</p> : null}
                    </section>
                  </>
                ) : (
                  <>
                    <div className="section-head">
                      <h2>Add a child</h2>
                      <p>Step 1 of 2: create your baby profile.</p>
                    </div>
                    <div className="stepper">
                      <div className="step active">
                        <span>1</span>
                        Create baby
                      </div>
                      <div className="step">
                        <span>2</span>
                        Add events
                      </div>
                    </div>
                    <form className="note-form" onSubmit={handleCreateProfile}>
                      <div className="theme-picker">
                        <p className="summary-title">Profile style</p>
                        <div className="theme-options">
                          {BABY_THEMES.map((theme) => (
                            <button
                              key={theme.id}
                              className={`theme-dot ${theme.id} ${selectedTheme === theme.id ? "active" : ""}`}
                              type="button"
                              aria-label={`Select ${theme.label} profile style`}
                              onClick={() => setSelectedTheme(theme.id)}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="form-grid">
                        <label>
                          Baby name
                          <input
                            value={babyName}
                            onChange={(event) => setBabyName(event.target.value)}
                            placeholder="Ava, Mateo..."
                          />
                        </label>
                        <label>
                          Birth date
                          <input
                            type="date"
                            value={babyBirthDate}
                            onChange={(event) => setBabyBirthDate(event.target.value)}
                          />
                        </label>
                      </div>
                      <button className="primary create-profile-btn" type="submit">
                        Create baby profile
                      </button>
                      {apiStatus ? <p className="status-note">{apiStatus}</p> : null}
                    </form>
                  </>
                )}
              </section>
            ) : null}

            {onboardingStep === ONBOARDING_STEPS.ADD_EVENTS ? (
              <section className="analytics modern">
                <div className="section-head">
                  <h2>Analytics Snapshot</h2>
                  <p>Live patterns from today&apos;s events.</p>
                </div>
                <div className="analytics-grid">
                  <article className="analytics-card">
                    <p className="summary-title">Event Mix</p>
                    <div className="donut-layout">
                      <div className="donut-chart" style={{ background: analytics.donutBackground }}>
                        <div className="donut-inner">
                          <strong>{analytics.total}</strong>
                          <span>events</span>
                        </div>
                      </div>
                      <div className="donut-legend">
                        {analytics.segments.map((item) => (
                          <div key={item.key} className="legend-row">
                            <span className="legend-dot" style={{ background: item.color }} />
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                  <article className="analytics-card">
                    <p className="summary-title">Category Bars</p>
                    <div className="bars-stack">
                      {analytics.segments.map((item) => (
                        <div key={item.key} className="bar-row">
                          <span>{item.label}</span>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              style={{
                                width: `${(item.value / analytics.maxValue) * 100}%`,
                                background: item.color
                              }}
                            />
                          </div>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </section>
            ) : null}

            {!isCreateBabyStep ? (
              <section className="quick-log modern onboarding-screen">
              <div className="section-head">
                <h2>Add Baby Events</h2>
                <div className="date-chip section-date-chip">
                  <CalendarDays />
                  <span>{today}</span>
                </div>
              </div>
              <div className="stepper">
                <div className="step">
                  <span>1</span>
                  Create baby
                </div>
                <div className="step active">
                  <span>2</span>
                  Add events
                </div>
              </div>
              <form className="note-form" onSubmit={handleAddEvent}>
                <div className="event-composer">
                  <p className="summary-title">Quick Autofill</p>
                  <div className="preset-grid">
                    {EVENT_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        className={`preset-chip ${selectedPreset === preset.label ? "active" : ""}`}
                        type="button"
                        onClick={() => handlePresetSelect(preset)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    Event time
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(event) => setEventTime(event.target.value)}
                    />
                  </label>
                  <label>
                    Baby mood
                    <select
                      value={eventMood}
                      onChange={(event) => setEventMood(event.target.value)}
                    >
                      {EVENT_MOOD_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {moodMap[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  New event
                  <textarea
                    rows={3}
                    placeholder="Add details. Autofill options above can draft this for you."
                    value={eventInput}
                    onChange={(event) => setEventInput(event.target.value)}
                  />
                </label>
                <div className="photo-upload">
                  <p className="photo-upload-title">Attach photo</p>
                  <label className="photo-upload-control" htmlFor="event-photo-input">
                    <span className="photo-upload-btn">
                      {eventPhotoName ? "Change photo" : "Choose photo"}
                    </span>
                    <span className="photo-upload-file">{eventPhotoName || "No file chosen"}</span>
                  </label>
                  <input
                    id="event-photo-input"
                    className="photo-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                  />
                </div>
                {eventPhotoDataUrl ? (
                  <div className="photo-preview">
                    <img src={eventPhotoDataUrl} alt={eventPhotoName || "Event attachment preview"} />
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => {
                        setEventPhotoDataUrl("");
                        setEventPhotoName("");
                      }}
                    >
                      Remove photo
                    </button>
                  </div>
                ) : null}
                <button className="primary" type="submit">
                  Add event
                </button>
                {apiStatus ? <p className="status-note">{apiStatus}</p> : null}
              </form>
            </section>
            ) : null}

            {onboardingStep === ONBOARDING_STEPS.ADD_EVENTS ? (
              <section className="timeline modern">
              <div className="section-head">
                <h2>Today&apos;s Timeline</h2>
                <div className="timeline-head-tools">
                  <button className="ghost" type="button" onClick={handleRefreshTimeline}>
                    <RefreshCw />
                  </button>
                </div>
              </div>
              {!selectedBabyId ? (
                <p className="status-note">Select a baby to load the timeline.</p>
              ) : null}
              {selectedBabyId && !entries.length ? (
                <p className="status-note">No events yet for this baby.</p>
              ) : null}
              {entries.length ? (
                <div className="entry-list">
                  {entries.map((entry, index) => {
                    const iconKey = entry.icon || "heart";
                    const moodKey = entry.mood || "content";
                    const Icon = iconMap[iconKey] || Heart;
                    const notes = entry.notes || entry.note || "No notes added yet.";
                    const time = entry.time || entry.loggedAt || "--:--";
                    const key = entry.id || entry._id || `${entry.type || "entry"}-${index}`;
                    return (
                      <article key={key} className="entry-card modern">
                        <div className="entry-icon">
                          <Icon />
                        </div>
                        <div className="entry-body">
                          <div className="entry-meta">
                            <span className="entry-type">{entry.type || "Entry"}</span>
                            <span className="entry-time">{time}</span>
                          </div>
                          <p className="entry-notes">{notes}</p>
                          {entry.photo ? (
                            <div className="entry-photo-wrap">
                              <img className="entry-photo" src={entry.photo} alt={entry.photoName || "Event photo"} />
                            </div>
                          ) : null}
                          <span className="entry-mood">{moodMap[moodKey] || "Gentle moment"}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
            ) : null}
          </main>
        </div>

        <button
          className="fab"
          aria-label="Add new baby"
          type="button"
          onClick={handleStartAddBaby}
        >
          <Plus />
        </button>
        {isCreateBabyStep && !showFamilyAdmin ? (
          <button
            className="cancel-fab"
            aria-label="Cancel create baby and open family administer"
            type="button"
            onClick={handleOpenFamilyAdmin}
          >
            X
          </button>
        ) : null}
      </div>
    </div>
  );
}
