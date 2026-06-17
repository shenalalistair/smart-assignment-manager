import { useState, useRef, useCallback } from "react";

const C = {
  bg: "#f5f5f0",
  white: "#ffffff",
  text: "#1a1a1a",
  muted: "#888",
  border: "#e0e0d8",
  accent: "#2a5cff",
  red: "#e53e3e",
  amber: "#d97706",
  green: "#16a34a",
};

function getDaysLeft(dueDate) {
  if (!dueDate) return null;
  const diff = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  return diff;
}

function DuePill({ dueDate }) {
  const days = getDaysLeft(dueDate);
  if (days === null) return <span style={{ color: C.muted, fontSize: 12 }}>No due date</span>;
  const color = days < 0 ? C.red : days <= 3 ? C.amber : C.green;
  const label = days < 0 ? "Overdue" : days === 0 ? "Due today" : `${days}d left`;
  return <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>;
}

async function extractWithGemini(text, fileName) {
  const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

  const prompt = `You are an academic assignment parser. Extract info from this assignment brief and return ONLY valid JSON, no markdown, no backticks:
{
  "title": "assignment title or null",
  "module": "module/course name or null",
  "dueDate": "due date as Month DD YYYY or null",
  "wordCount": "e.g. 2000 words or null",
  "weight": "e.g. 40% or null",
  "summary": "2-3 sentence summary of what the student must do",
  "keyTasks": ["task1", "task2", "task3"]
}

File name: ${fileName}
Text: ${text.substring(0, 3000)}`;

  const res = await fetch(
    `/api/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  const data = await res.json();
  console.log("Gemini response:", data);

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  console.log("Raw text:", raw);

  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

function Meta({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{value}</div>
    </div>
  );
}

export default function App() {
  const [assignments, setAssignments] = useState([]);
  const [processingFiles, setProcessingFiles] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  const processFile = useCallback(async (file) => {
    setProcessingFiles(prev => [...prev, file.name]);
    try {
      const text = await file.text();
      const data = await extractWithGemini(text, file.name);
      setAssignments(prev => [{
        id: Date.now(),
        fileName: file.name,
        title: data.title || file.name.replace(/\.[^.]+$/, ""),
        module: data.module || "—",
        dueDate: data.dueDate || null,
        wordCount: data.wordCount || null,
        weight: data.weight || null,
        summary: data.summary || "No summary available.",
        keyTasks: data.keyTasks || [],
      }, ...prev]);
    } catch (err) {
      console.error("Processing error:", err);
      alert(`Could not process ${file.name}`);
    }
    setProcessingFiles(prev => prev.filter(n => n !== file.name));
  }, []);

  const handleFiles = (files) => {
    Array.from(files).forEach(file => {
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        processFile(file);
      }
    });
  };

  const remove = (id) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
    if (expanded === id) setExpanded(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "40px 20px", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: C.text }}>Assignment Manager</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Upload a brief — AI extracts the details automatically.
          </p>
        </div>

        {/* Upload */}
        <div
          onClick={() => processingFiles.length === 0 && fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
          style={{
            border: `1.5px dashed ${drag ? C.accent : C.border}`,
            borderRadius: 10,
            padding: "28px 20px",
            textAlign: "center",
            cursor: processingFiles.length > 0 ? "wait" : "pointer",
            background: drag ? "#eef2ff" : C.white,
            marginBottom: 28,
            transition: "all 0.15s",
          }}
        >
          <input ref={fileRef} type="file" accept=".txt" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
          {processingFiles.length > 0 ? (
            <div>
              {processingFiles.map(name => (
                <p key={name} style={{ fontSize: 13, color: C.accent, fontWeight: 500 }}>Analysing {name}…</p>
              ))}
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>Drop a file or click to upload</p>
              <p style={{ fontSize: 12, color: C.muted }}>TXT assignment briefs</p>
            </>
          )}
        </div>

        {/* List */}
        {assignments.length === 0 && processingFiles.length === 0 ? (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 48 }}>No assignments yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {assignments.map(a => (
              <div key={a.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>

                {/* Row */}
                <div
                  onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", gap: 12 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{a.module}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                    <DuePill dueDate={a.dueDate} />
                    <span style={{ color: C.muted, fontSize: 12 }}>{expanded === a.id ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Expanded */}
                {expanded === a.id && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 16px", background: "#fafaf8" }}>
                    <div style={{ display: "flex", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
                      {a.dueDate && <Meta label="Due" value={a.dueDate} />}
                      {a.wordCount && <Meta label="Words" value={a.wordCount} />}
                      {a.weight && <Meta label="Weight" value={a.weight} />}
                    </div>
                    <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: a.keyTasks.length ? 12 : 0 }}>
                      {a.summary}
                    </p>
                    {a.keyTasks.length > 0 && (
                      <ul style={{ paddingLeft: 16, margin: "0 0 12px" }}>
                        {a.keyTasks.map((t, i) => (
                          <li key={i} style={{ fontSize: 12, color: "#555", lineHeight: 1.8 }}>{t}</li>
                        ))}
                      </ul>
                    )}
                    <button onClick={() => remove(a.id)} style={{ fontSize: 12, color: C.red, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}