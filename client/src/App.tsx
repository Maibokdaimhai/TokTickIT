import { useState } from "react";
import { checkSystem, Category } from "./api.js";

type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleCheck() {
    // TODO(Issue 4): set loading, call checkSystem(), then either
    //   - success: store categories and show Online + the list, or
    //   - error: show Offline + a useful message.
    setState("loading");
    setErrorMessage("");
    try {
      const res = await checkSystem();
      setCategories(res.categories);
      setState("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Unable to connect to TokTickIT API");
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT IT Service Desk
      </h1>

      <button className="btn btn-primary mb-4" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

    {/* TODO(Issue 4): render loading / success (Online + categories) / error (Offline) states. */}
      {state === "success" && (
        <div className="mt-3">
          <p className="fw-bold">System Status: Online</p>
          {categories.length > 0 && (
            <div className="mt-3">
              <p className="fw-bold">Supported Request Categories:</p>
              <ul>
                {categories.map((cat) => (
                  <li key={cat.id}>{cat.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="mt-3">
          <p className="fw-bold">System Status: Offline</p>
          <div className="text-danger">{errorMessage}</div>
        </div>
      )}
    </div>
  );
}