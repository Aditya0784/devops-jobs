import { createContext, useContext, useEffect, useState } from "react";

const ResumeContext = createContext(null);
const KEY = "ajt_resume_v1";

export function ResumeProvider({ children }) {
  const [resume, setResumeState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
  });

  const setResume = (r) => {
    setResumeState(r);
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  };

  useEffect(() => {
    // Smooth scroll to top-of-page resume box on demand
  }, []);

  return (
    <ResumeContext.Provider value={{ resume, setResume }}>
      {children}
    </ResumeContext.Provider>
  );
}

export const useResume = () => useContext(ResumeContext);
