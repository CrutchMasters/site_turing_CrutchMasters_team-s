const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost";

export const API_URL = isLocal
? "http://localhost:8000"
: "https://site-turing-crutchmasters-team-s.onrender.com";
