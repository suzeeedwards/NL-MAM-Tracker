import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";

const THRESHOLD = 85;
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEMBER_COLORS = ["#e8a87c", "#85c1a3", "#7eb8d4", "#c9a0dc", "#f0c869"];

// ── Theme ─────────────────────────────────────────────────────────────────────
const DARK = {
  bg: "#141414", surface: "#1c1c1c", surface2: "#212121", surface3: "#252525",
  border: "#222", border2: "#2a2a2a", border3: "#2e2e2e",
  text: "#f0f0f0", textMid: "#c0c0c0", textDim: "#999", textFaint: "#555", textGhost: "#333",
  header: "#181818", headerBorder: "#1e1e1e",
  inputBg: "#242424", inputBorder: "#2e2e2e",
  btnBg: "#1e1e1e", btnActive: "#e8a87c", btnActiveText: "#1a1a1a",
  scrollThumb: "#2e2e2e",
};
const LIGHT = {
  bg: "#f5f4f0", surface: "#ffffff", surface2: "#f8f7f4", surface3: "#efefeb",
  border: "#e8e6e0", border2: "#dedad2", border3: "#d0ccc4",
  text: "#1a1a1a", textMid: "#333", textDim: "#666", textFaint: "#999", textGhost: "#bbb",
  header: "#ffffff", headerBorder: "#e8e6e0",
  inputBg: "#f5f4f0", inputBorder: "#dedad2",
  btnBg: "#efefeb", btnActive: "#e8a87c", btnActiveText: "#1a1a1a",
  scrollThumb: "#d0ccc4",
};

// ── Data helpers ──────────────────────────────────────────────────────────────
const emptyTactic = () => ({
  id: crypto.randomUUID(), text: "",
  freqType: "count", freqCount: 7,
  freqDays: [true, true, true, true, true, true, true],
  checks: Array(12).fill(null).map(() => Array(7).fill(false)),
});
const emptyGoal = () => ({ id: crypto.randomUUID(), title: "", tactics: [emptyTactic()] });
const defaultMemberData = () => ({ goals: [emptyGoal()] });

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── Scoring ───────────────────────────────────────────────────────────────────
function getTargetDays(tactic) {
  if (tactic.freqType === "days")
    return (tactic.freqDays || []).map((on, i) => on ? i : -1).filter(i => i >= 0);
  return [0, 1, 2, 3, 4, 5, 6];
}
function calcTacticScore(tactic, upToWeek) {
  let done = 0, target = 0;
  const td = getTargetDays(tactic);
  for (let w = 0; w < upToWeek; w++) {
    const wk = tactic.checks[w] || Array(7).fill(false);
    if (tactic.freqType === "days") { td.forEach(di => { target++; if (wk[di]) done++; }); }
    else { target += tactic.freqCount; done += Math.min(wk.filter(Boolean).length, tactic.freqCount); }
  }
  return target === 0 ? null : Math.round((done / target) * 100);
}
function calcScore(tactics, upToWeek) {
  let done = 0, target = 0;
  tactics.forEach(t => {
    const td = getTargetDays(t);
    for (let w = 0; w < upToWeek; w++) {
      const wk = t.checks[w] || Array(7).fill(false);
      if (t.freqType === "days") { td.forEach(di => { target++; if (wk[di]) done++; }); }
      else { target += t.freqCount; done += Math.min(wk.filter(Boolean).length, t.freqCount); }
    }
  });
  return target === 0 ? null : Math.round((done / target) * 100);
}

// ── Components ────────────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  if (score === null) return <span style={{ color: "#999", fontSize: 12 }}>—</span>;
  const color = score >= THRESHOLD ? "#4caf82" : score >= 60 ? "#d4a017" : "#d05050";
  return (
    <span style={{
      background: color + "18", color, border: `1px solid ${color}55`,
      borderRadius: 20, padding: "2px 9px", fontWeight: 700,
      fontSize: 12, fontFamily: "'DM Mono', monospace", flexShrink: 0,
    }}>{score}%</span>
  );
}

function ThemeToggle({ dark, onToggle }) {
  return (
    <button onClick={onToggle} title={dark ? "Switch to light mode" : "Switch to dark mode"} style={{
      background: "none", border: `1px solid ${dark ? "#2e2e2e" : "#dedad2"}`,
      borderRadius: 20, cursor: "pointer", padding: "4px 10px",
      fontSize: 14, display: "flex", alignItems: "center", gap: 6,
      color: dark ? "#888" : "#666", transition: "all 0.2s",
    }}>
      {dark ? "☀️" : "🌙"}
    </button>
  );
}

function FreqPicker({ tactic, onChange, memberColor, t }) {
  const { freqType, freqCount, freqDays } = tactic;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {["count", "days"].map(type => (
          <button key={type} onClick={() => onChange({ ...tactic, freqType: type })} style={{
            background: freqType === type ? memberColor + "22" : t.btnBg,
            border: `1px solid ${freqType === type ? memberColor + "66" : t.border3}`,
            borderRadius: 6, color: freqType === type ? memberColor : t.textFaint,
            padding: "3px 10px", fontSize: 11, cursor: "pointer",
            fontFamily: "'Sora', sans-serif", fontWeight: freqType === type ? 700 : 400,
          }}>{type === "count" ? "× per week" : "Specific days"}</button>
        ))}
      </div>
      {freqType === "count" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: t.textFaint }}>Target:</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[1,2,3,4,5,6,7].map(n => (
              <button key={n} onClick={() => onChange({ ...tactic, freqCount: n })} style={{
                width: 26, height: 26, borderRadius: 6, border: "none",
                background: freqCount === n ? memberColor : t.surface3,
                color: freqCount === n ? "#1a1a1a" : t.textFaint,
                fontWeight: freqCount === n ? 700 : 400,
                cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono', monospace",
              }}>{n}</button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: t.textFaint }}>days/week</span>
        </div>
      )}
      {freqType === "days" && (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: t.textFaint, marginRight: 2 }}>Days:</span>
          {DAYS.map((d, i) => (
            <button key={i} onClick={() => {
              const newDays = freqDays.map((v, j) => j === i ? !v : v);
              if (newDays.some(Boolean)) onChange({ ...tactic, freqDays: newDays });
            }} style={{
              width: 26, height: 26, borderRadius: 6, border: "none",
              background: freqDays[i] ? memberColor : t.surface3,
              color: freqDays[i] ? "#1a1a1a" : t.textFaint,
              fontWeight: freqDays[i] ? 700 : 400,
              cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono', monospace",
            }}>{d}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function WeekGrid({ tactic, currentWeek, memberColor, onToggle, t }) {
  const targetDays = getTargetDays(tactic);
  const isTargeted = di => targetDays.includes(di);
  return (
    <div style={{ overflowX: "auto", paddingBottom: 2 }}>
      <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: 220 }}>
        <thead>
          <tr>
            <th style={{ width: 32, paddingRight: 4 }}></th>
            {DAYS.map((d, i) => (
              <th key={i} style={{
                width: 26, paddingBottom: 5, textAlign: "center",
                fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600,
                color: !isTargeted(i) ? t.border3 : i >= 5 ? t.textFaint : t.textDim,
              }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }, (_, wi) => {
            const isFuture = wi >= currentWeek;
            const isCurrent = wi === currentWeek - 1;
            const weekChecks = tactic.checks[wi] || Array(7).fill(false);
            let wDone = 0, wTarget = 0;
            if (tactic.freqType === "days") {
              targetDays.forEach(di => { wTarget++; if (weekChecks[di]) wDone++; });
            } else {
              wTarget = tactic.freqCount;
              wDone = Math.min(weekChecks.filter(Boolean).length, tactic.freqCount);
            }
            const wScore = wTarget === 0 ? null : Math.round((wDone / wTarget) * 100);
            const wColor = wScore === null ? null : wScore >= THRESHOLD ? "#4caf82" : wScore >= 60 ? "#d4a017" : "#d05050";
            return (
              <tr key={wi}>
                <td style={{
                  textAlign: "right", paddingRight: 7, paddingBottom: 2,
                  color: isCurrent ? memberColor : t.textGhost,
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: isCurrent ? 700 : 400, fontSize: 10,
                }}>W{wi + 1}</td>
                {weekChecks.map((checked, di) => {
                  const targeted = isTargeted(di);
                  const disabled = isFuture || !targeted;
                  return (
                    <td key={di} style={{ textAlign: "center", padding: "1px 2px" }}>
                      <button onClick={() => !disabled && onToggle(wi, di)}
                        title={targeted ? `Week ${wi + 1}, ${DAY_NAMES[di]}` : "Not a target day"}
                        style={{
                          width: 22, height: 22, borderRadius: 4,
                          border: isCurrent && targeted ? `1px solid ${memberColor}60` : `1px solid transparent`,
                          background: !targeted ? "transparent"
                            : isFuture ? t.surface3
                            : checked ? memberColor
                            : t.surface2,
                          cursor: disabled ? "default" : "pointer",
                          opacity: !targeted ? 0.08 : isFuture ? 0.3 : 1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "background 0.1s", fontSize: 10, fontWeight: 800,
                          color: checked && !isFuture && targeted ? "#1a1a1a" : "transparent",
                        }}
                      >{checked && !isFuture && targeted ? "✓" : ""}</button>
                    </td>
                  );
                })}
                {!isFuture && wScore !== null && (
                  <td style={{ paddingLeft: 6 }}>
                    <span style={{ fontSize: 9, color: wColor, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{wScore}%</span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── MemberCard: fully self-contained local state, saves debounced ─────────────
function MemberCard({ member, memberData, currentWeek, isEditing, onSave, onNameSave, t }) {
  // Keep a fully local copy of all data while editing
  const [localData, setLocalData] = useState(memberData);
  const [localName, setLocalName] = useState(member.name);

  // Sync from parent only when NOT editing (e.g. another user's update comes in)
  useEffect(() => {
    if (!isEditing) {
      setLocalData(memberData);
      setLocalName(member.name);
    }
  }, [isEditing, memberData, member.name]);

  // Debounced values — only save to Supabase 800ms after the user stops typing
  const debouncedData = useDebounce(localData, 800);
  const debouncedName = useDebounce(localName, 800);

  // Trigger save when debounced values change (only while editing)
  const isEditingRef = useRef(isEditing);
  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);

  useEffect(() => {
    if (isEditingRef.current) {
      onSave(debouncedData);
    }
  }, [debouncedData]);

  useEffect(() => {
    if (isEditingRef.current) {
      onNameSave(debouncedName);
    }
  }, [debouncedName]);

  const goals = localData.goals || [emptyGoal()];
  const overallScore = calcScore(goals.flatMap(g => g.tactics), currentWeek);

  const addGoal = () => setLocalData(d => ({ ...d, goals: [...d.goals, emptyGoal()] }));
  const removeGoal = gid => setLocalData(d => ({ ...d, goals: d.goals.filter(g => g.id !== gid) }));
  const updateGoalField = (gid, field, val) =>
    setLocalData(d => ({ ...d, goals: d.goals.map(g => g.id === gid ? { ...g, [field]: val } : g) }));
  const addTactic = gid =>
    setLocalData(d => ({ ...d, goals: d.goals.map(g => g.id === gid ? { ...g, tactics: [...g.tactics, emptyTactic()] } : g) }));
  const removeTactic = (gid, tid) =>
    setLocalData(d => ({ ...d, goals: d.goals.map(g => g.id === gid ? { ...g, tactics: g.tactics.filter(t2 => t2.id !== tid) } : g) }));
  const updateTactic = (gid, tid, updated) =>
    setLocalData(d => ({ ...d, goals: d.goals.map(g => g.id === gid ? { ...g, tactics: g.tactics.map(t2 => t2.id === tid ? updated : t2) } : g) }));
  const toggleDay = (gid, tid, week, day) =>
    setLocalData(d => ({
      ...d, goals: d.goals.map(g => g.id === gid ? {
        ...g, tactics: g.tactics.map(t2 => t2.id === tid ? {
          ...t2, checks: t2.checks.map((wk, wi) => wi === week ? wk.map((dv, di) => di === day ? !dv : dv) : wk)
        } : t2)
      } : g)
    }));

  const inputBase = {
    width: "100%", background: t.inputBg, border: `1px solid ${t.inputBorder}`,
    borderRadius: 8, color: t.text, padding: "8px 12px",
    fontSize: 13, fontFamily: "'Sora', sans-serif", outline: "none", boxSizing: "border-box",
  };
  const freqLabel = tac => {
    if (tac.freqType === "count") return `${tac.freqCount}×/week`;
    return (tac.freqDays || []).map((v, i) => v ? DAYS[i] : null).filter(Boolean).join(" ");
  };

  return (
    <div style={{ background: t.surface, borderRadius: 16, border: `1px solid ${member.color}30`, overflow: "hidden", boxShadow: t === LIGHT ? "0 1px 4px rgba(0,0,0,0.06)" : "none" }}>
      <div style={{
        background: member.color + "14", borderBottom: `1px solid ${member.color}22`,
        padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: member.color, boxShadow: `0 0 6px ${member.color}` }} />
          {isEditing ? (
            <input
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              style={{
                background: "transparent", border: "none", borderBottom: `1px solid ${member.color}`,
                color: t.text, fontSize: 15, fontWeight: 700, fontFamily: "'Sora', sans-serif",
                width: 150, outline: "none",
              }}
            />
          ) : (
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{localName}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: t.textFaint, textTransform: "uppercase", letterSpacing: 1 }}>Overall</span>
          <ScoreBadge score={overallScore} />
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {goals.map((goal, gi) => {
          const gscore = calcScore(goal.tactics, currentWeek);
          return (
            <div key={goal.id} style={{
              marginBottom: 24, paddingBottom: 24,
              borderBottom: gi < goals.length - 1 ? `1px solid ${t.border}` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{
                  background: member.color + "20", color: member.color,
                  borderRadius: 6, padding: "2px 8px", fontSize: 10,
                  fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                }}>Goal {gi + 1}</div>
                <ScoreBadge score={gscore} />
                {isEditing && goals.length > 1 && (
                  <button onClick={() => removeGoal(goal.id)} style={{
                    marginLeft: "auto", background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 16,
                  }}>✕</button>
                )}
              </div>

              {isEditing ? (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, color: t.textFaint, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>My Goal</label>
                  <textarea
                    value={goal.title}
                    onChange={e => updateGoalField(goal.id, "title", e.target.value)}
                    placeholder="What is your goal this 12-week cycle?"
                    rows={2}
                    style={{ ...inputBase, resize: "vertical" }}
                  />
                </div>
              ) : goal.title ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: t.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>My Goal</div>
                  <p style={{ margin: 0, fontSize: 13, color: t.textMid, lineHeight: 1.55, fontStyle: "italic" }}>"{goal.title}"</p>
                </div>
              ) : null}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {goal.tactics.map(tactic => {
                  const tscore = calcTacticScore(tactic, currentWeek);
                  return (
                    <div key={tactic.id} style={{
                      background: t.surface2, borderRadius: 10, padding: "12px", border: `1px solid ${t.border}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{
                          width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                          background: tscore === null ? t.border3 : tscore >= THRESHOLD ? "#4caf82" : tscore >= 60 ? "#d4a017" : "#d05050",
                        }} />
                        <span style={{ fontSize: 10, color: t.textFaint, textTransform: "uppercase", letterSpacing: 1 }}>I'm Tracking</span>
                        {!isEditing && (
                          <span style={{ fontSize: 10, color: t.textGhost, fontFamily: "'DM Mono', monospace" }}>{freqLabel(tactic)}</span>
                        )}
                        <ScoreBadge score={tscore} />
                        {isEditing && goal.tactics.length > 1 && (
                          <button onClick={() => removeTactic(goal.id, tactic.id)} style={{
                            marginLeft: "auto", background: "none", border: "none", color: t.textFaint, cursor: "pointer", fontSize: 14,
                          }}>✕</button>
                        )}
                      </div>
                      {isEditing ? (
                        <input
                          value={tactic.text}
                          onChange={e => updateTactic(goal.id, tactic.id, { ...tactic, text: e.target.value })}
                          placeholder="What habit are you tracking? e.g. Walk 30 min daily"
                          style={{ ...inputBase, marginBottom: 10 }}
                        />
                      ) : tactic.text ? (
                        <p style={{ margin: "0 0 10px", fontSize: 12, color: t.textDim, lineHeight: 1.45 }}>{tactic.text}</p>
                      ) : (
                        <p style={{ margin: "0 0 10px", fontSize: 12, color: t.textGhost, fontStyle: "italic" }}>No habit set — hit Edit</p>
                      )}
                      {isEditing && <FreqPicker tactic={tactic} memberColor={member.color} t={t} onChange={updated => updateTactic(goal.id, tactic.id, updated)} />}
                      <WeekGrid tactic={tactic} currentWeek={currentWeek} memberColor={member.color} t={t}
                        onToggle={(week, day) => toggleDay(goal.id, tactic.id, week, day)} />
                    </div>
                  );
                })}
              </div>
              {isEditing && (
                <button onClick={() => addTactic(goal.id)} style={{
                  marginTop: 10, background: "none", border: `1px dashed ${t.border3}`,
                  borderRadius: 8, color: t.textFaint, cursor: "pointer",
                  padding: "7px 14px", fontSize: 12, width: "100%", fontFamily: "'Sora', sans-serif",
                }}>+ Add habit to track</button>
              )}
            </div>
          );
        })}
        {isEditing && (
          <button onClick={addGoal} style={{
            background: "none", border: `1px dashed ${member.color}40`,
            borderRadius: 10, color: member.color + "99", cursor: "pointer",
            padding: "8px 16px", fontSize: 12, width: "100%", fontFamily: "'Sora', sans-serif",
          }}>+ Add another goal</button>
        )}
      </div>
    </div>
  );
}

function WeekSelector({ currentWeek, setCurrentWeek, t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, color: t.textFaint, letterSpacing: 1, textTransform: "uppercase" }}>Week</span>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(w => (
          <button key={w} onClick={() => setCurrentWeek(w)} style={{
            width: 27, height: 27, borderRadius: "50%", border: "none",
            background: currentWeek === w ? "#e8a87c" : t.btnBg,
            color: currentWeek === w ? "#1a1a1a" : t.textFaint,
            fontWeight: currentWeek === w ? 700 : 400,
            cursor: "pointer", fontSize: 11, transition: "all 0.12s",
            fontFamily: "'DM Mono', monospace",
          }}>{w}</button>
        ))}
      </div>
    </div>
  );
}

// ── Settings member name input with local state ───────────────────────────────
function SettingsMemberNameInput({ value, onSave, t }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  const debounced = useDebounce(local, 800);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    onSave(debounced);
  }, [debounced]);
  return (
    <input
      value={local}
      onChange={e => setLocal(e.target.value)}
      style={{
        flex: 1, background: t.inputBg, border: `1px solid ${t.inputBorder}`,
        borderRadius: 10, color: t.text, padding: "8px 12px",
        fontSize: 13, outline: "none", fontFamily: "'Sora', sans-serif",
      }}
    />
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [members, setMembers] = useState([]);
  const [memberDataMap, setMemberDataMap] = useState({});
  const [currentWeek, setCurrentWeek] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("group");
  const [cycleStart, setCycleStart] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState({});
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("wam-theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const t = darkMode ? DARK : LIGHT;
  const editingIdRef = useRef(editingId);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);

  useEffect(() => {
    localStorage.setItem("wam-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const { data: settings } = await supabase.from("settings").select("*").eq("id", "global").single();
      if (settings) { setCurrentWeek(settings.current_week || 1); setCycleStart(settings.cycle_start || ""); }
      const { data: membersData } = await supabase.from("members").select("*").order("sort_order");
      if (membersData && membersData.length > 0) {
        setMembers(membersData.map(m => ({ id: m.id, name: m.name, color: m.color })));
        const dataMap = {};
        membersData.forEach(m => { dataMap[m.id] = m.tracker_data || defaultMemberData(); });
        setMemberDataMap(dataMap);
      } else {
        const defaults = [
          { id: crypto.randomUUID(), name: "Member 1", color: MEMBER_COLORS[0], sort_order: 0 },
          { id: crypto.randomUUID(), name: "Member 2", color: MEMBER_COLORS[1], sort_order: 1 },
          { id: crypto.randomUUID(), name: "Member 3", color: MEMBER_COLORS[2], sort_order: 2 },
        ];
        await supabase.from("members").insert(defaults.map(m => ({ ...m, tracker_data: defaultMemberData() })));
        setMembers(defaults.map(({ id, name, color }) => ({ id, name, color })));
        const dataMap = {};
        defaults.forEach(m => { dataMap[m.id] = defaultMemberData(); });
        setMemberDataMap(dataMap);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    const channel = supabase.channel("wam-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, payload => {
        if (payload.eventType === "UPDATE") {
          const m = payload.new;
          // Never overwrite state for the member currently being edited
          if (editingIdRef.current === m.id) return;
          setMembers(prev => prev.map(mb => mb.id === m.id ? { ...mb, name: m.name, color: m.color } : mb));
          setMemberDataMap(prev => ({ ...prev, [m.id]: m.tracker_data }));
        }
        if (payload.eventType === "INSERT") {
          const m = payload.new;
          setMembers(prev => [...prev, { id: m.id, name: m.name, color: m.color }]);
          setMemberDataMap(prev => ({ ...prev, [m.id]: m.tracker_data || defaultMemberData() }));
        }
        if (payload.eventType === "DELETE") {
          setMembers(prev => prev.filter(mb => mb.id !== payload.old.id));
          setMemberDataMap(prev => { const n = { ...prev }; delete n[payload.old.id]; return n; });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, payload => {
        if (payload.new) { setCurrentWeek(payload.new.current_week || 1); setCycleStart(payload.new.cycle_start || ""); }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const saveMemberData = useCallback(async (memberId, name, color, trackerData) => {
    setSaveStatus(s => ({ ...s, [memberId]: "saving" }));
    await supabase.from("members").update({ name, color, tracker_data: trackerData }).eq("id", memberId);
    setSaveStatus(s => ({ ...s, [memberId]: "saved" }));
    setTimeout(() => setSaveStatus(s => ({ ...s, [memberId]: null })), 2000);
  }, []);

  const saveSettings = async (week, start) => {
    await supabase.from("settings").upsert({ id: "global", current_week: week, cycle_start: start });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const updateMemberColor = (mid, color) => {
    setMembers(prev => prev.map(m => m.id === mid ? { ...m, color } : m));
    const data = memberDataMap[mid] || defaultMemberData();
    const member = members.find(m => m.id === mid);
    if (member) saveMemberData(mid, member.name, color, data);
  };
  const addMember = async () => {
    if (members.length >= 5) return;
    const newMember = {
      id: crypto.randomUUID(), name: `Member ${members.length + 1}`,
      color: MEMBER_COLORS[members.length], sort_order: members.length,
      tracker_data: defaultMemberData(),
    };
    await supabase.from("members").insert(newMember);
  };
  const removeMember = async (mid) => {
    if (members.length <= 1) return;
    if (!confirm("Remove this member and all their data?")) return;
    await supabase.from("members").delete().eq("id", mid);
  };

  const leaderboard = members.map(m => {
    const goals = (memberDataMap[m.id] || {}).goals || [];
    return { ...m, score: calcScore(goals.flatMap(g => g.tactics), currentWeek) };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  if (loading) return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&display=swap');`}</style>
      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Sora', sans-serif", color: t.text }}>
        WAM<span style={{ color: "#e8a87c" }}>.</span>tracker
      </div>
      <div style={{ fontSize: 13, color: t.textFaint, fontFamily: "'Sora', sans-serif" }}>Loading your group...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'Sora', sans-serif", color: t.text, transition: "background 0.2s, color 0.2s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        textarea { font-family: 'Sora', sans-serif !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{
        background: t.header, borderBottom: `1px solid ${t.headerBorder}`,
        padding: "14px 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: t.text }}>WAM<span style={{ color: "#e8a87c" }}>.</span>tracker</div>
          <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: 2, textTransform: "uppercase" }}>12 Week Year · Live</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <WeekSelector currentWeek={currentWeek} t={t} setCurrentWeek={w => { setCurrentWeek(w); saveSettings(w, cycleStart); }} />
          <ThemeToggle dark={darkMode} onToggle={() => setDarkMode(d => !d)} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 20px", display: "flex", gap: 4, borderBottom: `1px solid ${t.headerBorder}`, background: t.header }}>
        {["group", "leaderboard", "settings"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: "none", border: "none",
            borderBottom: activeTab === tab ? `2px solid #e8a87c` : "2px solid transparent",
            color: activeTab === tab ? "#e8a87c" : t.textFaint,
            padding: "10px 6px", cursor: "pointer", fontSize: 12,
            fontFamily: "'Sora', sans-serif", fontWeight: activeTab === tab ? 700 : 400,
            textTransform: "capitalize", letterSpacing: 0.5, marginBottom: -1,
          }}>{tab}</button>
        ))}
      </div>

      <div style={{ padding: "20px", maxWidth: 1200, margin: "0 auto" }}>

        {/* GROUP */}
        {activeTab === "group" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 18 }}>
            {members.map(member => (
              <div key={member.id} style={{ position: "relative" }}>
                <MemberCard
                  member={member}
                  memberData={memberDataMap[member.id] || defaultMemberData()}
                  currentWeek={currentWeek}
                  isEditing={editingId === member.id}
                  onSave={newData => {
                    setMemberDataMap(prev => ({ ...prev, [member.id]: newData }));
                    saveMemberData(member.id, member.name, member.color, newData);
                  }}
                  onNameSave={name => {
                    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, name } : m));
                    const data = memberDataMap[member.id] || defaultMemberData();
                    saveMemberData(member.id, name, member.color, data);
                  }}
                  t={t}
                />
                <div style={{ position: "absolute", top: 10, right: 12, display: "flex", gap: 6, alignItems: "center" }}>
                  {saveStatus[member.id] && (
                    <span style={{ fontSize: 10, color: saveStatus[member.id] === "saving" ? t.textFaint : "#4caf82" }}>
                      {saveStatus[member.id] === "saving" ? "saving…" : "saved ✓"}
                    </span>
                  )}
                  <button onClick={() => setEditingId(editingId === member.id ? null : member.id)} style={{
                    background: editingId === member.id ? "#e8a87c" : t.btnBg,
                    border: "none", borderRadius: 6,
                    color: editingId === member.id ? "#1a1a1a" : t.textFaint,
                    cursor: "pointer", fontSize: 11, padding: "3px 10px",
                    fontFamily: "'Sora', sans-serif", fontWeight: 600,
                  }}>{editingId === member.id ? "Done ✓" : "Edit"}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LEADERBOARD */}
        {activeTab === "leaderboard" && (
          <div style={{ maxWidth: 480 }}>
            <p style={{ fontSize: 12, color: t.textFaint, marginBottom: 16 }}>
              Execution scores through Week {currentWeek} · 85%+ is on track
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leaderboard.map((m, i) => (
                <div key={m.id} style={{
                  background: t.surface, border: `1px solid ${m.color}22`,
                  borderRadius: 12, padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                  boxShadow: t === LIGHT ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                }}>
                  <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>
                    {i === 0 ? "🏆" : <span style={{ color: t.textGhost, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{i + 1}</span>}
                  </span>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{m.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {m.score !== null && (
                      <div style={{ width: 80, height: 4, background: t.surface3, borderRadius: 2 }}>
                        <div style={{
                          width: `${m.score}%`, height: "100%",
                          background: m.score >= THRESHOLD ? "#4caf82" : m.score >= 60 ? "#d4a017" : "#d05050",
                          borderRadius: 2, transition: "width 0.4s",
                        }} />
                      </div>
                    )}
                    <ScoreBadge score={m.score} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, background: t.surface, borderRadius: 12, padding: 14, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 10, color: t.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Score Guide</div>
              {[
                { range: "85%+", color: "#4caf82", label: "On track — consider making it harder" },
                { range: "60–84%", color: "#d4a017", label: "Getting there — stay consistent" },
                { range: "< 60%", color: "#d05050", label: "Adjust — simplify or break it up" },
              ].map(({ range, color, label }) => (
                <div key={range} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ color, fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 12, width: 54 }}>{range}</span>
                  <span style={{ fontSize: 12, color: t.textDim }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === "settings" && (
          <div style={{ maxWidth: 420 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <label style={{ fontSize: 11, color: t.textFaint, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Current Week</label>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(w => (
                    <button key={w} onClick={() => { setCurrentWeek(w); saveSettings(w, cycleStart); }} style={{
                      width: 34, height: 34, borderRadius: 8, border: "none",
                      background: currentWeek === w ? "#e8a87c" : t.btnBg,
                      color: currentWeek === w ? "#1a1a1a" : t.textFaint,
                      fontWeight: currentWeek === w ? 700 : 400,
                      cursor: "pointer", fontSize: 13, fontFamily: "'DM Mono', monospace",
                    }}>{w}</button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: t.textFaint, marginTop: 6 }}>Changing this updates for everyone in the group.</p>
              </div>
              <div>
                <label style={{ fontSize: 11, color: t.textFaint, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Cycle Start Date</label>
                <input type="date" value={cycleStart} onChange={e => { setCycleStart(e.target.value); saveSettings(currentWeek, e.target.value); }} style={{
                  background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 10,
                  color: t.text, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "'Sora', sans-serif",
                }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: t.textFaint, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Members ({members.length}/5)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                  {members.map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="color" value={m.color}
                        onChange={e => updateMemberColor(m.id, e.target.value)}
                        style={{ width: 34, height: 34, border: "none", borderRadius: 8, cursor: "pointer", background: "none" }}
                      />
                      <SettingsMemberNameInput
                        value={m.name}
                        onSave={name => {
                          setMembers(prev => prev.map(mb => mb.id === m.id ? { ...mb, name } : mb));
                          const data = memberDataMap[m.id] || defaultMemberData();
                          saveMemberData(m.id, name, m.color, data);
                        }}
                        t={t}
                      />
                      {members.length > 1 && (
                        <button onClick={() => removeMember(m.id)} style={{
                          background: "none", border: `1px solid ${t.border2}`, borderRadius: 8,
                          color: "#d05050", cursor: "pointer", padding: "6px 10px", fontSize: 12,
                        }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
                {members.length < 5 && (
                  <button onClick={addMember} style={{
                    background: "none", border: `1px dashed ${t.border3}`, borderRadius: 10,
                    color: t.textFaint, cursor: "pointer", padding: "8px 16px",
                    fontSize: 12, width: "100%", fontFamily: "'Sora', sans-serif",
                  }}>+ Add member</button>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, color: t.textFaint, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Appearance</label>
                <button onClick={() => setDarkMode(d => !d)} style={{
                  background: t.btnBg, border: `1px solid ${t.border2}`, borderRadius: 10,
                  color: t.text, cursor: "pointer", padding: "10px 16px",
                  fontSize: 13, fontFamily: "'Sora', sans-serif",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {darkMode ? "☀️ Switch to Light Mode" : "🌙 Switch to Dark Mode"}
                </button>
              </div>
              {settingsSaved && <div style={{ fontSize: 12, color: "#4caf82" }}>✓ Settings saved for everyone</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
